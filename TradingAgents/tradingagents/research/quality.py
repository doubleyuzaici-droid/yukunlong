from __future__ import annotations

from datetime import datetime, timezone

from .db import get_connection, init_db


def log_quality_issue(
    check_name: str,
    severity: str,
    message: str,
    date: str | None = None,
    symbol: str | None = None,
) -> None:
    init_db()
    created_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO data_quality_log
                (date, check_name, severity, symbol, message, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (date, check_name, severity, symbol, message, created_at),
        )
        conn.commit()


def list_quality_issues(limit: int = 100) -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM data_quality_log
            ORDER BY id DESC
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [dict(row) for row in rows]
