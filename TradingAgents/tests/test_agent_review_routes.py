import json

from fastapi.testclient import TestClient


def test_agent_review_routes_create_and_fetch_review(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_signals

    init_db()
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
                "risk_json": json.dumps([], ensure_ascii=False),
                "invalid_json": json.dumps(["跌破 ma60"], ensure_ascii=False),
                "score": 85.0,
                "strategy_version": "signal_v1",
            }
        ]
    )

    client = TestClient(create_app())
    response = client.post("/api/signals/sig-1/agent-review")

    assert response.status_code == 200
    review_id = response.json()["data"]["review_id"]
    assert response.json()["data"]["action"] in {
        "upgrade",
        "keep",
        "downgrade",
        "reject",
    }

    fetched = client.get(f"/api/agent-reviews/{review_id}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["review_id"] == review_id


def test_agent_review_performance_route(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import get_connection, init_db

    init_db()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO event_return (
                signal_id, entry_date, entry_price, ret_5d, ret_20d, ret_60d,
                max_adverse_20d, max_favorable_20d, success_flag, fail_reason,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("sig-1", "2026-05-12", 100, 0.01, 0.05, 0.08, -0.02, 0.07, 1, None, "now"),
        )
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
                "review-1",
                "sig-1",
                "2026-05-11",
                "600519.SH",
                "keep",
                "medium",
                "[]",
                "[]",
                "[]",
                "[]",
                "保留观察",
                "fixture",
                "v1",
                "now",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/agent-reviews/performance")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"][0]["action"] == "keep"
    assert payload["data"][0]["win_rate_20d"] == 1.0
