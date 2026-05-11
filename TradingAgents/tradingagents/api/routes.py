from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse, FileResponse
from sse_starlette.sse import EventSourceResponse

from tradingagents.default_config import DEFAULT_CONFIG
from .schemas import (
    AnalyzeRequest,
    ApiResponse,
    HistoryItem,
    MarketProfile,
    TaskProgress,
    TaskReport,
)
from .task_manager import TaskManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


@router.post("/analyze", response_model=ApiResponse)
async def start_analysis(request: AnalyzeRequest):
    """提交分析任务，返回 task_id。"""
    manager = TaskManager.get_instance()
    task_id = manager.create_task(request)
    return ApiResponse(success=True, data={"task_id": task_id})


@router.get("/tasks/{task_id}", response_model=ApiResponse)
async def get_task_progress(task_id: str):
    """获取任务进度。"""
    manager = TaskManager.get_instance()
    progress = manager.get_progress(task_id)
    if progress is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return ApiResponse(success=True, data=progress.model_dump())


@router.get("/tasks/{task_id}/stream")
async def stream_task_progress(task_id: str, request: Request):
    """SSE 实时推送任务进度。"""
    manager = TaskManager.get_instance()

    async def event_generator():
        last_msg_count = 0
        while True:
            if await request.is_disconnected():
                break

            progress = manager.get_progress(task_id)
            if progress is None:
                break

            # 发送新消息
            current_msgs = progress.messages
            while last_msg_count < len(current_msgs):
                msg = current_msgs[last_msg_count]
                yield {
                    "event": "message",
                    "data": json.dumps(msg, ensure_ascii=False),
                }
                last_msg_count += 1

            # 发送状态更新 (包含 stages, token_stats, report_html)
            stages_data = []
            if progress.stages:
                stages_data = [
                    {
                        "key": s.key,
                        "label": s.label,
                        "status": s.status.value if s.status else "pending",
                        "agents": s.agents,
                    }
                    for s in progress.stages
                ]

            token_data = None
            if progress.token_stats:
                ts = progress.token_stats
                token_data = {
                    "input_tokens": ts.input_tokens,
                    "output_tokens": ts.output_tokens,
                    "llm_calls": ts.llm_calls,
                    "tool_calls": ts.tool_calls,
                }

            yield {
                "event": "status",
                "data": json.dumps({
                    "status": progress.status.value,
                    "current_step": progress.current_step,
                    "current_stage_key": progress.current_stage_key,
                    "stages": stages_data,
                    "token_stats": token_data,
                    "current_report_html": progress.current_report_html or "",
                }, ensure_ascii=False),
            }

            if progress.status.value in ("completed", "failed"):
                break

            await asyncio.sleep(0.5)

    return EventSourceResponse(event_generator())


@router.get("/tasks/{task_id}/report", response_model=ApiResponse)
async def get_task_report(task_id: str):
    """获取分析报告。"""
    manager = TaskManager.get_instance()
    report = manager.get_report(task_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return ApiResponse(success=True, data=report)


@router.get("/tasks/{task_id}/download")
async def download_report(task_id: str):
    """下载分析报告文件。"""
    manager = TaskManager.get_instance()
    report = manager.get_report(task_id)
    if report is None:
        raise HTTPException(status_code=404, detail="Report not found")
    saved_path = report.get("saved_path", "")
    if not saved_path or not Path(saved_path).exists():
        raise HTTPException(status_code=404, detail="Report file not found on disk")
    filename = f"{report.get('ticker','report')}_{report.get('trade_date','')}.md"
    return FileResponse(
        path=saved_path,
        media_type="text/markdown; charset=utf-8",
        filename=filename,
    )


@router.get("/history", response_model=ApiResponse)
async def get_history():
    """获取历史分析记录。"""
    results_dir = Path(DEFAULT_CONFIG["results_dir"])
    items: list[dict] = []
    if results_dir.exists():
        for ticker_dir in sorted(results_dir.iterdir()):
            if not ticker_dir.is_dir():
                continue
            logs_dir = ticker_dir / "TradingAgentsStrategy_logs"
            if not logs_dir.exists():
                continue
            for log_file in sorted(logs_dir.glob("full_states_log_*.json"), reverse=True):
                trade_date = log_file.stem.replace("full_states_log_", "")
                stat = log_file.stat()
                items.append({
                    "ticker": ticker_dir.name,
                    "trade_date": trade_date,
                    "file_path": str(log_file),
                    "created_at": None,
                })
    return ApiResponse(success=True, data=items[:50])
