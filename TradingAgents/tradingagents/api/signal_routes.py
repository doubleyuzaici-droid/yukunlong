from __future__ import annotations

from datetime import date

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from tradingagents.api.schemas import ApiResponse
from tradingagents.research.db import get_connection
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


@router.get("/history", response_model=ApiResponse)
async def get_signal_history(symbol: str, start: str, end: str):
    signals = list_signals(symbol, start, end)
    signal_ids = [row["signal_id"] for row in signals]
    events: dict[str, dict] = {}
    reviews: dict[str, dict] = {}
    if signal_ids:
        placeholders = ",".join("?" for _ in signal_ids)
        with get_connection() as conn:
            event_rows = conn.execute(
                f"SELECT * FROM event_return WHERE signal_id IN ({placeholders})",
                signal_ids,
            ).fetchall()
            review_rows = conn.execute(
                f"""
                SELECT
                    signal_id,
                    COUNT(*) AS review_count,
                    MAX(created_at) AS latest_review_at
                FROM agent_decision_log
                WHERE signal_id IN ({placeholders})
                GROUP BY signal_id
                """,
                signal_ids,
            ).fetchall()
        events = {row["signal_id"]: dict(row) for row in event_rows}
        reviews = {row["signal_id"]: dict(row) for row in review_rows}
    enriched = []
    for row in signals:
        review = reviews.get(row["signal_id"], {})
        enriched.append(
            {
                **row,
                "review_count": int(review.get("review_count") or 0),
                "latest_review_at": review.get("latest_review_at"),
                "event_return": events.get(row["signal_id"]),
            }
        )
    return ApiResponse(
        success=True,
        data={
            "symbol": symbol.strip().upper(),
            "start": start,
            "end": end,
            "total_count": len(enriched),
            "signals": enriched,
        },
    )


@router.get("/{symbol}", response_model=ApiResponse)
async def get_symbol_signals(symbol: str, start: str, end: str):
    return ApiResponse(success=True, data=list_signals(symbol, start, end))
