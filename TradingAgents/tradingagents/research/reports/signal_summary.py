from __future__ import annotations

import json

from tradingagents.research.repository import list_today_signals, list_watchlist


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    parsed = json.loads(value)
    if isinstance(parsed, list):
        return [str(item) for item in parsed]
    return [str(parsed)]


def _enrich_signal(row: dict) -> dict:
    enriched = dict(row)
    enriched["evidence"] = _json_list(row.get("evidence_json"))
    enriched["risk"] = _json_list(row.get("risk_json"))
    enriched["invalid_conditions"] = _json_list(row.get("invalid_json"))
    return enriched


def summarize_daily_signals(date: str) -> dict:
    signals = [_enrich_signal(row) for row in list_today_signals(date)]
    focus = [
        row
        for row in signals
        if row.get("direction") == "opportunity"
        and row.get("signal_level") in ("S", "A")
    ]
    watch = [
        row
        for row in signals
        if row.get("direction") == "opportunity"
        and row.get("signal_level") not in ("S", "A")
    ]
    risk = [row for row in signals if row.get("direction") == "risk"]
    invalid = [
        row
        for row in signals
        if row.get("signal_name") in ("趋势破位", "信号失效")
        or row.get("signal_level") == "D"
    ]
    return {
        "date": date,
        "n_symbols": len(list_watchlist()),
        "n_signals": len(signals),
        "n_watch": len(watch),
        "n_focus": len(focus),
        "n_risk": len(risk),
        "n_invalid": len(invalid),
        "watch": watch,
        "focus": focus,
        "risk": risk,
        "invalid": invalid,
        "agent_review": [
            row for row in signals if row.get("signal_level") in ("S", "A", "D")
        ],
    }
