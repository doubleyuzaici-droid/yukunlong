from __future__ import annotations

from tradingagents.research.db import get_connection, init_db


def summarize_signal_effectiveness() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute("""
            SELECT
                s.signal_name,
                COUNT(*) AS sample_count,
                AVG(CASE WHEN e.ret_20d > 0 THEN 1.0 ELSE 0.0 END) AS win_rate_20d,
                AVG(e.ret_20d) AS mean_ret_20d,
                AVG(e.max_adverse_20d) AS mean_max_adverse_20d
            FROM event_return e
            JOIN signal_log s ON s.signal_id = e.signal_id
            WHERE e.fail_reason IS NULL
            GROUP BY s.signal_name
            ORDER BY sample_count DESC, mean_ret_20d DESC
            """).fetchall()
    return [dict(row) for row in rows]


def summarize_failure_reasons() -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT
                fail_reason,
                COUNT(*) AS sample_count
            FROM event_return
            WHERE fail_reason IS NOT NULL
            GROUP BY fail_reason
            ORDER BY sample_count DESC, fail_reason
            """
        ).fetchall()
    return [dict(row) for row in rows]
