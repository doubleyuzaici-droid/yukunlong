from __future__ import annotations


def _join(items: list[str]) -> str:
    return "；".join(items) if items else "-"


def _table(rows: list[dict]) -> list[str]:
    lines = [
        "| 股票 | 市场 | 信号 | 等级 | 核心原因 | 风险 |",
        "|---|---|---|---|---|---|",
    ]
    if not rows:
        lines.append("| - | - | - | - | - | - |")
        return lines
    for row in rows:
        lines.append(
            "| {symbol} | {market} | {signal_name} | {signal_level} | {evidence} | {risk} |".format(
                symbol=row.get("symbol", "-"),
                market=row.get("market", "-"),
                signal_name=row.get("signal_name", "-"),
                signal_level=row.get("signal_level", "-"),
                evidence=_join(row.get("evidence", [])),
                risk=_join(row.get("risk", [])),
            )
        )
    return lines


def render_daily_report(summary: dict) -> str:
    lines = [
        f"# A/H 股自选股复盘 - {summary['date']}",
        "",
        "## 1. 今日概览",
        "",
        f"- 扫描股票数：{summary['n_symbols']}",
        f"- 触发信号数：{summary['n_signals']}",
        f"- 新增观察：{summary['n_watch']}",
        f"- 重点观察：{summary['n_focus']}",
        f"- 风险升高：{summary['n_risk']}",
        f"- 信号失效：{summary['n_invalid']}",
        "",
        "## 2. 新增观察",
        "",
        *_table(summary["watch"]),
        "",
        "## 3. 重点观察",
        "",
        *_table(summary["focus"]),
        "",
        "## 4. 风险升高",
        "",
        *_table(summary["risk"]),
        "",
        "## 5. 信号失效",
        "",
        *_table(summary["invalid"]),
        "",
        "## 6. 建议 Agent 深度审查",
        "",
        *_table(summary["agent_review"]),
        "",
        "## 7. 数据质量",
        "",
        "- 缺失行情：-",
        "- 异常价格：-",
        "- 数据源失败：-",
        "",
    ]
    return "\n".join(lines)
