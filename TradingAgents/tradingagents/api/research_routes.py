from __future__ import annotations

from datetime import date, timedelta

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
from tradingagents.optimizer.walk_forward import split_walk_forward_periods
from tradingagents.research.data_sync import sync_watchlist_bars
from tradingagents.research.pipeline import run_pipeline
from tradingagents.research.pipeline_status import get_watchlist_status
from tradingagents.research.quality import list_quality_issues
from tradingagents.research.repository import (
    deactivate_watchlist_symbol,
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


class SyncBarsRequest(BaseModel):
    start: str | None = None
    end: str | None = None
    source: str | None = Field(default=None, pattern="^(akshare|tushare|auto)$")


class ResearchPipelineRequest(SyncBarsRequest):
    signal_date: str | None = None
    include_fund_flow: bool = True


def _resolve_window(start: str | None, end: str | None) -> tuple[str, str]:
    resolved_end = end or date.today().isoformat()
    if start:
        return start, resolved_end
    parsed_end = date.fromisoformat(resolved_end)
    return (parsed_end - timedelta(days=548)).isoformat(), resolved_end


def _status_payload() -> dict:
    status = get_watchlist_status()
    return {
        "watchlist_count": len(status),
        "watchlist_status": status,
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


@router.delete("/watchlist/{symbol}", response_model=ApiResponse)
async def remove_watchlist_symbol(symbol: str):
    deactivate_watchlist_symbol(symbol)
    return ApiResponse(success=True, data=list_watchlist())


@router.get("/status", response_model=ApiResponse)
async def get_research_status():
    return ApiResponse(success=True, data=_status_payload())


@router.post("/sync-bars", response_model=ApiResponse)
async def sync_research_bars(request: SyncBarsRequest):
    start, end = _resolve_window(request.start, request.end)
    if request.source is None:
        rows_synced = sync_watchlist_bars(start, end)
    else:
        rows_synced = sync_watchlist_bars(start, end, source=request.source)
    return ApiResponse(
        success=True,
        data={
            "start": start,
            "end": end,
            "rows_synced": rows_synced,
            **_status_payload(),
        },
    )


@router.post("/pipeline/run", response_model=ApiResponse)
async def run_research_pipeline(request: ResearchPipelineRequest):
    start, end = _resolve_window(request.start, request.end)
    signal_date = request.signal_date or end
    result = run_pipeline(
        start,
        end,
        signal_date=signal_date,
        source=request.source,
        include_fund_flow=request.include_fund_flow,
    )
    return ApiResponse(success=True, data={**result, **_status_payload()})


@router.get("/data-quality", response_model=ApiResponse)
async def get_data_quality():
    return ApiResponse(success=True, data=list_quality_issues())


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
