from __future__ import annotations

import json

from tradingagents.research.db import get_connection, init_db

PROMPT_VERSION = "signal_review_v1"


def load_signal(signal_id: str) -> dict:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM signal_log WHERE signal_id = ?",
            (signal_id,),
        ).fetchone()
    if row is None:
        raise ValueError(f"Signal not found: {signal_id}")
    return dict(row)


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    parsed = json.loads(value)
    return parsed if isinstance(parsed, list) else [str(parsed)]


def signal_payload(signal_id: str) -> dict:
    signal = load_signal(signal_id)
    return {
        "signal_id": signal["signal_id"],
        "date": signal["date"],
        "symbol": signal["symbol"],
        "market": signal["market"],
        "signal": {
            "name": signal["signal_name"],
            "level": signal["signal_level"],
            "direction": signal["direction"],
            "evidence": _json_list(signal.get("evidence_json")),
            "risk": _json_list(signal.get("risk_json")),
            "invalid_conditions": _json_list(signal.get("invalid_json")),
        },
        "market_context": {},
        "fundamental_snapshot": {},
        "recent_events": [],
    }


def build_signal_review_prompt(signal_id: str) -> str:
    payload = signal_payload(signal_id)
    return (
        "你是投研信号审查员，不是交易员。\n"
        "你不能输出买入、卖出、目标价、仓位。\n"
        "你不能新增未由系统计算出的技术信号。\n"
        "你只能基于给定 evidence、risk、invalid_conditions、market_context 解释和审查。\n"
        "如果数据不足，必须写入 missing_data。\n"
        "必须输出看多理由、看空理由、风险反证、后续观察点。\n"
        "请只输出 JSON，字段为 action, confidence, bull_points, bear_points, "
        "risk_flags, missing_data, review_summary。\n\n"
        f"输入：{json.dumps(payload, ensure_ascii=False)}"
    )
