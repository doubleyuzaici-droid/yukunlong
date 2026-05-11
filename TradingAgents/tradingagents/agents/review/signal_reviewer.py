from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import uuid4

from tradingagents.agents.review.prompts import (
    PROMPT_VERSION,
    build_signal_review_prompt,
    signal_payload,
)
from tradingagents.research.db import get_connection, init_db

ALLOWED_ACTIONS = {"upgrade", "keep", "downgrade", "reject"}
ALLOWED_CONFIDENCE = {"low", "medium", "high"}
PROHIBITED_TERMS = ("买入", "卖出", "目标价", "仓位", "满仓", "稳赚")


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _default_review(payload: dict) -> dict:
    signal = payload["signal"]
    action = "keep" if signal["level"] in ("S", "A", "B") else "downgrade"
    return {
        "action": action,
        "confidence": "medium",
        "bull_points": signal["evidence"][:3],
        "bear_points": signal["risk"] or ["需要更多反证材料"],
        "risk_flags": signal["invalid_conditions"],
        "missing_data": ["行业相对强度", "最新公告事件"],
        "review_summary": "保留观察，等待更多确认。",
    }


def _parse_review(raw: str) -> dict:
    return json.loads(raw)


def _normalize_review(review: dict) -> dict:
    normalized = {
        "action": review.get("action", "keep"),
        "confidence": review.get("confidence", "medium"),
        "bull_points": list(review.get("bull_points", [])),
        "bear_points": list(review.get("bear_points", [])),
        "risk_flags": list(review.get("risk_flags", [])),
        "missing_data": list(review.get("missing_data", [])),
        "review_summary": str(review.get("review_summary", "")),
    }
    if normalized["action"] not in ALLOWED_ACTIONS:
        normalized["action"] = "reject"
    if normalized["confidence"] not in ALLOWED_CONFIDENCE:
        normalized["confidence"] = "low"
    serialized = json.dumps(normalized, ensure_ascii=False)
    if any(term in serialized for term in PROHIBITED_TERMS):
        normalized.update(
            {
                "action": "reject",
                "confidence": "low",
                "review_summary": "审查输出包含不合规表述，已拒绝该审查。",
            }
        )
    return normalized


def _persist_review(
    signal_id: str, payload: dict, review: dict, model_name: str
) -> dict:
    review_id = uuid4().hex
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO agent_decision_log (
                review_id, signal_id, date, symbol, action, confidence,
                bull_points_json, bear_points_json, risk_flags_json,
                missing_data_json, review_summary, model_name, prompt_version,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                review_id,
                signal_id,
                payload["date"],
                payload["symbol"],
                review["action"],
                review["confidence"],
                json.dumps(review["bull_points"], ensure_ascii=False),
                json.dumps(review["bear_points"], ensure_ascii=False),
                json.dumps(review["risk_flags"], ensure_ascii=False),
                json.dumps(review["missing_data"], ensure_ascii=False),
                review["review_summary"],
                model_name,
                PROMPT_VERSION,
                _now(),
            ),
        )
        conn.commit()
    return {"review_id": review_id, "signal_id": signal_id, **review}


def review_signal(signal_id: str, llm=None, model_name: str = "rule-reviewer") -> dict:
    init_db()
    payload = signal_payload(signal_id)
    prompt = build_signal_review_prompt(signal_id)
    raw_review = llm(prompt) if llm else None
    review = _parse_review(raw_review) if raw_review else _default_review(payload)
    normalized = _normalize_review(review)
    return _persist_review(signal_id, payload, normalized, model_name)


def get_review(review_id: str) -> dict | None:
    init_db()
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM agent_decision_log WHERE review_id = ?",
            (review_id,),
        ).fetchone()
    if row is None:
        return None
    result = dict(row)
    result["bull_points"] = json.loads(result.pop("bull_points_json") or "[]")
    result["bear_points"] = json.loads(result.pop("bear_points_json") or "[]")
    result["risk_flags"] = json.loads(result.pop("risk_flags_json") or "[]")
    result["missing_data"] = json.loads(result.pop("missing_data_json") or "[]")
    return result
