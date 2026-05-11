import sqlite3


def test_init_db_creates_research_tables(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import get_db_path, init_db

    init_db()

    assert get_db_path() == tmp_path / "db" / "research.db"
    assert get_db_path().exists()

    with sqlite3.connect(get_db_path()) as conn:
        rows = conn.execute(
            "SELECT name FROM sqlite_master WHERE type = 'table'"
        ).fetchall()

    table_names = {row[0] for row in rows}
    assert {
        "security_master",
        "watchlist",
        "daily_bars",
        "index_bars",
        "factor_daily",
        "signal_log",
        "event_return",
        "data_quality_log",
    }.issubset(table_names)


def test_get_connection_uses_row_factory(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import get_connection, init_db

    init_db()
    with get_connection() as conn:
        conn.execute(
            "INSERT INTO watchlist (symbol, market, status) VALUES (?, ?, ?)",
            ("600519.SH", "CHINA", "active"),
        )
        row = conn.execute("SELECT symbol, market FROM watchlist").fetchone()

    assert row["symbol"] == "600519.SH"
    assert row["market"] == "CHINA"
