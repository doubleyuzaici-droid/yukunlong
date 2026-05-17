from __future__ import annotations

import json
import sqlite3
from pathlib import Path
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from tradingagents.agents.utils.memory import TradingMemoryLog
from tradingagents.api.schemas import AnalyzeRequest, ApiResponse
from tradingagents.api.task_manager import TaskManager
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.graph.checkpointer import clear_all_checkpoints, clear_checkpoint, thread_id

router = APIRouter(tags=["operability"])


class CheckpointResumeRequest(BaseModel):
    market_profile: str = "us"
    research_depth: str = "medium"
    selected_analysts: list[str] = ["market", "fundamentals", "news", "social"]
    llm_provider: str = "openai"
    deep_think_llm: str = "gpt-5.4"
    quick_think_llm: str = "gpt-5.4-mini"
    backend_url: str | None = None
    api_key: str | None = None
    output_language: str = "Simplified Chinese"
    openai_reasoning_effort: str | None = None
    anthropic_effort: str | None = None
    google_thinking_level: str | None = None
    deepseek_thinking: str | None = None


def _parse_metadata_step(raw: Any) -> int | None:
    if raw is None:
        return None
    if isinstance(raw, bytes):
        try:
            raw = raw.decode("utf-8")
        except UnicodeDecodeError:
            return None
    if isinstance(raw, str):
        try:
            parsed = json.loads(raw)
        except json.JSONDecodeError:
            return None
        step = parsed.get("step") if isinstance(parsed, dict) else None
        return int(step) if isinstance(step, int) else None
    return None


def _checkpoint_dir() -> Path:
    return Path(DEFAULT_CONFIG["data_cache_dir"]) / "checkpoints"


def _checkpoint_summary(db_path: Path) -> dict:
    checkpoint_count = 0
    thread_count = 0
    latest_checkpoint_id = None
    try:
        with sqlite3.connect(db_path) as conn:
            row = conn.execute(
                """
                SELECT
                    COUNT(*) AS checkpoint_count,
                    COUNT(DISTINCT thread_id) AS thread_count,
                    MAX(checkpoint_id) AS latest_checkpoint_id
                FROM checkpoints
                """
            ).fetchone()
        if row:
            checkpoint_count = int(row[0] or 0)
            thread_count = int(row[1] or 0)
            latest_checkpoint_id = row[2]
    except sqlite3.Error:
        pass
    stat = db_path.stat()
    return {
        "ticker": db_path.stem,
        "path": str(db_path),
        "size_bytes": stat.st_size,
        "updated_at": stat.st_mtime,
        "checkpoint_count": checkpoint_count,
        "thread_count": thread_count,
        "latest_checkpoint_id": latest_checkpoint_id,
    }


def _checkpoint_status(ticker: str, trade_date: str) -> dict:
    db_path = _checkpoint_dir() / f"{ticker.upper()}.db"
    tid = thread_id(ticker, trade_date)
    row = None
    if db_path.exists():
        try:
            with sqlite3.connect(db_path) as conn:
                row = conn.execute(
                    """
                    SELECT checkpoint_id, metadata
                    FROM checkpoints
                    WHERE thread_id = ?
                    ORDER BY checkpoint_id DESC
                    LIMIT 1
                    """,
                    (tid,),
                ).fetchone()
        except sqlite3.Error:
            row = None
    return {
        "ticker": ticker.upper(),
        "trade_date": trade_date,
        "thread_id": tid,
        "has_checkpoint": row is not None,
        "checkpoint_id": row[0] if row else None,
        "step": _parse_metadata_step(row[1]) if row else None,
    }


@router.get("/api/memory", response_model=ApiResponse)
async def fetch_memory_entries():
    log = TradingMemoryLog(DEFAULT_CONFIG)
    entries = list(reversed(log.load_entries()))
    pending_count = sum(1 for entry in entries if entry.get("pending"))
    return ApiResponse(
        success=True,
        data={
            "memory_log_path": DEFAULT_CONFIG.get("memory_log_path"),
            "pending_count": pending_count,
            "resolved_count": len(entries) - pending_count,
            "entries": entries,
        },
    )


@router.get("/api/checkpoints", response_model=ApiResponse)
async def list_checkpoints():
    cp_dir = _checkpoint_dir()
    checkpoints = []
    if cp_dir.exists():
        checkpoints = [_checkpoint_summary(db) for db in sorted(cp_dir.glob("*.db"))]
    return ApiResponse(success=True, data={"checkpoints": checkpoints})


@router.get("/api/checkpoints/{ticker}/{trade_date}", response_model=ApiResponse)
async def fetch_checkpoint_status(ticker: str, trade_date: str):
    return ApiResponse(success=True, data=_checkpoint_status(ticker, trade_date))


@router.delete("/api/checkpoints/{ticker}/{trade_date}", response_model=ApiResponse)
async def clear_one_checkpoint(ticker: str, trade_date: str):
    before = _checkpoint_status(ticker, trade_date)
    clear_checkpoint(DEFAULT_CONFIG["data_cache_dir"], ticker, trade_date)
    after = _checkpoint_status(ticker, trade_date)
    return ApiResponse(
        success=True,
        data={
            **after,
            "cleared": before["has_checkpoint"] and not after["has_checkpoint"],
        },
    )


@router.delete("/api/checkpoints", response_model=ApiResponse)
async def clear_every_checkpoint():
    deleted = clear_all_checkpoints(DEFAULT_CONFIG["data_cache_dir"])
    return ApiResponse(success=True, data={"deleted": deleted})


@router.post("/api/checkpoints/{ticker}/{trade_date}/resume", response_model=ApiResponse)
async def resume_from_checkpoint(
    ticker: str,
    trade_date: str,
    request: CheckpointResumeRequest,
):
    analysis_request = AnalyzeRequest(
        ticker=ticker,
        trade_date=trade_date,
        market_profile=request.market_profile,
        research_depth=request.research_depth,
        selected_analysts=request.selected_analysts,
        llm_provider=request.llm_provider,
        deep_think_llm=request.deep_think_llm,
        quick_think_llm=request.quick_think_llm,
        backend_url=request.backend_url,
        api_key=request.api_key,
        output_language=request.output_language,
        openai_reasoning_effort=request.openai_reasoning_effort,
        anthropic_effort=request.anthropic_effort,
        google_thinking_level=request.google_thinking_level,
        deepseek_thinking=request.deepseek_thinking,
        checkpoint_enabled=True,
        clear_checkpoint_before_run=False,
    )
    task_id = TaskManager.get_instance().create_task(analysis_request)
    return ApiResponse(
        success=True,
        data={
            "task_id": task_id,
            "ticker": ticker.upper(),
            "trade_date": trade_date,
            "thread_id": thread_id(ticker, trade_date),
            "checkpoint_enabled": True,
        },
    )
