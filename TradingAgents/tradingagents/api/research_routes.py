from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from tradingagents.api.schemas import ApiResponse
from tradingagents.optimizer.candidate_generator import generate_candidate_strategy_yaml
from tradingagents.optimizer.diagnostics import summarize_signal_effectiveness
from tradingagents.optimizer.optimizer_report import render_optimizer_report
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


@router.get("/data-quality", response_model=ApiResponse)
async def get_data_quality():
    return ApiResponse(success=True, data=list_quality_issues())


@router.get("/optimizer", response_model=ApiResponse)
async def get_optimizer_diagnostics():
    summary = summarize_signal_effectiveness()
    return ApiResponse(
        success=True,
        data={
            "summary": summary,
            "candidate_yaml": generate_candidate_strategy_yaml(summary),
            "markdown": render_optimizer_report(summary),
        },
    )
