from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pandas as pd

from tradingagents.markets import (
    Market,
    detect_market,
    normalize_china_symbol,
    normalize_hk_symbol,
)

from .db import get_connection, init_db
from .index_catalog import normalize_index_symbol


CORE_RESEARCH_UNIVERSE = [
    {
        "symbol": "600519.SH",
        "name": "贵州茅台",
        "market": "CHINA",
        "industry": "白酒",
        "thesis": "A股高质量消费核心样本，用于检验日线、因子、资金流和策略闭环。",
    },
    {
        "symbol": "601318.SH",
        "name": "中国平安",
        "market": "CHINA",
        "industry": "保险",
        "thesis": "A股金融权重核心样本，用于覆盖大金融、基本面和风控场景。",
    },
    {
        "symbol": "00700.HK",
        "name": "腾讯控股",
        "market": "HONGKONG",
        "industry": "互联网",
        "thesis": "港股平台经济核心样本，用于验证港股行情、交易规则和基准链路。",
    },
    {
        "symbol": "01024.HK",
        "name": "快手-W",
        "market": "HONGKONG",
        "industry": "互联网",
        "thesis": "港股成长互联网样本，用于检验高波动标的信号和回测闭环。",
    },
]


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _row_to_dict(row) -> dict:
    return dict(row)


def _normalize_symbol(symbol: str) -> str:
    market = detect_market(symbol)
    if market == Market.CHINA:
        return normalize_china_symbol(symbol)
    if market == Market.HONGKONG:
        return normalize_hk_symbol(symbol)
    return symbol.strip().upper()


def _market_name(symbol: str) -> str:
    market = detect_market(symbol)
    if market == Market.CHINA:
        return "CHINA"
    if market == Market.HONGKONG:
        return "HONGKONG"
    return "US"


def upsert_watchlist_symbols(
    symbols: list[str],
    *,
    market: str | None = None,
    name: str | None = None,
    industry: str | None = None,
    thesis: str | None = None,
    status: str = "active",
) -> None:
    init_db()
    timestamp = _now()
    seen: set[str] = set()
    rows = []
    for symbol in symbols:
        normalized = _normalize_symbol(symbol)
        if normalized in seen:
            continue
        seen.add(normalized)
        rows.append(
            (
                normalized,
                name,
                market or _market_name(normalized),
                industry,
                thesis,
                status,
                timestamp,
                timestamp,
            )
        )

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO watchlist (
                symbol, name, market, industry, thesis, status, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(symbol) DO UPDATE SET
                name = COALESCE(excluded.name, watchlist.name),
                market = excluded.market,
                industry = COALESCE(excluded.industry, watchlist.industry),
                thesis = COALESCE(excluded.thesis, watchlist.thesis),
                status = excluded.status,
                updated_at = excluded.updated_at
            """,
            rows,
        )
        conn.commit()


def ensure_core_watchlist_symbols(symbols: list[str] | None = None) -> list[dict]:
    init_db()
    requested = {_normalize_symbol(symbol) for symbol in symbols or []}
    core_rows = [
        row for row in CORE_RESEARCH_UNIVERSE
        if not requested or row["symbol"] in requested
    ]
    known_core_symbols = {row["symbol"] for row in CORE_RESEARCH_UNIVERSE}
    custom_symbols = sorted(requested - known_core_symbols)
    for row in core_rows:
        upsert_watchlist_symbols(
            [row["symbol"]],
            market=row["market"],
            name=row["name"],
            industry=row["industry"],
            thesis=row["thesis"],
        )
    if custom_symbols:
        upsert_watchlist_symbols(custom_symbols)

    target_symbols = {row["symbol"] for row in core_rows} | set(custom_symbols)
    rows = [row for row in list_watchlist() if row["symbol"] in target_symbols]
    return sorted(rows, key=lambda item: item["symbol"])


def list_watchlist(active_only: bool = True) -> list[dict]:
    init_db()
    query = "SELECT * FROM watchlist"
    params: tuple[Any, ...] = ()
    if active_only:
        query += " WHERE status = ?"
        params = ("active",)
    query += " ORDER BY symbol"
    with get_connection() as conn:
        return [_row_to_dict(row) for row in conn.execute(query, params).fetchall()]


def get_watchlist_data_status(active_only: bool = True) -> list[dict]:
    init_db()
    status_filter = "WHERE w.status = ?" if active_only else ""
    params: tuple[Any, ...] = ("active",) if active_only else ()
    query = f"""
        SELECT
            w.symbol,
            w.name,
            w.market,
            w.industry,
            w.thesis,
            w.status,
            COUNT(DISTINCT b.date) AS bar_count,
            MAX(b.date) AS latest_bar_date,
            COUNT(DISTINCT s.signal_id) AS signal_count,
            MAX(s.date) AS latest_signal_date
        FROM watchlist w
        LEFT JOIN daily_bars b ON b.symbol = w.symbol
        LEFT JOIN signal_log s ON s.symbol = w.symbol
        {status_filter}
        GROUP BY
            w.symbol, w.name, w.market, w.industry, w.thesis, w.status
        ORDER BY w.symbol
    """
    with get_connection() as conn:
        return [_row_to_dict(row) for row in conn.execute(query, params).fetchall()]


def deactivate_watchlist_symbol(symbol: str) -> None:
    init_db()
    normalized = _normalize_symbol(symbol)
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE watchlist
            SET status = ?, updated_at = ?
            WHERE symbol = ?
            """,
            ("inactive", _now(), normalized),
        )
        conn.commit()


def upsert_daily_bars(rows: list[dict]) -> None:
    init_db()
    timestamp = _now()
    values = []
    for row in rows:
        symbol = _normalize_symbol(row["symbol"])
        values.append(
            (
                row["date"],
                symbol,
                row.get("market") or _market_name(symbol),
                row.get("open"),
                row.get("high"),
                row.get("low"),
                row.get("close"),
                row.get("volume"),
                row.get("amount"),
                row.get("adj_factor"),
                row.get("is_suspended", 0),
                row.get("limit_up"),
                row.get("limit_down"),
                row.get("source"),
                row.get("quality_flag"),
                timestamp,
            )
        )

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO daily_bars (
                date, symbol, market, open, high, low, close, volume, amount,
                adj_factor, is_suspended, limit_up, limit_down, source,
                quality_flag, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, symbol) DO UPDATE SET
                market = excluded.market,
                open = excluded.open,
                high = excluded.high,
                low = excluded.low,
                close = excluded.close,
                volume = excluded.volume,
                amount = excluded.amount,
                adj_factor = excluded.adj_factor,
                is_suspended = excluded.is_suspended,
                limit_up = excluded.limit_up,
                limit_down = excluded.limit_down,
                source = excluded.source,
                quality_flag = excluded.quality_flag,
                updated_at = excluded.updated_at
            """,
            values,
        )
        conn.commit()


def load_daily_bars(symbol: str, start: str, end: str) -> pd.DataFrame:
    init_db()
    normalized = _normalize_symbol(symbol)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM daily_bars
            WHERE symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (normalized, start, end),
        ).fetchall()
    return pd.DataFrame([_row_to_dict(row) for row in rows])


def upsert_index_bars(rows: list[dict]) -> None:
    init_db()
    timestamp = _now()
    values = []
    for row in rows:
        index_symbol = normalize_index_symbol(row.get("index_symbol") or row.get("symbol"))
        values.append(
            (
                row["date"],
                index_symbol,
                row.get("market") or "CHINA",
                row.get("open"),
                row.get("high"),
                row.get("low"),
                row.get("close"),
                row.get("volume"),
                row.get("amount"),
                row.get("source"),
                timestamp,
            )
        )

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO index_bars (
                date, index_symbol, market, open, high, low, close,
                volume, amount, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, index_symbol) DO UPDATE SET
                market = excluded.market,
                open = excluded.open,
                high = excluded.high,
                low = excluded.low,
                close = excluded.close,
                volume = excluded.volume,
                amount = excluded.amount,
                source = excluded.source,
                updated_at = excluded.updated_at
            """,
            values,
        )
        conn.commit()


def load_index_bars(index_symbol: str, start: str, end: str) -> pd.DataFrame:
    init_db()
    normalized = normalize_index_symbol(index_symbol)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM index_bars
            WHERE index_symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (normalized, start, end),
        ).fetchall()
    return pd.DataFrame([_row_to_dict(row) for row in rows])


def upsert_factors(rows: list[dict]) -> None:
    init_db()
    timestamp = _now()
    values = []
    for row in rows:
        values.append(
            (
                row["date"],
                _normalize_symbol(row["symbol"]),
                row.get("ma20"),
                row.get("ma60"),
                row.get("ma120"),
                row.get("rsi14"),
                row.get("atr14"),
                row.get("volume_ratio20"),
                row.get("amount_ratio20"),
                row.get("ret20"),
                row.get("ret60"),
                row.get("rel_strength_index20"),
                row.get("rel_strength_industry20"),
                row.get("weekly_state"),
                row.get("monthly_state"),
                row.get("main_net_inflow_ratio20"),
                row.get("northbound_inflow_5d"),
                timestamp,
            )
        )

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO factor_daily (
                date, symbol, ma20, ma60, ma120, rsi14, atr14,
                volume_ratio20, amount_ratio20, ret20, ret60,
                rel_strength_index20, rel_strength_industry20,
                weekly_state, monthly_state, main_net_inflow_ratio20,
                northbound_inflow_5d, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, symbol) DO UPDATE SET
                ma20 = excluded.ma20,
                ma60 = excluded.ma60,
                ma120 = excluded.ma120,
                rsi14 = excluded.rsi14,
                atr14 = excluded.atr14,
                volume_ratio20 = excluded.volume_ratio20,
                amount_ratio20 = excluded.amount_ratio20,
                ret20 = excluded.ret20,
                ret60 = excluded.ret60,
                rel_strength_index20 = excluded.rel_strength_index20,
                rel_strength_industry20 = excluded.rel_strength_industry20,
                weekly_state = excluded.weekly_state,
                monthly_state = excluded.monthly_state,
                main_net_inflow_ratio20 = excluded.main_net_inflow_ratio20,
                northbound_inflow_5d = excluded.northbound_inflow_5d,
                updated_at = excluded.updated_at
            """,
            values,
        )
        conn.commit()


def upsert_signals(rows: list[dict]) -> None:
    init_db()
    timestamp = _now()
    values = []
    for row in rows:
        symbol = _normalize_symbol(row["symbol"])
        values.append(
            (
                row["signal_id"],
                row["date"],
                symbol,
                row.get("market") or _market_name(symbol),
                row["signal_name"],
                row.get("signal_level"),
                row.get("direction"),
                row.get("timeframe"),
                row.get("evidence_json"),
                row.get("risk_json"),
                row.get("invalid_json"),
                row.get("score"),
                row.get("strategy_version"),
                row.get("market_regime"),
                row.get("created_at") or timestamp,
            )
        )

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO signal_log (
                signal_id, date, symbol, market, signal_name, signal_level,
                direction, timeframe, evidence_json, risk_json, invalid_json,
                score, strategy_version, market_regime, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(signal_id) DO UPDATE SET
                date = excluded.date,
                symbol = excluded.symbol,
                market = excluded.market,
                signal_name = excluded.signal_name,
                signal_level = excluded.signal_level,
                direction = excluded.direction,
                timeframe = excluded.timeframe,
                evidence_json = excluded.evidence_json,
                risk_json = excluded.risk_json,
                invalid_json = excluded.invalid_json,
                score = excluded.score,
                strategy_version = excluded.strategy_version,
                market_regime = excluded.market_regime,
                created_at = excluded.created_at
            """,
            values,
        )
        conn.commit()


def list_today_signals(date: str) -> list[dict]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM signal_log
            WHERE date = ?
            ORDER BY signal_level, score DESC, symbol
            """,
            (date,),
        ).fetchall()
    return [_row_to_dict(row) for row in rows]


def list_signals(symbol: str, start: str, end: str) -> list[dict]:
    init_db()
    normalized = _normalize_symbol(symbol)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM signal_log
            WHERE symbol = ? AND date >= ? AND date <= ?
            ORDER BY date DESC, signal_level, score DESC
            """,
            (normalized, start, end),
        ).fetchall()
    return [_row_to_dict(row) for row in rows]


def upsert_fund_flows(rows: list[dict]) -> None:
    init_db()
    timestamp = _now()
    values = [
        (
            row["date"],
            _normalize_symbol(row["symbol"]),
            row.get("main_net_inflow"),
            row.get("large_net_inflow"),
            row.get("northbound_net_inflow"),
            timestamp,
        )
        for row in rows
    ]
    if not values:
        return
    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO fund_flow_daily (
                date, symbol, main_net_inflow, large_net_inflow,
                northbound_net_inflow, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(date, symbol) DO UPDATE SET
                main_net_inflow = excluded.main_net_inflow,
                large_net_inflow = excluded.large_net_inflow,
                northbound_net_inflow = excluded.northbound_net_inflow,
                updated_at = excluded.updated_at
            """,
            values,
        )
        conn.commit()


def load_fund_flows(symbol: str, start: str, end: str) -> pd.DataFrame:
    init_db()
    normalized = _normalize_symbol(symbol)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT * FROM fund_flow_daily
            WHERE symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (normalized, start, end),
        ).fetchall()
    return pd.DataFrame([_row_to_dict(row) for row in rows])
