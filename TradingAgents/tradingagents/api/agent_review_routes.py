from __future__ import annotations

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from tradingagents.agents.review.performance import summarize_review_performance
from tradingagents.agents.review.signal_reviewer import (
    get_review,
    list_reviews,
    review_signal,
    update_review_decision,
)
from tradingagents.api.schemas import ApiResponse

router = APIRouter(tags=["agent-reviews"])


class ReviewDecisionRequest(BaseModel):
    decision_status: str = Field(default="pending")
    decision_note: str | None = None


@router.post("/api/signals/{signal_id}/agent-review", response_model=ApiResponse)
async def create_agent_review(signal_id: str):
    return ApiResponse(success=True, data=review_signal(signal_id))


@router.get("/api/agent-reviews/performance", response_model=ApiResponse)
async def fetch_agent_review_performance():
    return ApiResponse(success=True, data=summarize_review_performance())


@router.get("/api/agent-reviews", response_model=ApiResponse)
async def fetch_agent_reviews(signal_id: str | None = None, limit: int = 50):
    return ApiResponse(success=True, data=list_reviews(signal_id=signal_id, limit=limit))


@router.get("/api/agent-reviews/{review_id}", response_model=ApiResponse)
async def fetch_agent_review(review_id: str):
    review = get_review(review_id)
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return ApiResponse(success=True, data=review)


@router.patch("/api/agent-reviews/{review_id}/decision", response_model=ApiResponse)
async def update_agent_review_decision(review_id: str, request: ReviewDecisionRequest):
    review = update_review_decision(
        review_id,
        decision_status=request.decision_status,
        decision_note=request.decision_note,
    )
    if review is None:
        raise HTTPException(status_code=404, detail="Review not found")
    return ApiResponse(success=True, data=review)
