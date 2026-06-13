from __future__ import annotations

import asyncio
import json
import logging
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from tradingagents.default_config import DEFAULT_CONFIG
from .schemas import (
    AnalyzeRequest,
    ApiResponse,
)
from .task_manager import TaskManager

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api")


def _display_ticker(folder_name: str) -> str:
    if folder_name.endswith("_SH") or folder_name.endswith("_SZ"):
        return f"{folder_name[:-3]}.{folder_name[-2:]}"
    if folder_name.endswith("_HK"):
        return f"{folder_name[:-3]}.HK"
    return folder_name


def _report_folder(ticker: str) -> Path:
    safe_ticker = ticker.replace(".", "_")
    return Path(DEFAULT_CONFIG["results_dir"]) / safe_ticker / "TradingAgentsStrategy_logs"


def _history_report_path(ticker: str, trade_date: str) -> Path:
    return _report_folder(ticker) / f"report_{trade_date}.md"


SECTION_ALIASES = {
    "市场技术面分析": "market_report",
    "市场技术面": "market_report",
    "社交媒体情绪": "sentiment_report",
    "市场情绪": "sentiment_report",
    "新闻分析": "news_report",
    "新闻": "news_report",
    "基本面分析": "fundamentals_report",
    "基本面": "fundamentals_report",
    "多空研究辩论": "investment_debate_summary",
    "多空辩论": "investment_debate_summary",
    "投资计划": "investment_plan",
    "交易计划": "trader_investment_plan",
    "风险团队辩论": "risk_debate_summary",
    "风险辩论": "risk_debate_summary",
    "量化信号上下文": "quant_signal_context",
    "量化信号": "quant_signal_context",
    "最终决策": "final_trade_decision",
}


def _parse_history_report_sections(markdown: str) -> tuple[dict[str, str], dict[str, str]]:
    sections = {key: "" for key in set(SECTION_ALIASES.values())}
    current_key: str | None = None
    buffer: list[str] = []

    def flush() -> None:
        nonlocal buffer, current_key
        if current_key:
            sections[current_key] = "\n".join(buffer).strip()
        buffer = []

    for line in markdown.splitlines():
        if line.startswith("## "):
            flush()
            heading = line.replace("## ", "", 1).strip()
            current_key = SECTION_ALIASES.get(heading)
            continue
        if current_key:
            buffer.append(line)
    flush()
    status = {key: ("parsed" if value else "missing") for key, value in sections.items()}
    return sections, status


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


@router.get("/tasks", response_model=ApiResponse)
async def list_tasks(limit: int = 100):
    """获取当前服务内任务列表。"""
    manager = TaskManager.get_instance()
    return ApiResponse(success=True, data={"tasks": manager.list_tasks(limit)})


@router.post("/tasks/{task_id}/cancel", response_model=ApiResponse)
async def cancel_task(task_id: str):
    """标记任务取消；已进入底层 LLM 调用的任务会在后续状态中体现。"""
    manager = TaskManager.get_instance()
    task = manager.cancel_task(task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")
    return ApiResponse(success=True, data=task)


@router.post("/tasks/{task_id}/retry", response_model=ApiResponse)
async def retry_task(task_id: str):
    """按原始参数重新创建一个分析任务。"""
    manager = TaskManager.get_instance()
    new_task_id = manager.retry_task(task_id)
    if new_task_id is None:
        raise HTTPException(status_code=404, detail="Task request not found")
    return ApiResponse(success=True, data={"task_id": new_task_id})


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
                "data": json.dumps(
                    {
                        "status": progress.status.value,
                        "current_step": progress.current_step,
                        "current_stage_key": progress.current_stage_key,
                        "stages": stages_data,
                        "token_stats": token_data,
                        "tool_events": progress.tool_events,
                        "current_report_html": progress.current_report_html or "",
                    },
                    ensure_ascii=False,
                ),
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
            for log_file in sorted(
                logs_dir.glob("full_states_log_*.json"), reverse=True
            ):
                trade_date = log_file.stem.replace("full_states_log_", "")
                report_path = logs_dir / f"report_{trade_date}.md"
                items.append(
                    {
                        "ticker": _display_ticker(ticker_dir.name),
                        "trade_date": trade_date,
                        "file_path": str(log_file),
                        "report_path": str(report_path) if report_path.exists() else None,
                        "has_report": report_path.exists(),
                        "created_at": None,
                    }
                )
    return ApiResponse(success=True, data=items[:50])


@router.get("/history/{ticker}/{trade_date}/report", response_model=ApiResponse)
async def get_history_report(ticker: str, trade_date: str):
    """读取历史分析 Markdown 报告。"""
    report_path = _history_report_path(ticker, trade_date)
    if not report_path.exists() or not report_path.is_file():
        raise HTTPException(status_code=404, detail="History report not found")
    markdown = report_path.read_text(encoding="utf-8")
    sections, section_status = _parse_history_report_sections(markdown)
    return ApiResponse(
        success=True,
        data={
            "ticker": ticker,
            "trade_date": trade_date,
            "markdown": markdown,
            "sections": sections,
            "section_status": section_status,
            "saved_path": str(report_path),
        },
    )


@router.get("/history/{ticker}/{trade_date}/download")
async def download_history_report(ticker: str, trade_date: str):
    """下载历史分析 Markdown 报告。"""
    report_path = _history_report_path(ticker, trade_date)
    if not report_path.exists() or not report_path.is_file():
        raise HTTPException(status_code=404, detail="History report not found")
    filename = f"{ticker}_{trade_date}.md"
    return FileResponse(
        path=report_path,
        media_type="text/markdown; charset=utf-8",
        filename=filename,
    )
