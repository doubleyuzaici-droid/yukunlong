import os
import sqlite3
from pathlib import Path

SCHEMA_STATEMENTS = [
    """
    CREATE TABLE IF NOT EXISTS security_master (
        symbol TEXT PRIMARY KEY,
        raw_code TEXT,
        market TEXT NOT NULL,
        exchange TEXT,
        name TEXT,
        industry TEXT,
        currency TEXT,
        lot_size INTEGER,
        list_date TEXT,
        delist_date TEXT,
        is_st INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS watchlist (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        symbol TEXT NOT NULL UNIQUE,
        name TEXT,
        market TEXT,
        industry TEXT,
        thesis TEXT,
        status TEXT DEFAULT 'active',
        created_at TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS daily_bars (
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        market TEXT NOT NULL,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume REAL,
        amount REAL,
        adj_factor REAL,
        is_suspended INTEGER DEFAULT 0,
        limit_up REAL,
        limit_down REAL,
        source TEXT,
        quality_flag TEXT,
        updated_at TEXT,
        PRIMARY KEY(date, symbol)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS index_bars (
        date TEXT NOT NULL,
        index_symbol TEXT NOT NULL,
        market TEXT,
        open REAL,
        high REAL,
        low REAL,
        close REAL,
        volume REAL,
        amount REAL,
        source TEXT,
        updated_at TEXT,
        PRIMARY KEY(date, index_symbol)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS factor_daily (
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        ma20 REAL,
        ma60 REAL,
        ma120 REAL,
        rsi14 REAL,
        atr14 REAL,
        volume_ratio20 REAL,
        amount_ratio20 REAL,
        ret20 REAL,
        ret60 REAL,
        rel_strength_index20 REAL,
        rel_strength_industry20 REAL,
        weekly_state TEXT,
        monthly_state TEXT,
        main_net_inflow_ratio20 REAL,
        northbound_inflow_5d REAL,
        updated_at TEXT,
        PRIMARY KEY(date, symbol)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS fund_flow_daily (
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        main_net_inflow REAL,
        large_net_inflow REAL,
        northbound_net_inflow REAL,
        updated_at TEXT,
        PRIMARY KEY(date, symbol)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS signal_log (
        signal_id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        market TEXT,
        signal_name TEXT NOT NULL,
        signal_level TEXT,
        direction TEXT,
        timeframe TEXT,
        evidence_json TEXT,
        risk_json TEXT,
        invalid_json TEXT,
        score REAL,
        strategy_version TEXT,
        market_regime TEXT,
        created_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS event_return (
        signal_id TEXT PRIMARY KEY,
        entry_date TEXT,
        entry_price REAL,
        ret_5d REAL,
        ret_20d REAL,
        ret_60d REAL,
        excess_index_20d REAL,
        excess_industry_20d REAL,
        max_adverse_20d REAL,
        max_favorable_20d REAL,
        success_flag INTEGER,
        fail_reason TEXT,
        market_regime TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS data_quality_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT,
        check_name TEXT,
        severity TEXT,
        symbol TEXT,
        message TEXT,
        created_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS trade_log (
        trade_id TEXT PRIMARY KEY,
        strategy_version TEXT,
        symbol TEXT,
        market TEXT,
        side TEXT,
        date TEXT,
        price REAL,
        quantity REAL,
        cost REAL,
        reason TEXT,
        created_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS equity_curve (
        strategy_version TEXT,
        date TEXT,
        equity REAL,
        cash REAL,
        positions_value REAL,
        drawdown REAL,
        PRIMARY KEY(strategy_version, date)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS agent_decision_log (
        review_id TEXT PRIMARY KEY,
        signal_id TEXT,
        date TEXT,
        symbol TEXT,
        action TEXT,
        confidence TEXT,
        bull_points_json TEXT,
        bear_points_json TEXT,
        risk_flags_json TEXT,
        missing_data_json TEXT,
        review_summary TEXT,
        model_name TEXT,
        prompt_version TEXT,
        created_at TEXT
    )
    """,
]


def get_data_dir() -> Path:
    return Path(os.getenv("TRADINGAGENTS_DATA_DIR", "local_data"))


def get_db_path() -> Path:
    return get_data_dir() / "db" / "research.db"


def get_connection() -> sqlite3.Connection:
    path = get_db_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    with get_connection() as conn:
        for statement in SCHEMA_STATEMENTS:
            conn.execute(statement)
        _migrate_schema(conn)
        conn.commit()


def _column_exists(conn: sqlite3.Connection, table: str, column: str) -> bool:
    rows = conn.execute(f"PRAGMA table_info({table})").fetchall()
    return any(row[1] == column for row in rows)


def _migrate_schema(conn: sqlite3.Connection) -> None:
    if not _column_exists(conn, "signal_log", "market_regime"):
        conn.execute("ALTER TABLE signal_log ADD COLUMN market_regime TEXT")
    factor_columns = {
        "ma20": "REAL",
        "ma60": "REAL",
        "ma120": "REAL",
        "rsi14": "REAL",
        "atr14": "REAL",
        "volume_ratio20": "REAL",
        "amount_ratio20": "REAL",
        "ret20": "REAL",
        "ret60": "REAL",
        "rel_strength_index20": "REAL",
        "rel_strength_industry20": "REAL",
        "weekly_state": "TEXT",
        "monthly_state": "TEXT",
        "main_net_inflow_ratio20": "REAL",
        "northbound_inflow_5d": "REAL",
        "updated_at": "TEXT",
    }
    for column, column_type in factor_columns.items():
        if not _column_exists(conn, "factor_daily", column):
            conn.execute(f"ALTER TABLE factor_daily ADD COLUMN {column} {column_type}")
