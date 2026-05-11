from __future__ import annotations

from pathlib import Path

from tradingagents.research.db import get_data_dir

from .markdown_renderer import render_daily_report
from .signal_summary import summarize_daily_signals


def generate_daily_report(date: str) -> str:
    return render_daily_report(summarize_daily_signals(date))


def get_daily_report_path(date: str) -> Path:
    return get_data_dir() / "reports" / f"daily_report_{date}.md"


def save_daily_report(date: str) -> Path:
    path = get_daily_report_path(date)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(generate_daily_report(date), encoding="utf-8")
    return path
