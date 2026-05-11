import json


def _seed_signal():
    from tradingagents.research.repository import upsert_signals

    upsert_signals(
        [
            {
                "signal_id": "sig-1",
                "date": "2026-05-11",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": json.dumps(["close > ma60"], ensure_ascii=False),
                "risk_json": json.dumps(["成交确认不足"], ensure_ascii=False),
                "invalid_json": json.dumps(["跌破 ma60"], ensure_ascii=False),
                "score": 85.0,
                "strategy_version": "signal_v1",
            }
        ]
    )


def test_signal_reviewer_returns_structured_json_and_persists(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.agents.review.signal_reviewer import review_signal
    from tradingagents.research.db import get_connection, init_db

    init_db()
    _seed_signal()

    def fake_llm(_prompt: str) -> str:
        return json.dumps(
            {
                "action": "keep",
                "confidence": "medium",
                "bull_points": ["趋势证据成立"],
                "bear_points": ["成交确认不足"],
                "risk_flags": ["跌破 ma60 则失效"],
                "missing_data": ["行业相对强度"],
                "review_summary": "保留观察，等待更多确认。",
            },
            ensure_ascii=False,
        )

    review = review_signal("sig-1", llm=fake_llm)

    assert review["action"] == "keep"
    assert review["confidence"] == "medium"
    assert "买入" not in json.dumps(review, ensure_ascii=False)
    with get_connection() as conn:
        row = conn.execute(
            "SELECT action, confidence FROM agent_decision_log WHERE signal_id = ?",
            ("sig-1",),
        ).fetchone()
    assert row["action"] == "keep"
    assert row["confidence"] == "medium"


def test_signal_reviewer_prompt_contains_guardrails(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.agents.review.prompts import build_signal_review_prompt
    from tradingagents.research.db import init_db

    init_db()
    _seed_signal()

    prompt = build_signal_review_prompt("sig-1")

    assert "你是投研信号审查员，不是交易员" in prompt
    assert "不能输出买入、卖出、目标价、仓位" in prompt
