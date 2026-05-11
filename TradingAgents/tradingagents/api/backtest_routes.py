from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from tradingagents.api.schemas import ApiResponse
from tradingagents.backtest.event_backtester import run_event_backtest
from tradingagents.backtest.report import render_event_backtest_report

router = APIRouter(prefix="/api/backtests", tags=["backtests"])

_BACKTEST_RESULTS: dict[str, dict] = {}


class EventBacktestRequest(BaseModel):
    start: str
    end: str
    signal_names: list[str] | None = Field(default=None)
    markets: list[str] | None = Field(default=None)


@router.post("/event", response_model=ApiResponse)
async def run_event_backtest_route(request: EventBacktestRequest):
    result = run_event_backtest(request.signal_names, request.start, request.end)
    backtest_id = uuid4().hex
    payload = {"backtest_id": backtest_id, "result": result}
    _BACKTEST_RESULTS[backtest_id] = payload
    return ApiResponse(success=True, data=payload)


@router.get("/event/{backtest_id}", response_model=ApiResponse)
async def get_event_backtest(backtest_id: str):
    payload = _BACKTEST_RESULTS.get(backtest_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    return ApiResponse(success=True, data=payload)


@router.get("/event/{backtest_id}/report", response_model=ApiResponse)
async def get_event_backtest_report(backtest_id: str):
    payload = _BACKTEST_RESULTS.get(backtest_id)
    if payload is None:
        raise HTTPException(status_code=404, detail="Backtest not found")
    markdown = render_event_backtest_report(payload["result"])
    return ApiResponse(
        success=True, data={"backtest_id": backtest_id, "markdown": markdown}
    )
