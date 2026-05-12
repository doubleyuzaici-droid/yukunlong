from __future__ import annotations

import json
from typing import Any

from tradingagents.research.db import get_connection, init_db
from tradingagents.research.repository import _normalize_symbol


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    parsed = json.loads(value)
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def load_signal_context(symbol: str, trade_date: str) -> list[dict[str, Any]]:
    init_db()
    normalized = _normalize_symbol(symbol)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM signal_log
            WHERE symbol = ? AND date = ?
            ORDER BY score DESC, signal_level, signal_name
            """,
            (normalized, trade_date),
        ).fetchall()

    signals: list[dict[str, Any]] = []
    for row in rows:
        item = dict(row)
        signals.append(
            {
                "signal_id": item["signal_id"],
                "date": item["date"],
                "symbol": item["symbol"],
                "market": item.get("market"),
                "signal_name": item["signal_name"],
                "signal_level": item.get("signal_level"),
                "direction": item.get("direction"),
                "timeframe": item.get("timeframe"),
                "score": item.get("score"),
                "strategy_version": item.get("strategy_version"),
                "market_regime": item.get("market_regime"),
                "evidence": _json_list(item.get("evidence_json")),
                "risk": _json_list(item.get("risk_json")),
                "invalid_conditions": _json_list(item.get("invalid_json")),
            }
        )
    return signals


def render_signal_context(signals: list[dict[str, Any]]) -> str:
    if not signals:
        return (
            "## Quant Signals\n\n"
            "No rule-based research signals were found for this symbol and date."
        )

    lines = ["## Quant Signals", ""]
    for signal in signals:
        regime = signal.get("market_regime")
        regime_text = f" regime={regime}" if regime else ""
        lines.append(
            f"- {signal['signal_name']} [{signal.get('signal_level')}] "
            f"{signal.get('direction')} score={signal.get('score')}{regime_text}"
        )
        if signal["evidence"]:
            lines.append(f"  Evidence: {'; '.join(signal['evidence'])}")
        if signal["risk"]:
            lines.append(f"  Risks: {'; '.join(signal['risk'])}")
        if signal["invalid_conditions"]:
            lines.append(f"  Invalid if: {'; '.join(signal['invalid_conditions'])}")
    return "\n".join(lines)
