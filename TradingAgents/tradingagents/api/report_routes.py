from __future__ import annotations

import html

from fastapi import APIRouter
from fastapi.responses import FileResponse, Response

from tradingagents.api.schemas import ApiResponse
from tradingagents.research.db import get_connection, get_data_dir, init_db
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


def _professional_daily_sections(date: str) -> dict:
    init_db()
    with get_connection() as conn:
        signals = conn.execute(
            """
            SELECT *
            FROM signal_log
            WHERE date = ?
            ORDER BY signal_level, score DESC, symbol
            """,
            (date,),
        ).fetchall()
        quality = conn.execute(
            """
            SELECT *
            FROM data_quality_log
            WHERE date = ?
              AND COALESCE(resolution_status, 'open') = 'open'
            ORDER BY severity DESC, created_at DESC
            """,
            (date,),
        ).fetchall()
        reviews = conn.execute(
            """
            SELECT *
            FROM agent_decision_log
            WHERE date = ?
            ORDER BY created_at DESC
            """,
            (date,),
        ).fetchall()
        watchlist_count = conn.execute(
            "SELECT COUNT(*) AS count FROM watchlist WHERE status = 'active'"
        ).fetchone()
    return {
        "signals": {"count": len(signals), "items": [dict(row) for row in signals]},
        "data_quality": {"open_issue_count": len(quality), "items": [dict(row) for row in quality]},
        "agent_reviews": {"count": len(reviews), "items": [dict(row) for row in reviews]},
        "universe": {"watchlist_count": int(watchlist_count["count"] or 0) if watchlist_count else 0},
    }


def _render_professional_daily_markdown(date: str, sections: dict) -> str:
    lines = [
        f"# 专业投研日报 {date}",
        "",
        "## 1. 投研覆盖",
        "",
        f"- 自选池标的：{sections['universe']['watchlist_count']}",
        f"- 当日信号：{sections['signals']['count']}",
        f"- Agent 审查：{sections['agent_reviews']['count']}",
        f"- 开放数据质量问题：{sections['data_quality']['open_issue_count']}",
        "",
        "## 2. 核心信号",
        "",
        "| 标的 | 信号 | 等级 | 方向 | 评分 | 策略 |",
        "|---|---|---:|---|---:|---|",
    ]
    for row in sections["signals"]["items"][:30]:
        lines.append(
            f"| {row.get('symbol', '-')} | {row.get('signal_name', '-')} | "
            f"{row.get('signal_level', '-')} | {row.get('direction', '-')} | "
            f"{row.get('score') or '-'} | {row.get('strategy_version') or '-'} |"
        )
    if not sections["signals"]["items"]:
        lines.append("| - | 无当日信号 | - | - | - | - |")
    lines.extend(["", "## 3. 数据质量", "", "| 标的 | 检查 | 严重度 | 信息 |", "|---|---|---|---|"])
    for row in sections["data_quality"]["items"][:20]:
        lines.append(
            f"| {row.get('symbol') or '-'} | {row.get('check_name', '-')} | "
            f"{row.get('severity', '-')} | {row.get('message', '-')} |"
        )
    if not sections["data_quality"]["items"]:
        lines.append("| - | 无开放问题 | - | - |")
    lines.extend(["", "## 4. Agent 审查闭环", "", "| 信号 | Action | 置信度 | 人工状态 | 摘要 |", "|---|---|---|---|---|"])
    for row in sections["agent_reviews"]["items"][:20]:
        lines.append(
            f"| {row.get('signal_id', '-')} | {row.get('action', '-')} | "
            f"{row.get('confidence', '-')} | {row.get('decision_status') or 'pending'} | "
            f"{row.get('review_summary', '-')} |"
        )
    if not sections["agent_reviews"]["items"]:
        lines.append("| - | 无审查 | - | - | - |")
    lines.extend(
        [
            "",
            "## 5. 披露",
            "",
            "- 本报告由本地研究库生成，所有行情、因子、新闻、审查结论应以数据血缘和同步 Trace 为准。",
            "- 内容仅用于研究与复盘，不构成投资建议或交易指令。",
        ]
    )
    return "\n".join(lines)


def _markdown_to_html_document(markdown: str, title: str) -> str:
    escaped = html.escape(markdown)
    return f"""<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>{html.escape(title)}</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 40px; color: #111827; line-height: 1.65; }}
    pre {{ white-space: pre-wrap; background: #f8fafc; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; }}
  </style>
</head>
<body>
  <pre>{escaped}</pre>
</body>
</html>"""


def _professional_daily_payload(date: str) -> dict:
    sections = _professional_daily_sections(date)
    markdown = _render_professional_daily_markdown(date, sections)
    html_doc = _markdown_to_html_document(markdown, f"专业投研日报 {date}")
    return {"date": date, "sections": sections, "markdown": markdown, "html": html_doc}


@router.get("/professional/daily", response_model=ApiResponse)
async def get_professional_daily_report(date: str):
    return ApiResponse(success=True, data=_professional_daily_payload(date))


@router.get("/professional/daily/download")
async def download_professional_daily_report(date: str, format: str = "markdown"):
    payload = _professional_daily_payload(date)
    report_dir = get_data_dir() / "reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    if format == "html":
        path = report_dir / f"professional_daily_{date}.html"
        path.write_text(payload["html"], encoding="utf-8")
        return FileResponse(
            path=path,
            media_type="text/html; charset=utf-8",
            filename=path.name,
        )
    if format == "inline-html":
        return Response(content=payload["html"], media_type="text/html; charset=utf-8")
    path = report_dir / f"professional_daily_{date}.md"
    path.write_text(payload["markdown"], encoding="utf-8")
    return FileResponse(
        path=path,
        media_type="text/markdown; charset=utf-8",
        filename=path.name,
    )
