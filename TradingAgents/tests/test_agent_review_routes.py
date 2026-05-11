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
