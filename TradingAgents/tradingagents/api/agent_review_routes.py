from __future__ import annotations

from fastapi import APIRouter, HTTPException

from tradingagents.agents.review.performance import summarize_review_performance
from tradingagents.agents.review.signal_reviewer import get_review, review_signal
from tradingagents.api.schemas import ApiResponse

router = APIRouter(tags=["agent-reviews"])


@router.post("/api/signals/{signal_id}/agent-review", response_model=ApiResponse)
async def create_agent_review(signal_id: str):
    return ApiResponse(success=True, data=review_signal(signal_id))


@router.get("/api/agent-reviews/performance", response_model=ApiResponse)
async def fetch_agent_review_performance():
    return ApiResponse(success=True, data=summarize_review_performance())


@router.get("/api/agent-reviews/{review_id}", response_model=ApiResponse)
async def fetch_agent_review(review_id: str):
    review = get_review(review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return ApiResponse(success=True, data=review)
