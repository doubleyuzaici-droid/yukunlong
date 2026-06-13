import json

from fastapi.testclient import TestClient


def test_signal_history_route_returns_reviews_and_event_returns(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_signals

    init_db()
    upsert_signals(
        [
            {
                "signal_id": "sig-history-1",
                "date": "2026-01-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": json.dumps(["放量突破"], ensure_ascii=False),
                "risk_json": json.dumps(["回撤扩大"], ensure_ascii=False),
                "invalid_json": json.dumps(["跌破均线"], ensure_ascii=False),
                "score": 88.0,
                "strategy_version": "signal_v1",
                "market_regime": "bull",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO event_return (
                signal_id, entry_date, entry_price, ret_5d, ret_20d, ret_60d,
                excess_index_20d, max_adverse_20d, max_favorable_20d,
                success_flag, fail_reason, market_regime, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "sig-history-1",
                "2026-01-11",
                100.0,
                0.03,
                0.12,
                0.18,
                0.05,
                -0.04,
                0.2,
                1,
                None,
                "bull",
                "2026-01-31",
            ),
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
                "review-history-1",
                "sig-history-1",
                "2026-01-10",
                "600519.SH",
                "keep",
                "high",
                "[]",
                "[]",
                "[]",
                "[]",
                "审查通过",
                "fixture",
                "v1",
                "2026-01-10T00:00:00",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get(
        "/api/signals/history?symbol=600519.SH&start=2026-01-01&end=2026-02-01"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["symbol"] == "600519.SH"
    assert payload["data"]["total_count"] == 1
    row = payload["data"]["signals"][0]
    assert row["signal_id"] == "sig-history-1"
    assert row["review_count"] == 1
    assert row["event_return"]["ret_20d"] == 0.12
