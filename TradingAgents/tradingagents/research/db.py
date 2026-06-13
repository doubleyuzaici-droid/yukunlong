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
    CREATE TABLE IF NOT EXISTS holding_concentration (
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        northbound_float_pct REAL,
        northbound_total_pct REAL,
        fund_float_pct REAL,
        fund_count INTEGER,
        shareholder_count INTEGER,
        shareholder_count_delta_pct REAL,
        top10_holder_pct REAL,
        source TEXT,
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
        created_at TEXT,
        resolution_status TEXT,
        resolution_note TEXT,
        resolved_at TEXT
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
    """
    CREATE TABLE IF NOT EXISTS llm_provider_config (
        provider TEXT PRIMARY KEY,
        display_name TEXT,
        default_quick_model TEXT,
        default_deep_model TEXT,
        base_url TEXT,
        api_key_mask TEXT,
        enabled INTEGER DEFAULT 1,
        created_at TEXT,
        updated_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS fundamental_snapshot (
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        revenue REAL,
        net_income REAL,
        eps REAL,
        roe REAL,
        gross_margin REAL,
        pe_ttm REAL,
        pb REAL,
        ps REAL,
        ev_ebitda REAL,
        dividend_yield REAL,
        source TEXT,
        updated_at TEXT,
        PRIMARY KEY(date, symbol)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS financial_statement (
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        statement_type TEXT NOT NULL,
        period TEXT,
        metrics_json TEXT NOT NULL,
        source TEXT,
        raw_text TEXT,
        updated_at TEXT,
        PRIMARY KEY(date, symbol, statement_type)
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS news_evidence (
        news_id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        headline TEXT NOT NULL,
        source TEXT,
        url TEXT,
        sentiment TEXT,
        credibility REAL,
        summary TEXT,
        created_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS corporate_events (
        event_id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        event_date TEXT NOT NULL,
        event_type TEXT NOT NULL,  -- earnings_preview / unlock / dividend / meeting / industry
        title TEXT NOT NULL,
        tone TEXT,
        note TEXT,
        source TEXT,
        url TEXT,
        amount REAL,               -- 解禁/分红时填金额
        created_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS lhb_desk (
        desk_id TEXT PRIMARY KEY,
        date TEXT NOT NULL,
        symbol TEXT NOT NULL,
        desk_name TEXT NOT NULL,    -- "中金公司·上海分公司" / "沪股通专用"
        desk_tag TEXT,              -- "北向" | "机构" | "游资"
        net_buy REAL,               -- 净买入金额，元
        buy_amount REAL,
        sell_amount REAL,
        source TEXT,
        created_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS research_report (
        report_id TEXT PRIMARY KEY,
        symbol TEXT NOT NULL,
        date TEXT NOT NULL,
        org TEXT,
        rating TEXT,
        title TEXT,
        eps_forecast REAL,
        target_price REAL,
        industry TEXT,
        url TEXT,
        synced_at TEXT
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS sync_trace (
        trace_id TEXT PRIMARY KEY,
        symbol TEXT,
        job_type TEXT NOT NULL,
        start TEXT,
        end TEXT,
        primary_source TEXT,
        fallback_source TEXT,
        status TEXT,
        rows_written INTEGER DEFAULT 0,
        elapsed_ms INTEGER,
        error TEXT,
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
    if not _column_exists(conn, "event_return", "market_regime"):
        conn.execute("ALTER TABLE event_return ADD COLUMN market_regime TEXT")
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
    quality_columns = {
        "resolution_status": "TEXT",
        "resolution_note": "TEXT",
        "resolved_at": "TEXT",
    }
    for column, column_type in quality_columns.items():
        if not _column_exists(conn, "data_quality_log", column):
            conn.execute(f"ALTER TABLE data_quality_log ADD COLUMN {column} {column_type}")
    agent_review_columns = {
        "decision_status": "TEXT",
        "decision_note": "TEXT",
        "resolved_at": "TEXT",
    }
    for column, column_type in agent_review_columns.items():
        if not _column_exists(conn, "agent_decision_log", column):
            conn.execute(f"ALTER TABLE agent_decision_log ADD COLUMN {column} {column_type}")
    # Symbol Workspace V2 C 级 BE-6: PS / EV-EBITDA
    fundamental_extra = {
        "ps": "REAL",
        "ev_ebitda": "REAL",
    }
    for column, column_type in fundamental_extra.items():
        if not _column_exists(conn, "fundamental_snapshot", column):
            conn.execute(
                f"ALTER TABLE fundamental_snapshot ADD COLUMN {column} {column_type}"
            )
