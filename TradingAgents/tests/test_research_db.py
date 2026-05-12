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


def test_init_db_migrates_existing_factor_daily_columns(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import get_connection, init_db

    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE factor_daily (
                date TEXT NOT NULL,
                symbol TEXT NOT NULL,
                ma20 REAL,
                updated_at TEXT,
                PRIMARY KEY(date, symbol)
            )
            """
        )
        conn.commit()

    init_db()

    with get_connection() as conn:
        columns = {
            row["name"]
            for row in conn.execute("PRAGMA table_info(factor_daily)").fetchall()
        }

    assert "main_net_inflow_ratio20" in columns
    assert "northbound_inflow_5d" in columns
