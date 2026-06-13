from __future__ import annotations

from datetime import datetime, timezone
from uuid import uuid4

from fastapi import APIRouter
from pydantic import BaseModel, Field

from tradingagents.api.schemas import ApiResponse
from tradingagents.backtest.resonance_v2_backtester import run_resonance_v2_backtest
from tradingagents.strategies.resonance_v2 import (
    analyze_resonance_v2,
    generate_resonance_v2_signal,
)

router = APIRouter(prefix="/api/strategies", tags=["strategies"])


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


class ResonanceV2SignalRequest(BaseModel):
    symbol: str
    start: str
    end: str
    mode: str = "conservative"
    capital: float = Field(default=1_000_000, gt=0)
    persist: bool = True


class ResonanceV2BacktestRequest(BaseModel):
    symbol: str
    start: str
    end: str
    mode: str = "aggressive"
    initial_cash: float = Field(default=1_000_000, gt=0)
    risk_pct: float = Field(default=0.01, gt=0, le=0.05)


@router.get("/resonance-v2/analyze", response_model=ApiResponse)
async def get_resonance_v2_analysis(
    symbol: str,
    start: str,
    end: str,
    mode: str = "conservative",
    capital: float = 1_000_000,
):
    try:
        payload = analyze_resonance_v2(
            symbol,
            start,
            end,
            mode=mode,
            capital=capital,
        )
    except ValueError as exc:
        return ApiResponse(success=False, error=str(exc))
    return ApiResponse(success=True, data=payload)


@router.post("/resonance-v2/signal", response_model=ApiResponse)
async def create_resonance_v2_signal(request: ResonanceV2SignalRequest):
    try:
        payload = generate_resonance_v2_signal(
            request.symbol,
            request.start,
            request.end,
            mode=request.mode,
            capital=request.capital,
            persist=request.persist,
        )
    except ValueError as exc:
        return ApiResponse(success=False, error=str(exc))
    return ApiResponse(success=True, data=payload)


@router.post("/resonance-v2/backtest", response_model=ApiResponse)
async def run_resonance_v2_backtest_route(request: ResonanceV2BacktestRequest):
    try:
        result = run_resonance_v2_backtest(
            request.symbol,
            request.start,
            request.end,
            mode=request.mode,
            initial_cash=request.initial_cash,
            risk_pct=request.risk_pct,
        )
    except ValueError as exc:
        return ApiResponse(success=False, error=str(exc))
    payload = {
        "kind": "resonance_v2",
        "backtest_id": uuid4().hex,
        "created_at": _now(),
        "start": request.start,
        "end": request.end,
        "result": result,
    }
    return ApiResponse(success=True, data=payload)
