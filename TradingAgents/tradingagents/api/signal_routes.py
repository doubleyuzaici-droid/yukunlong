from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from tradingagents.api.schemas import ApiResponse
from tradingagents.research.repository import list_signals, list_today_signals
from tradingagents.research.signals.scanner import persist_signals, scan_watchlist

router = APIRouter(prefix="/api/signals", tags=["signals"])


class SignalScanRequest(BaseModel):
    date: str = Field(..., description="Scan date in YYYY-MM-DD format")


@router.post("/scan", response_model=ApiResponse)
async def scan_signals(request: SignalScanRequest):
    signals = scan_watchlist(request.date)
    persist_signals(signals)
    return ApiResponse(
        success=True,
        data={
            "date": request.date,
            "count": len(signals),
            "signals": [
                signal.__dict__ | {"signal_id": signal.signal_id} for signal in signals
            ],
        },
    )


@router.get("/today", response_model=ApiResponse)
async def get_today_signals(
    date_value: str = Query(
        default_factory=lambda: date.today().isoformat(),
        alias="date",
        description="Signal date in YYYY-MM-DD format",
    ),
):
    return ApiResponse(success=True, data=list_today_signals(date_value))


@router.get("/{symbol}", response_model=ApiResponse)
async def get_symbol_signals(symbol: str, start: str, end: str):
    return ApiResponse(success=True, data=list_signals(symbol, start, end))
