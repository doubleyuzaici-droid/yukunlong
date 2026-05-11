from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from tradingagents.api.schemas import ApiResponse
from tradingagents.optimizer.ablation_test import list_ablation_steps
from tradingagents.optimizer.candidate_generator import generate_candidate_strategy_yaml
from tradingagents.optimizer.diagnostics import (
    summarize_failure_reasons,
    summarize_signal_effectiveness,
)
from tradingagents.optimizer.optimizer_report import render_optimizer_report
from tradingagents.optimizer.walk_forward import split_walk_forward_periods
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
