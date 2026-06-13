from __future__ import annotations

from tradingagents.research.repository import get_watchlist_data_status


def readiness_for_bar_count(count: int) -> tuple[str, str]:
    if count <= 0:
        return "no_data", "暂无本地行情，需先同步数据"
    if count < 20:
        return "insufficient_20", "少于 20 个交易日，仅能做极有限检查"
    if count < 60:
        return "insufficient_60", "少于 60 个交易日，趋势和突破规则不可用"
    if count < 120:
        return "partial", "已有 60 日数据，部分 120 日规则不可用"
    return "ready", "数据充足，可运行完整规则扫描"


def get_watchlist_status() -> list[dict]:
    rows = []
    for row in get_watchlist_data_status():
        bar_count = int(row.get("bar_count") or 0)
        readiness, reason = readiness_for_bar_count(bar_count)
        rows.append(
            {
                **row,
                "bar_count": bar_count,
                "signal_count": int(row.get("signal_count") or 0),
                "scan_readiness": readiness,
                "readiness_reason": reason,
            }
        )
    return rows
