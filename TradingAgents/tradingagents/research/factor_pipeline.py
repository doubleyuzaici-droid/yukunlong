from __future__ import annotations

import math
from typing import Any

import pandas as pd

from tradingagents.markets import Market, detect_market
from tradingagents.research.features.technical import add_all_technical_features
from tradingagents.research.features.timeframe import (
    classify_monthly_state,
    classify_weekly_state,
    resample_monthly,
    resample_weekly,
)

from .db import get_connection
from .quality import log_quality_issue
from .repository import (
    list_watchlist,
    load_daily_bars,
    load_fund_flows,
    upsert_factors,
)


def _clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if pd.isna(value):
        return None
    return value


def _factor_rows(frame: pd.DataFrame, fund_flow: pd.DataFrame | None = None) -> list[dict]:
    if frame.empty:
        return []
    features = add_all_technical_features(frame)
    weekly_state = classify_weekly_state(resample_weekly(frame))
    monthly_state = classify_monthly_state(resample_monthly(frame))
    rows = []
    flow_map = {}
    if fund_flow is not None and not fund_flow.empty:
        flow = fund_flow.sort_values("date").copy()
        flow["main_ratio20"] = flow["main_net_inflow"] / flow["main_net_inflow"].abs().rolling(20).mean()
        flow["northbound_5d"] = flow["northbound_net_inflow"].rolling(5).sum()
        flow_map = {row["date"]: row for row in flow.to_dict("records")}
    for row in features.to_dict("records"):
        rows.append(
            {
                "date": row["date"],
                "symbol": row["symbol"],
                "ma20": _clean_value(row.get("ma20")),
                "ma60": _clean_value(row.get("ma60")),
                "ma120": _clean_value(row.get("ma120")),
                "rsi14": _clean_value(row.get("rsi14")),
                "atr14": _clean_value(row.get("atr14")),
                "volume_ratio20": _clean_value(row.get("volume_ratio20")),
                "amount_ratio20": _clean_value(row.get("amount_ratio20")),
                "ret20": _clean_value(row.get("ret20")),
                "ret60": _clean_value(row.get("ret60")),
                "weekly_state": weekly_state,
                "monthly_state": monthly_state,
                "main_net_inflow_ratio20": _clean_value(flow_map.get(row["date"], {}).get("main_ratio20")),
                "northbound_inflow_5d": _clean_value(flow_map.get(row["date"], {}).get("northbound_5d")),
            }
        )
    return rows


def compute_symbol_factors(symbol: str, start: str, end: str) -> int:
    frame = load_daily_bars(symbol, start, end)
    fund_flow = load_fund_flows(symbol, start, end)
    if fund_flow.empty:
        log_quality_issue("fund_flow_missing", "warning", "fund flow data unavailable", date=end, symbol=symbol)
    rows = _factor_rows(frame, fund_flow)
    if rows:
        upsert_factors(rows)
    return len(rows)


def _benchmark_symbol_for_market(symbol: str) -> str | None:
    market = detect_market(symbol)
    if market == Market.CHINA:
        return "000300.SH"
    if market == Market.HONGKONG:
        return "HSI"
    return "SPY"


def _index_ret20_by_date(index_symbol: str, start: str, end: str) -> dict[str, float]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT date, close
            FROM index_bars
            WHERE index_symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (index_symbol, start, end),
        ).fetchall()
    if not rows:
        return {}
    frame = pd.DataFrame([dict(row) for row in rows])
    frame["ret20"] = frame["close"] / frame["close"].shift(20) - 1
    return {
        row["date"]: float(row["ret20"])
        for row in frame.to_dict("records")
        if row.get("ret20") is not None and not pd.isna(row.get("ret20"))
    }


def _factor_ret20_rows(symbols: list[str], start: str, end: str) -> list[dict]:
    if not symbols:
        return []
    placeholders = ",".join("?" for _ in symbols)
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT date, symbol, ret20
            FROM factor_daily
            WHERE symbol IN ({placeholders})
              AND date >= ? AND date <= ?
              AND ret20 IS NOT NULL
            ORDER BY date, symbol
            """,
            (*symbols, start, end),
        ).fetchall()
    return [dict(row) for row in rows]


def _industry_relative_map(watchlist: list[dict], start: str, end: str) -> dict[tuple[str, str], float]:
    industry_symbols: dict[str, list[str]] = {}
    for item in watchlist:
        industry = item.get("industry")
        if not industry:
            continue
        industry_symbols.setdefault(industry, []).append(item["symbol"])

    relative: dict[tuple[str, str], float] = {}
    for symbols in industry_symbols.values():
        if len(symbols) < 2:
            continue
        rows = _factor_ret20_rows(symbols, start, end)
        by_date: dict[str, list[dict]] = {}
        for row in rows:
            by_date.setdefault(row["date"], []).append(row)
        for date_key, date_rows in by_date.items():
            if len(date_rows) < 2:
                continue
            for row in date_rows:
                peers = [
                    float(peer["ret20"])
                    for peer in date_rows
                    if peer["symbol"] != row["symbol"] and peer.get("ret20") is not None
                ]
                if not peers:
                    continue
                relative[(row["symbol"], date_key)] = float(row["ret20"]) - sum(peers) / len(peers)
    return relative


def _update_relative_strengths(start: str, end: str) -> int:
    watchlist = list_watchlist()
    if not watchlist:
        return 0
    symbols = [item["symbol"] for item in watchlist]
    factor_rows = _factor_ret20_rows(symbols, start, end)
    industry_relative = _industry_relative_map(watchlist, start, end)
    index_returns_by_symbol: dict[str, dict[str, float]] = {}
    updates = []

    for row in factor_rows:
        symbol = row["symbol"]
        benchmark_symbol = _benchmark_symbol_for_market(symbol)
        index_relative = None
        if benchmark_symbol:
            if symbol not in index_returns_by_symbol:
                index_returns_by_symbol[symbol] = _index_ret20_by_date(
                    benchmark_symbol, start, end
                )
            benchmark_ret = index_returns_by_symbol[symbol].get(row["date"])
            if benchmark_ret is not None:
                index_relative = float(row["ret20"]) - benchmark_ret
        industry_value = industry_relative.get((symbol, row["date"]))
        if index_relative is None and industry_value is None:
            continue
        updates.append((index_relative, industry_value, symbol, row["date"]))

    if not updates:
        return 0
    with get_connection() as conn:
        conn.executemany(
            """
            UPDATE factor_daily
            SET rel_strength_index20 = COALESCE(?, rel_strength_index20),
                rel_strength_industry20 = COALESCE(?, rel_strength_industry20)
            WHERE symbol = ? AND date = ?
            """,
            updates,
        )
        conn.commit()
    return len(updates)


def compute_watchlist_factors(start: str, end: str) -> int:
    total = 0
    for item in list_watchlist():
        total += compute_symbol_factors(item["symbol"], start, end)
    _update_relative_strengths(start, end)
    return total
