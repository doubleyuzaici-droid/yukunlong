import json


def test_agent_review_performance_groups_actions_by_event_outcome(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.agents.review.performance import summarize_review_performance
    from tradingagents.research.db import get_connection, init_db

    init_db()
    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO signal_log (
                signal_id, date, symbol, market, signal_name, signal_level,
                direction, timeframe, evidence_json, risk_json, invalid_json
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "keep-sig",
                    "2026-01-10",
                    "600519.SH",
                    "CHINA",
                    "趋势增强",
                    "A",
                    "opportunity",
                    "daily",
                    json.dumps(["fixture"]),
                    json.dumps([]),
                    json.dumps([]),
                ),
                (
                    "reject-sig",
                    "2026-01-11",
                    "600519.SH",
                    "CHINA",
                    "趋势增强",
                    "A",
                    "opportunity",
                    "daily",
                    json.dumps(["fixture"]),
                    json.dumps([]),
                    json.dumps([]),
                ),
            ],
        )
        conn.executemany(
            """
            INSERT INTO event_return (
                signal_id, entry_date, entry_price, ret_5d, ret_20d, ret_60d,
                max_adverse_20d, max_favorable_20d, success_flag, fail_reason,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("keep-sig", "2026-01-11", 100, 0.01, 0.08, 0.12, -0.02, 0.1, 1, None, "now"),
                ("reject-sig", "2026-01-12", 100, -0.01, -0.04, -0.02, -0.07, 0.02, 0, None, "now"),
            ],
        )
        conn.executemany(
            """
            INSERT INTO agent_decision_log (
                review_id, signal_id, date, symbol, action, confidence,
                bull_points_json, bear_points_json, risk_flags_json,
                missing_data_json, review_summary, model_name, prompt_version,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                ("review-1", "keep-sig", "2026-01-10", "600519.SH", "keep", "medium", "[]", "[]", "[]", "[]", "保留观察", "fixture", "v1", "now"),
                ("review-2", "reject-sig", "2026-01-11", "600519.SH", "reject", "medium", "[]", "[]", "[]", "[]", "拒绝观察", "fixture", "v1", "now"),
            ],
        )
        conn.commit()

    rows = summarize_review_performance()

    by_action = {row["action"]: row for row in rows}
    assert by_action["keep"]["sample_count"] == 1
    assert by_action["keep"]["win_rate_20d"] == 1.0
    assert by_action["keep"]["mean_ret_20d"] == 0.08
    assert by_action["reject"]["sample_count"] == 1
    assert by_action["reject"]["win_rate_20d"] == 0.0
