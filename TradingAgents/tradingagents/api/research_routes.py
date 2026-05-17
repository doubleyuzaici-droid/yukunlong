from __future__ import annotations

import json
import os
import time
from datetime import datetime, timezone
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

from tradingagents.api.schemas import ApiResponse
from tradingagents.optimizer.ablation_test import list_ablation_steps
from tradingagents.optimizer.candidate_generator import generate_candidate_strategy_yaml
from tradingagents.optimizer.diagnostics import (
    summarize_failure_reasons,
    summarize_signal_effectiveness,
)
from tradingagents.optimizer.optimizer_report import render_optimizer_report
from tradingagents.optimizer.parameter_sweep import iter_parameter_grid, run_parameter_sweep
from tradingagents.optimizer.walk_forward import run_walk_forward, split_walk_forward_periods
from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
from tradingagents.research.data_sync import (
    DATA_SOURCES,
    sync_index_bars,
    sync_watchlist_bars,
    sync_watchlist_fund_flows,
)
from tradingagents.research.factor_pipeline import compute_watchlist_factors
from tradingagents.research.pipeline import run_pipeline
from tradingagents.research.pipeline_status import get_watchlist_status
from tradingagents.research.db import get_connection, get_data_dir, init_db
from tradingagents.research.quality import list_quality_issues, resolve_quality_issue
from tradingagents.research.repository import (
    CORE_RESEARCH_UNIVERSE,
    deactivate_watchlist_symbol,
    ensure_core_watchlist_symbols,
    list_watchlist,
    upsert_watchlist_symbols,
)

router = APIRouter(prefix="/api/research", tags=["research"])


class WatchlistRequest(BaseModel):
    symbols: list[str]
    market: str | None = None
    name: str | None = None
    industry: str | None = None
    thesis: str | None = None
    status: str = "active"


class BootstrapWatchlistRequest(BaseModel):
    symbols: list[str] | None = None


class SyncBarsRequest(BaseModel):
    start: str | None = None
    end: str | None = None
    source: str | None = Field(default=None, pattern="^(akshare|tushare|auto)$")


class SyncIndicesRequest(SyncBarsRequest):
    index_symbols: list[str] | None = None


class ResearchPipelineRequest(SyncBarsRequest):
    signal_date: str | None = None
    include_fund_flow: bool = True
    bootstrap_core_symbols: bool = False


class QualityResolutionRequest(BaseModel):
    resolution_status: str = Field(default="resolved")
    resolution_note: str | None = None


class OptimizerCandidateRequest(BaseModel):
    name: str = "candidate"
    candidate_yaml: str


class OptimizerSweepRequest(BaseModel):
    start: str
    end: str
    grid: dict[str, list[int | float | str]] | None = None
    folds: int = Field(default=3, ge=1, le=5)
    score_key: str = "sharpe"
    initial_cash: float = Field(default=1_000_000, gt=0)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _json_file(name: str) -> Path:
    path = get_data_dir() / "workflow" / name
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _read_list(path: Path) -> list[dict]:
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def _write_list(path: Path, rows: list[dict]) -> None:
    path.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def _remember_pipeline_run(record: dict) -> None:
    path = _json_file("pipeline_runs.json")
    rows = _read_list(path)
    rows.insert(0, record)
    _write_list(path, rows[:100])


def _record_sync_trace(
    *,
    job_type: str,
    start: str,
    end: str,
    symbol: str | None = None,
    primary_source: str | None = None,
    fallback_source: str | None = None,
    status: str = "success",
    rows_written: int = 0,
    elapsed_ms: int | None = None,
    error: str | None = None,
) -> None:
    init_db()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO sync_trace (
                trace_id, symbol, job_type, start, end, primary_source,
                fallback_source, status, rows_written, elapsed_ms, error, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                uuid4().hex,
                symbol,
                job_type,
                start,
                end,
                primary_source,
                fallback_source,
                status,
                rows_written,
                elapsed_ms,
                error,
                _now(),
            ),
        )
        conn.commit()


def _candidate_path() -> Path:
    return _json_file("optimizer_candidates.json")


def _resolve_window(start: str | None, end: str | None) -> tuple[str, str]:
    resolved_end = end or date.today().isoformat()
    if start:
        return start, resolved_end
    parsed_end = date.fromisoformat(resolved_end)
    return (parsed_end - timedelta(days=548)).isoformat(), resolved_end


def _status_payload() -> dict:
    status = get_watchlist_status()
    status_by_symbol = {row["symbol"]: row for row in status}
    core_universe = []
    missing_core_symbols = []
    for row in CORE_RESEARCH_UNIVERSE:
        watchlist_status = status_by_symbol.get(row["symbol"])
        if watchlist_status is None:
            missing_core_symbols.append(row["symbol"])
        core_universe.append(
            {
                **row,
                "in_watchlist": watchlist_status is not None,
                "scan_readiness": watchlist_status.get("scan_readiness") if watchlist_status else "missing",
                "bar_count": int(watchlist_status.get("bar_count") or 0) if watchlist_status else 0,
                "latest_bar_date": watchlist_status.get("latest_bar_date") if watchlist_status else None,
                "signal_count": int(watchlist_status.get("signal_count") or 0) if watchlist_status else 0,
            }
        )
    return {
        "watchlist_count": len(status),
        "watchlist_status": status,
        "core_universe": core_universe,
        "missing_core_symbols": missing_core_symbols,
    }


def _source_rows() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT COALESCE(source, 'unknown') AS source,
                   COUNT(*) AS row_count,
                   COUNT(DISTINCT symbol) AS symbol_count,
                   MAX(date) AS latest_date
            FROM daily_bars
            GROUP BY COALESCE(source, 'unknown')
            ORDER BY row_count DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def _quality_counts() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT check_name, severity, COALESCE(resolution_status, 'open') AS resolution_status,
                   COUNT(*) AS count
            FROM data_quality_log
            GROUP BY check_name, severity, COALESCE(resolution_status, 'open')
            ORDER BY count DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]


def _rate_limit_policies() -> dict:
    return {
        "akshare": {
            "quota_status": "not_measured",
            "rate_limit_hint": "公共数据源，建议低频批量同步并观察失败率",
        },
        "tushare": {
            "quota_status": "credential_dependent",
            "rate_limit_hint": "额度由 TUSHARE_TOKEN 账户等级决定",
        },
        "auto": {
            "quota_status": "composite",
            "rate_limit_hint": "按 akshare -> tushare 顺序回退",
        },
    }


def _source_health() -> list[dict]:
    init_db()
    with get_connection() as conn:
        success_rows = conn.execute(
            """
            SELECT COALESCE(source, 'unknown') AS source,
                   MAX(updated_at) AS last_success_at,
                   MAX(date) AS latest_trade_date,
                   COUNT(*) AS row_count,
                   COUNT(DISTINCT symbol) AS symbol_count
            FROM daily_bars
            GROUP BY COALESCE(source, 'unknown')
            """
        ).fetchall()
        error_rows = conn.execute(
            """
            SELECT check_name,
                   MAX(created_at) AS last_error_at,
                   COUNT(*) AS error_count
            FROM data_quality_log
            WHERE severity IN ('warning', 'error')
              AND COALESCE(resolution_status, 'open') = 'open'
            GROUP BY check_name
            """
        ).fetchall()
    errors = {row["check_name"]: dict(row) for row in error_rows}
    health = []
    for row in success_rows:
        source = dict(row)
        data_sync_errors = errors.get("data_sync", {})
        health.append(
            {
                **source,
                "last_error_at": data_sync_errors.get("last_error_at"),
                "open_error_count": int(data_sync_errors.get("error_count") or 0),
                "status": "degraded" if data_sync_errors else "ok",
            }
        )
    if not health:
        health.append(
            {
                "source": "unknown",
                "last_success_at": None,
                "latest_trade_date": None,
                "row_count": 0,
                "symbol_count": 0,
                "last_error_at": errors.get("data_sync", {}).get("last_error_at"),
                "open_error_count": int(errors.get("data_sync", {}).get("error_count") or 0),
                "status": "no_data",
            }
        )
    return health


def _research_sources_payload() -> dict:
    return {
        "supported_sources": list(DATA_SOURCES),
        "active_source": os.getenv("TRADINGAGENTS_DATA_SOURCE", "akshare"),
        "rate_limit_policies": _rate_limit_policies(),
        "credential_readiness": [
            {
                "source": "tushare",
                "env": "TUSHARE_TOKEN",
                "configured": bool(os.getenv("TUSHARE_TOKEN")),
            },
            {
                "source": "akshare",
                "env": None,
                "configured": True,
            },
        ],
        "source_rows": _source_rows(),
        "source_health": _source_health(),
        "quality_counts": _quality_counts(),
        "operational_commands": [
            {
                "cli_command": "init-db",
                "api_endpoint": None,
                "method": None,
                "description": "初始化本地研究库 Schema",
            },
            {
                "cli_command": "add-watchlist",
                "api_endpoint": "/api/research/watchlist",
                "method": "POST",
                "description": "新增或更新自选股",
            },
            {
                "cli_command": "bootstrap-watchlist",
                "api_endpoint": "/api/research/watchlist/bootstrap",
                "method": "POST",
                "description": "补入茅台、平安、腾讯、快手等核心投研样本",
            },
            {
                "cli_command": "list-watchlist",
                "api_endpoint": "/api/research/watchlist",
                "method": "GET",
                "description": "查看自选池",
            },
            {
                "cli_command": "sync-bars",
                "api_endpoint": "/api/research/sync-bars",
                "method": "POST",
                "description": "同步自选池日线行情",
            },
            {
                "cli_command": "sync-indices",
                "api_endpoint": "/api/research/sync-indices",
                "method": "POST",
                "description": "同步沪深300、中证500、中证1000等宽基指数日线",
            },
            {
                "cli_command": "sync-fund-flow",
                "api_endpoint": "/api/research/fund-flow/sync",
                "method": "POST",
                "description": "同步资金流与北向资金",
            },
            {
                "cli_command": "compute-factors",
                "api_endpoint": "/api/research/factors/compute",
                "method": "POST",
                "description": "计算技术、流动性、资金流和周期因子",
            },
            {
                "cli_command": "data-quality",
                "api_endpoint": "/api/research/data-quality",
                "method": "GET",
                "description": "查看数据质量问题",
            },
            {
                "cli_command": "run-pipeline",
                "api_endpoint": "/api/research/pipeline/run",
                "method": "POST",
                "description": "一键运行同步、资金流、因子、信号扫描与回测诊断",
            },
        ],
    }


@router.get("/watchlist", response_model=ApiResponse)
async def get_watchlist():
    return ApiResponse(success=True, data=list_watchlist())


@router.post("/watchlist", response_model=ApiResponse)
async def add_watchlist_symbols(request: WatchlistRequest):
    upsert_watchlist_symbols(
        request.symbols,
        market=request.market,
        name=request.name,
        industry=request.industry,
        thesis=request.thesis,
        status=request.status,
    )
    return ApiResponse(success=True, data=list_watchlist())


@router.post("/watchlist/bootstrap", response_model=ApiResponse)
async def bootstrap_core_watchlist(request: BootstrapWatchlistRequest | None = None):
    inserted = ensure_core_watchlist_symbols(request.symbols if request else None)
    return ApiResponse(
        success=True,
        data={
            "inserted": inserted,
            **_status_payload(),
        },
    )


@router.delete("/watchlist/{symbol}", response_model=ApiResponse)
async def remove_watchlist_symbol(symbol: str):
    deactivate_watchlist_symbol(symbol)
    return ApiResponse(success=True, data=list_watchlist())


@router.get("/status", response_model=ApiResponse)
async def get_research_status():
    return ApiResponse(success=True, data=_status_payload())


@router.get("/sources", response_model=ApiResponse)
async def get_research_sources():
    return ApiResponse(success=True, data=_research_sources_payload())


@router.post("/sync-bars", response_model=ApiResponse)
async def sync_research_bars(request: SyncBarsRequest):
    start, end = _resolve_window(request.start, request.end)
    started = time.perf_counter()
    if request.source is None:
        rows_synced = sync_watchlist_bars(start, end)
    else:
        rows_synced = sync_watchlist_bars(start, end, source=request.source)
    _record_sync_trace(
        job_type="sync-bars",
        start=start,
        end=end,
        primary_source=request.source or os.getenv("TRADINGAGENTS_DATA_SOURCE", "akshare"),
        fallback_source="auto" if request.source in (None, "auto") else None,
        rows_written=rows_synced,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )
    return ApiResponse(
        success=True,
        data={
            "start": start,
            "end": end,
            "rows_synced": rows_synced,
            **_status_payload(),
        },
    )


@router.post("/sync-indices", response_model=ApiResponse)
async def sync_research_indices(request: SyncIndicesRequest):
    start, end = _resolve_window(request.start, request.end)
    started = time.perf_counter()
    rows_synced = sync_index_bars(
        start,
        end,
        index_symbols=request.index_symbols,
        source=request.source,
    )
    _record_sync_trace(
        job_type="sync-indices",
        start=start,
        end=end,
        symbol=",".join(request.index_symbols or []),
        primary_source=request.source or os.getenv("TRADINGAGENTS_DATA_SOURCE", "akshare"),
        fallback_source="auto" if request.source in (None, "auto") else None,
        rows_written=rows_synced,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )
    return ApiResponse(
        success=True,
        data={
            "start": start,
            "end": end,
            "rows_synced": rows_synced,
            "index_symbols": request.index_symbols,
            **_status_payload(),
        },
    )


@router.post("/fund-flow/sync", response_model=ApiResponse)
async def sync_research_fund_flow(request: SyncBarsRequest):
    start, end = _resolve_window(request.start, request.end)
    started = time.perf_counter()
    rows_synced = sync_watchlist_fund_flows(start, end)
    _record_sync_trace(
        job_type="sync-fund-flow",
        start=start,
        end=end,
        primary_source="akshare",
        rows_written=rows_synced,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )
    return ApiResponse(
        success=True,
        data={
            "start": start,
            "end": end,
            "fund_flow_rows": rows_synced,
            **_status_payload(),
        },
    )


@router.post("/factors/compute", response_model=ApiResponse)
async def compute_research_factors(request: SyncBarsRequest):
    start, end = _resolve_window(request.start, request.end)
    started = time.perf_counter()
    factor_rows = compute_watchlist_factors(start, end)
    _record_sync_trace(
        job_type="compute-factors",
        start=start,
        end=end,
        primary_source="local",
        rows_written=factor_rows,
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )
    return ApiResponse(
        success=True,
        data={
            "start": start,
            "end": end,
            "factor_rows": factor_rows,
            **_status_payload(),
        },
    )


@router.post("/pipeline/run", response_model=ApiResponse)
async def run_research_pipeline(request: ResearchPipelineRequest):
    start, end = _resolve_window(request.start, request.end)
    signal_date = request.signal_date or end
    started = time.perf_counter()
    bootstrapped = (
        ensure_core_watchlist_symbols()
        if request.bootstrap_core_symbols
        else []
    )
    result = run_pipeline(
        start,
        end,
        signal_date=signal_date,
        source=request.source,
        include_fund_flow=request.include_fund_flow,
    )
    run_id = uuid4().hex
    payload = {
        **result,
        **_status_payload(),
        "bootstrapped_symbols": [row["symbol"] for row in bootstrapped],
        "run_id": run_id,
        "created_at": _now(),
    }
    _record_sync_trace(
        job_type="run-pipeline",
        start=start,
        end=end,
        primary_source=request.source or "auto",
        fallback_source="auto",
        rows_written=int(result.get("rows_synced", 0) or 0)
        + int(result.get("fund_flow_rows", 0) or 0)
        + int(result.get("factor_rows", 0) or 0)
        + int(result.get("signal_count", 0) or 0),
        elapsed_ms=int((time.perf_counter() - started) * 1000),
    )
    _remember_pipeline_run(
        {
            "run_id": run_id,
            "created_at": payload["created_at"],
            "start": start,
            "end": end,
            "signal_date": signal_date,
            "source": request.source,
            "include_fund_flow": request.include_fund_flow,
            "bootstrapped_symbols": payload["bootstrapped_symbols"],
            "rows_synced": result.get("rows_synced", 0),
            "fund_flow_rows": result.get("fund_flow_rows", 0),
            "factor_rows": result.get("factor_rows", 0),
            "signal_count": result.get("signal_count", 0),
            "warning_count": len(result.get("warnings", [])),
        }
    )
    return ApiResponse(success=True, data=payload)


@router.get("/pipeline/history", response_model=ApiResponse)
async def get_pipeline_history():
    return ApiResponse(success=True, data={"runs": _read_list(_json_file("pipeline_runs.json"))})


@router.get("/data-quality", response_model=ApiResponse)
async def get_data_quality():
    return ApiResponse(success=True, data=list_quality_issues())


@router.post("/data-quality/resync", response_model=ApiResponse)
async def resync_data_quality_window(request: SyncBarsRequest):
    start, end = _resolve_window(request.start, request.end)
    rows_synced = sync_watchlist_bars(start, end, source=request.source)
    return ApiResponse(
        success=True,
        data={"start": start, "end": end, "source": request.source, "rows_synced": rows_synced},
    )


@router.post("/data-quality/{issue_id}/resolve", response_model=ApiResponse)
async def resolve_data_quality_issue(issue_id: int, request: QualityResolutionRequest):
    row = resolve_quality_issue(
        issue_id,
        resolution_status=request.resolution_status,
        resolution_note=request.resolution_note,
    )
    if row is None:
        return ApiResponse(success=False, error="Issue not found")
    return ApiResponse(success=True, data=row)


@router.get("/optimizer", response_model=ApiResponse)
async def get_optimizer_diagnostics(
    start: str = "2024-01-01",
    end: str = "2026-12-31",
):
    summary = summarize_signal_effectiveness()
    failures = summarize_failure_reasons()
    ablation_steps = list_ablation_steps()
    return ApiResponse(
        success=True,
        data={
            "summary": summary,
            "failures": failures,
            "ablation_steps": ablation_steps,
            "walk_forward_periods": split_walk_forward_periods(start, end),
            "candidate_yaml": generate_candidate_strategy_yaml(summary),
            "markdown": render_optimizer_report(summary, failures, ablation_steps),
        },
    )


def _safe_sweep_grid(grid: dict[str, list[int | float | str]] | None) -> dict:
    active_grid = grid or {"holding_days": [5, 20, 60]}
    grid_size = sum(1 for _ in iter_parameter_grid(active_grid))
    if grid_size > 50:
        raise ValueError("parameter grid is too large; keep combinations <= 50")
    return active_grid


def _overfit_diagnostics(sweep_results: list[dict], walk_forward: dict, score_key: str) -> dict:
    best_score = sweep_results[0].get("score") if sweep_results else None
    oos_scores = []
    oos_returns = []
    for fold in walk_forward.get("folds", []):
        metrics = (fold.get("oos") or {}).get("metrics") or {}
        score = metrics.get(score_key)
        if isinstance(score, (int, float)):
            oos_scores.append(float(score))
        total_return = metrics.get("total_return")
        if isinstance(total_return, (int, float)):
            oos_returns.append(float(total_return))
    oos_mean = sum(oos_scores) / len(oos_scores) if oos_scores else None
    degradation = None
    if isinstance(best_score, (int, float)) and oos_mean is not None and best_score != 0:
        degradation = (float(best_score) - oos_mean) / abs(float(best_score))
    positive_oos_rate = (
        sum(1 for value in oos_returns if value > 0) / len(oos_returns)
        if oos_returns
        else None
    )
    if not oos_scores:
        verdict = "insufficient_oos"
    elif degradation is not None and degradation > 0.6:
        verdict = "overfit_risk"
    elif positive_oos_rate is not None and positive_oos_rate < 0.5:
        verdict = "watch"
    else:
        verdict = "robust"
    return {
        "score_key": score_key,
        "best_in_sample_score": best_score,
        "oos_score_mean": oos_mean,
        "score_degradation": degradation,
        "positive_oos_rate": positive_oos_rate,
        "fold_count": walk_forward.get("fold_count", 0),
        "verdict": verdict,
        "warning": {
            "robust": "折外表现未显著恶化",
            "watch": "折外收益稳定性不足，需要扩大样本",
            "overfit_risk": "样本内外评分落差较大，存在过拟合风险",
            "insufficient_oos": "缺少折外评分，不能判断过拟合",
        }[verdict],
    }


@router.post("/optimizer/sweep", response_model=ApiResponse)
async def run_optimizer_sweep(request: OptimizerSweepRequest):
    try:
        active_grid = _safe_sweep_grid(request.grid)
    except ValueError as exc:
        return ApiResponse(success=False, error=str(exc))

    def backtest_fn(*, start: str, end: str, params: dict):
        holding_days = int(params.get("holding_days", 20))
        initial_cash = float(params.get("initial_cash", request.initial_cash))
        strategy_version = f"sweep_{holding_days}_{uuid4().hex[:8]}"
        return run_portfolio_backtest(
            start,
            end,
            strategy_version=strategy_version,
            initial_cash=initial_cash,
            holding_days=holding_days,
        )

    def sweep_fn(start: str, end: str):
        return run_parameter_sweep(
            start,
            end,
            backtest_fn,
            grid=active_grid,
            score_key=request.score_key,
        )

    def oos_backtest(start: str, end: str, params: dict):
        return backtest_fn(start=start, end=end, params=params)

    sweep_results = sweep_fn(request.start, request.end)
    walk_forward = run_walk_forward(
        request.start,
        request.end,
        sweep_fn=sweep_fn,
        backtest_fn=oos_backtest,
        folds=request.folds,
    )
    overfit_diagnostics = _overfit_diagnostics(
        sweep_results,
        walk_forward,
        request.score_key,
    )
    return ApiResponse(
        success=True,
        data={
            "start": request.start,
            "end": request.end,
            "grid": active_grid,
            "score_key": request.score_key,
            "sweep_results": sweep_results,
            "best": sweep_results[0] if sweep_results else None,
            "walk_forward": walk_forward,
            "overfit_diagnostics": overfit_diagnostics,
        },
    )


@router.get("/optimizer/candidates", response_model=ApiResponse)
async def list_optimizer_candidates():
    return ApiResponse(success=True, data={"candidates": _read_list(_candidate_path())})


@router.post("/optimizer/candidates", response_model=ApiResponse)
async def create_optimizer_candidate(request: OptimizerCandidateRequest):
    candidate = {
        "candidate_id": uuid4().hex,
        "name": request.name,
        "candidate_yaml": request.candidate_yaml,
        "status": "draft",
        "created_at": _now(),
        "applied_at": None,
    }
    candidates = _read_list(_candidate_path())
    candidates.insert(0, candidate)
    _write_list(_candidate_path(), candidates)
    return ApiResponse(success=True, data=candidate)


@router.post("/optimizer/candidates/{candidate_id}/apply", response_model=ApiResponse)
async def apply_optimizer_candidate(candidate_id: str):
    candidates = _read_list(_candidate_path())
    selected = None
    for candidate in candidates:
        if candidate.get("candidate_id") == candidate_id:
            candidate["status"] = "applied"
            candidate["applied_at"] = _now()
            selected = candidate
        elif candidate.get("status") == "applied":
            candidate["status"] = "superseded"
    if selected is None:
        return ApiResponse(success=False, error="Candidate not found")
    _write_list(_candidate_path(), candidates)
    active_path = _json_file("active_strategy.yml")
    active_path.write_text(selected["candidate_yaml"], encoding="utf-8")
    return ApiResponse(success=True, data={**selected, "active_path": str(active_path)})
