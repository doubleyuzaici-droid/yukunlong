from __future__ import annotations

from tradingagents.research.db import get_connection, init_db


def summarize_review_performance() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                a.action,
                COUNT(*) AS sample_count,
                AVG(CASE WHEN e.ret_20d > 0 THEN 1.0 ELSE 0.0 END) AS win_rate_20d,
                AVG(e.ret_20d) AS mean_ret_20d,
                AVG(e.max_adverse_20d) AS mean_max_adverse_20d
            FROM agent_decision_log a
            JOIN event_return e ON e.signal_id = a.signal_id
            WHERE e.fail_reason IS NULL
            GROUP BY a.action
            ORDER BY sample_count DESC, mean_ret_20d DESC
            """
        ).fetchall()
    return [dict(row) for row in rows]
