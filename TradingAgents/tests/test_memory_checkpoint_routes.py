import sqlite3

from fastapi.testclient import TestClient


def test_memory_route_returns_entries_and_counts(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.agents.utils.memory import TradingMemoryLog
    from tradingagents.api.server import create_app
    from tradingagents.default_config import DEFAULT_CONFIG

    DEFAULT_CONFIG["memory_log_path"] = str(tmp_path / "memory" / "trading_memory.md")
    log = TradingMemoryLog(DEFAULT_CONFIG)
    log.store_decision("NVDA", "2026-01-10", "Rating: Buy\nReason: strong trend")
    log.update_with_outcome(
        "NVDA",
        "2026-01-10",
        raw_return=0.12,
        alpha_return=0.04,
        holding_days=20,
        reflection="Trend worked, but entry risk was high.",
    )
    log.store_decision("TSLA", "2026-02-01", "Rating: Hold\nReason: mixed signal")

    client = TestClient(create_app())
    response = client.get("/api/memory")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["pending_count"] == 1
    assert payload["data"]["resolved_count"] == 1
    assert payload["data"]["entries"][0]["ticker"] == "TSLA"
    assert payload["data"]["entries"][1]["reflection"] == (
        "Trend worked, but entry risk was high."
    )


def test_checkpoint_routes_list_status_and_clear(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.default_config import DEFAULT_CONFIG
    from tradingagents.graph.checkpointer import thread_id

    DEFAULT_CONFIG["data_cache_dir"] = str(tmp_path / "cache")
    checkpoint_dir = tmp_path / "cache" / "checkpoints"
    checkpoint_dir.mkdir(parents=True)
    db_path = checkpoint_dir / "NVDA.db"
    tid = thread_id("NVDA", "2026-01-10")
    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE checkpoints (
                thread_id TEXT NOT NULL,
                checkpoint_ns TEXT NOT NULL DEFAULT '',
                checkpoint_id TEXT NOT NULL,
                parent_checkpoint_id TEXT,
                type TEXT,
                checkpoint BLOB,
                metadata BLOB,
                PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id)
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE writes (
                thread_id TEXT NOT NULL,
                checkpoint_ns TEXT NOT NULL DEFAULT '',
                checkpoint_id TEXT NOT NULL,
                task_id TEXT NOT NULL,
                idx INTEGER NOT NULL,
                channel TEXT NOT NULL,
                type TEXT,
                value BLOB,
                PRIMARY KEY (thread_id, checkpoint_ns, checkpoint_id, task_id, idx)
            )
            """
        )
        conn.execute(
            """
            INSERT INTO checkpoints (
                thread_id, checkpoint_ns, checkpoint_id, type, checkpoint, metadata
            )
            VALUES (?, '', 'cp-1', 'json', X'7B7D', ?)
            """,
            (tid, b'{"step": 7}'),
        )

    client = TestClient(create_app())

    listed = client.get("/api/checkpoints")
    assert listed.status_code == 200
    listed_payload = listed.json()
    assert listed_payload["success"] is True
    assert listed_payload["data"]["checkpoints"][0]["ticker"] == "NVDA"
    assert listed_payload["data"]["checkpoints"][0]["checkpoint_count"] == 1

    status = client.get("/api/checkpoints/NVDA/2026-01-10")
    assert status.status_code == 200
    assert status.json()["data"]["has_checkpoint"] is True
    assert status.json()["data"]["step"] == 7

    cleared = client.delete("/api/checkpoints/NVDA/2026-01-10")
    assert cleared.status_code == 200
    assert cleared.json()["data"]["cleared"] is True

    status_after = client.get("/api/checkpoints/NVDA/2026-01-10")
    assert status_after.json()["data"]["has_checkpoint"] is False
