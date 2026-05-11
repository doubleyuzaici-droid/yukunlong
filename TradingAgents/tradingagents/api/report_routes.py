from __future__ import annotations

from fastapi import APIRouter
from fastapi.responses import FileResponse

from tradingagents.api.schemas import ApiResponse
from tradingagents.research.reports.daily_report import (
    generate_daily_report,
    save_daily_report,
)

router = APIRouter(prefix="/api/reports", tags=["reports"])


@router.get("/daily", response_model=ApiResponse)
async def get_daily_report(date: str):
    return ApiResponse(
        success=True, data={"date": date, "markdown": generate_daily_report(date)}
    )


@router.get("/daily/download")
async def download_daily_report(date: str):
    path = save_daily_report(date)
    return FileResponse(
        path=path,
        media_type="text/markdown; charset=utf-8",
        filename=path.name,
    )
