from __future__ import annotations

import json
import math
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from tradingagents.api.schemas import ApiResponse
from tradingagents.backtest.event_backtester import run_event_backtest
from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
from tradingagents.backtest.report import (
    render_event_backtest_report,
    render_portfolio_backtest_report,
)
from tradingagents.research.db import get_data_dir

router = APIRouter(prefix="/api/backtests", tags=["backtests"])

_BACKTEST_RESULTS: dict[str, dict] = {}
_PORTFOLIO_BACKTEST_RESULTS: dict[str, dict] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _registry_path() -> Path:
    path = get_data_dir() / "backtests" / "history.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    return path


def _json_safe(value):
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, dict):
        return {key: _json_safe(item) for key, item in value.items()}
    if isinstance(value, list):
        return [_json_safe(item) for item in value]
    return value


def _load_registry() -> dict[str, dict]:
    path = _registry_path()
    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    return data if isinstance(data, dict) else {}


def _save_registry(registry: dict[str, dict]) -> None:
    path = _registry_path()
    path.write_text(
        json.dumps(_json_safe(registry), ensure_ascii=False, indent=2),
        encoding="utf-8",
    )


def _remember_backtest(payload: dict) -> None:
    registry = _load_registry()
    registry[payload["backtest_id"]] = payload
    _save_registry(registry)


def _all_payloads() -> dict[str, dict]:
    payloads = _load_registry()
    payloads.update(_BACKTEST_RESULTS)
    payloads.update(_PORTFOLIO_BACKTEST_RESULTS)
    return payloads


def _find_payload(backtest_id: str, kind: str | None = None) -> dict | None:
    payload = _BACKTEST_RESULTS.get(backtest_id) or _PORTFOLIO_BACKTEST_RESULTS.get(
        backtest_id
    )
    if payload is None:
        payload = _load_registry().get(backtest_id)
    if payload is None:
        return None
    if kind and payload.get("kind") != kind:
        return None
    return payload


class EventBacktestRequest(BaseModel):
    start: str
    end: str
    signal_names: list[str] | None = Field(default=None)
    markets: list[str] | None = Field(default=None)


class PortfolioBacktestRequest(BaseModel):
    start: str
    end: str
    strategy_version: str = "portfolio_v1"
    initial_cash: float = Field(default=1_000_000, gt=0)
    holding_days: int = Field(default=20, ge=1, le=252)
    slippage_bps: float = Field(default=2.0, ge=0, le=100)
    max_position_pct: float = Field(default=0.10, gt=0, le=1)


@router.post("/event", response_model=ApiResponse)
async def run_event_backtest_route(request: EventBacktestRequest):
    result = run_event_backtest(request.signal_names, request.start, request.end)
    backtest_id = uuid4().hex
    payload = {
        "kind": "event",
        "backtest_id": backtest_id,
        "created_at": _now(),
        "start": request.start,
        "end": request.end,
        "result": result,
    }
    _BACKTEST_RESULTS[backtest_id] = payload
    _remember_backtest(payload)
    return ApiResponse(success=True, data=payload)


@router.get("/event/{backtest_id}", response_model=ApiResponse)
async def get_event_backtest(backtest_id: str):
    payload = _find_payload(backtest_id, "event")
    if payload is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return ApiResponse(success=True, data=payload)


@router.get("/event/{backtest_id}/report", response_model=ApiResponse)
async def get_event_backtest_report(backtest_id: str):
    payload = _find_payload(backtest_id, "event")
    if payload is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    markdown = render_event_backtest_report(payload["result"])
    return ApiResponse(
        success=True, data={"backtest_id": backtest_id, "markdown": markdown}
    )


@router.get("/history", response_model=ApiResponse)
async def list_backtest_history():
    runs = []
    for payload in _all_payloads().values():
        result = payload["result"]
        if payload.get("kind") == "event":
            runs.append(
                {
                    "kind": "event",
                    "backtest_id": payload["backtest_id"],
                    "created_at": payload.get("created_at"),
                    "start": payload.get("start") or result.get("start"),
                    "end": payload.get("end") or result.get("end"),
                    "sample_count": len(result.get("events", [])),
                    "failure_count": len(result.get("failures", [])),
                    "summary_count": len(result.get("summary", [])),
                }
            )
        elif payload.get("kind") == "portfolio":
            metrics = result.get("metrics", {})
            runs.append(
                {
                    "kind": "portfolio",
                    "backtest_id": payload["backtest_id"],
                    "created_at": payload.get("created_at"),
                    "start": payload.get("start"),
                    "end": payload.get("end"),
                    "trade_count": metrics.get("trade_count", 0),
                    "total_return": metrics.get("total_return", 0),
                    "max_drawdown": metrics.get("max_drawdown", 0),
                    "strategy_version": result.get("strategy_version"),
                }
            )
    runs.sort(key=lambda item: item.get("created_at") or "", reverse=True)
    return ApiResponse(success=True, data={"runs": runs})


@router.post("/portfolio", response_model=ApiResponse)
async def run_portfolio_backtest_route(request: PortfolioBacktestRequest):
    result = run_portfolio_backtest(
        request.start,
        request.end,
        strategy_version=request.strategy_version,
        initial_cash=request.initial_cash,
        holding_days=request.holding_days,
        slippage_bps=request.slippage_bps,
        max_position_pct=request.max_position_pct,
    )
    backtest_id = uuid4().hex
    payload = {
        "kind": "portfolio",
        "backtest_id": backtest_id,
        "created_at": _now(),
        "start": request.start,
        "end": request.end,
        "result": result,
    }
    _PORTFOLIO_BACKTEST_RESULTS[backtest_id] = payload
    _remember_backtest(payload)
    return ApiResponse(success=True, data=payload)


@router.get("/portfolio/{backtest_id}", response_model=ApiResponse)
async def get_portfolio_backtest(backtest_id: str):
    payload = _find_payload(backtest_id, "portfolio")
    if payload is None:
        raise HTTPException(status_code=404, detail="Portfolio backtest not found")
    return ApiResponse(success=True, data=payload)


@router.get("/portfolio/{backtest_id}/report", response_model=ApiResponse)
async def get_portfolio_backtest_report(backtest_id: str):
    payload = _find_payload(backtest_id, "portfolio")
    if payload is None:
        raise HTTPException(status_code=404, detail="Portfolio backtest not found")
    markdown = render_portfolio_backtest_report(payload["result"])
    return ApiResponse(
        success=True, data={"backtest_id": backtest_id, "markdown": markdown}
    )


@router.get("/portfolio/{backtest_id}/download")
async def download_portfolio_backtest_report(backtest_id: str):
    payload = _find_payload(backtest_id, "portfolio")
    if payload is None:
        raise HTTPException(status_code=404, detail="Portfolio backtest not found")
    markdown = render_portfolio_backtest_report(payload["result"])
    return Response(
        content=markdown,
        media_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": f'attachment; filename="portfolio-backtest-{backtest_id}.md"'
        },
    )
