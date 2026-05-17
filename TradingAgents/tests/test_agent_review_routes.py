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


def test_agent_review_allows_indicator_labels_without_compliance_reject(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_signals

    init_db()
    upsert_signals(
        [
            {
                "signal_id": "sig-indicator-labels",
                "date": "2026-05-12",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2多指标共振",
                "signal_level": "B",
                "direction": "risk",
                "timeframe": "weekly+daily",
                "evidence_json": json.dumps(
                    ["M3买入评分：S_buy=0.104", "M5建议仓位：0 股"],
                    ensure_ascii=False,
                ),
                "risk_json": json.dumps(
                    ["M4卖出评分：S_sell=0.450", "预警等级：三级卖警"],
                    ensure_ascii=False,
                ),
                "invalid_json": json.dumps(["S_sell高于0.55"], ensure_ascii=False),
                "score": 45.0,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )

    client = TestClient(create_app())
    response = client.post("/api/signals/sig-indicator-labels/agent-review")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["action"] != "reject"
    assert payload["review_summary"] != "审查输出包含不合规表述，已拒绝该审查。"


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


def test_agent_review_list_route_filters_by_signal(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import get_connection, init_db

    init_db()
    with get_connection() as conn:
        for review_id, signal_id, action in [
            ("review-1", "sig-1", "keep"),
            ("review-2", "sig-2", "reject"),
        ]:
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
                    "2026-05-11",
                    "600519.SH",
                    action,
                    "medium",
                    "[]",
                    "[]",
                    "[]",
                    "[]",
                    "审查摘要",
                    "fixture",
                    "v1",
                    review_id,
                ),
            )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/agent-reviews?signal_id=sig-1")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert [item["review_id"] for item in payload["data"]] == ["review-1"]


def test_agent_review_decision_route_updates_human_loop_status(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import get_connection, init_db

    init_db()
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
                "review-loop-1",
                "sig-loop-1",
                "2026-05-11",
                "600519.SH",
                "keep",
                "high",
                "[]",
                "[]",
                "[]",
                "[]",
                "等待人工闭环",
                "fixture",
                "v1",
                "2026-05-11T00:00:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.patch(
        "/api/agent-reviews/review-loop-1/decision",
        json={"decision_status": "rejected", "decision_note": "缺少成交确认"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["decision_status"] == "rejected"
    assert payload["data"]["decision_note"] == "缺少成交确认"
    assert payload["data"]["resolved_at"]

    fetched = client.get("/api/agent-reviews/review-loop-1")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["decision_status"] == "rejected"
