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
                (
                    date, check_name, severity, symbol, message, created_at,
                    resolution_status
                )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (date, check_name, severity, symbol, message, created_at, "open"),
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


def resolve_quality_issue(
    issue_id: int,
    resolution_status: str = "resolved",
    resolution_note: str | None = None,
) -> dict | None:
    init_db()
    resolved_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE data_quality_log
            SET resolution_status = ?,
                resolution_note = ?,
                resolved_at = ?
            WHERE id = ?
            """,
            (resolution_status, resolution_note, resolved_at, issue_id),
        )
        row = conn.execute(
            "SELECT * FROM data_quality_log WHERE id = ?",
            (issue_id,),
        ).fetchone()
        conn.commit()
    return dict(row) if row else None
