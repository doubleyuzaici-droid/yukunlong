from __future__ import annotations

from fastapi import APIRouter, Query

from tradingagents.api.schemas import ApiResponse
from tradingagents.research.market_data import (
    get_market_context,
    get_market_history,
    get_market_pulse,
    list_market_quotes,
)
from tradingagents.research.realtime_market import (
    get_intraday_minutes,
    list_realtime_quotes,
)

router = APIRouter(prefix="/api/market", tags=["market"])


@router.get("/quotes", response_model=ApiResponse)
async def get_quotes(
    symbols: str = Query(
        ...,
        description="Comma or space separated symbols, e.g. 600519.SH,00700.HK,AAPL",
    ),
):
    return ApiResponse(success=True, data=list_market_quotes(symbols))


@router.get("/realtime/quotes", response_model=ApiResponse)
async def get_realtime_quotes(
    symbols: str = Query(
        ...,
        description="Comma or space separated symbols, e.g. 600519.SH,00700.HK",
    ),
    allow_fallback: bool = True,
):
    return ApiResponse(
        success=True,
        data=list_realtime_quotes(symbols, allow_fallback=allow_fallback),
    )


@router.get("/realtime/intraday", response_model=ApiResponse)
async def get_realtime_intraday(symbol: str, allow_fallback: bool = True):
    return ApiResponse(
        success=True,
        data=get_intraday_minutes(symbol, allow_fallback=allow_fallback),
    )


@router.get("/history", response_model=ApiResponse)
async def get_history(
    symbol: str,
    start: str | None = None,
    end: str | None = None,
    limit: int = Query(default=180, ge=1, le=1000),
):
    return ApiResponse(
        success=True,
        data=get_market_history(symbol, start=start, end=end, limit=limit),
    )


@router.get("/pulse", response_model=ApiResponse)
async def get_pulse(symbols: str | None = None):
    return ApiResponse(success=True, data=get_market_pulse(symbols))


@router.get("/context", response_model=ApiResponse)
async def get_context(
    symbol: str,
    start: str | None = None,
    end: str | None = None,
    limit: int = Query(default=120, ge=1, le=500),
):
    return ApiResponse(
        success=True,
        data=get_market_context(symbol, start=start, end=end, limit=limit),
    )
