import sqlite3


def test_init_db_migrates_factor_daily_fund_flow_columns(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    db_path = tmp_path / "db" / "research.db"
    db_path.parent.mkdir(parents=True)

    with sqlite3.connect(db_path) as conn:
        conn.execute(
            """
            CREATE TABLE factor_daily (
                date TEXT NOT NULL,
                symbol TEXT NOT NULL,
                ma20 REAL,
                PRIMARY KEY(date, symbol)
            )
            """
        )
        conn.commit()

    from tradingagents.research.db import init_db

    init_db()

    with sqlite3.connect(db_path) as conn:
        columns = {row[1] for row in conn.execute("PRAGMA table_info(factor_daily)")}

    assert "main_net_inflow_ratio20" in columns
    assert "northbound_inflow_5d" in columns
