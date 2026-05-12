from __future__ import annotations

from datetime import datetime, timezone

import pandas as pd

from tradingagents.backtest.metrics import summarize_events
from tradingagents.research.db import get_connection, init_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load_signals(signal_names: list[str] | None, start: str, end: str) -> list[dict]:
    init_db()
    params: list = [start, end]
    query = """
        SELECT *
        FROM signal_log
        WHERE date >= ? AND date <= ?
    """
    if signal_names:
        placeholders = ",".join("?" for _ in signal_names)
        query += f" AND signal_name IN ({placeholders})"
        params.extend(signal_names)
    query += " ORDER BY date, symbol, signal_name"
    with get_connection() as conn:
        return [dict(row) for row in conn.execute(query, params).fetchall()]


def _load_bars(symbol: str) -> pd.DataFrame:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM daily_bars
            WHERE symbol = ?
            ORDER BY date
            """,
            (symbol,),
        ).fetchall()
    return pd.DataFrame([dict(row) for row in rows])


def _benchmark_symbol_for_market(market: str | None) -> str | None:
    if market == "CHINA":
        return "000300.SH"
    if market == "HONGKONG":
        return "HSI"
    return "SPY"


def _load_index_bars(index_symbol: str) -> pd.DataFrame:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM index_bars WHERE index_symbol = ? ORDER BY date",
            (index_symbol,),
        ).fetchall()
    return pd.DataFrame([dict(row) for row in rows])


def _persist_event(row: dict) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO event_return (
                signal_id, entry_date, entry_price, ret_5d, ret_20d, ret_60d,
                excess_index_20d, excess_industry_20d, max_adverse_20d,
                max_favorable_20d, success_flag, fail_reason, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(signal_id) DO UPDATE SET
                entry_date = excluded.entry_date,
                entry_price = excluded.entry_price,
                ret_5d = excluded.ret_5d,
                ret_20d = excluded.ret_20d,
                ret_60d = excluded.ret_60d,
                excess_index_20d = excluded.excess_index_20d,
                excess_industry_20d = excluded.excess_industry_20d,
                max_adverse_20d = excluded.max_adverse_20d,
                max_favorable_20d = excluded.max_favorable_20d,
                success_flag = excluded.success_flag,
                fail_reason = excluded.fail_reason,
                updated_at = excluded.updated_at
            """,
            (
                row["signal_id"],
                row.get("entry_date"),
                row.get("entry_price"),
                row.get("ret_5d"),
                row.get("ret_20d"),
                row.get("ret_60d"),
                row.get("excess_index_20d"),
                row.get("excess_industry_20d"),
                row.get("max_adverse_20d"),
                row.get("max_favorable_20d"),
                row.get("success_flag"),
                row.get("fail_reason"),
                _now(),
            ),
        )
        conn.commit()


def _failure(signal: dict, reason: str) -> dict:
    row = {
        "signal_id": signal["signal_id"],
        "symbol": signal["symbol"],
        "signal_name": signal["signal_name"],
        "fail_reason": reason,
    }
    _persist_event(row)
    return row


def _calculate_event(
    signal: dict, bars: pd.DataFrame, horizon_days: tuple[int, ...]
) -> dict | None:
    signal_index = bars.index[bars["date"] == signal["date"]]
    if len(signal_index) == 0:
        return None
    entry_position = int(signal_index[0]) + 1
    if entry_position >= len(bars):
        return None
    entry = bars.iloc[entry_position]
    if entry.get("is_suspended", 0) or pd.isna(entry.get("open")):
        return None

    entry_price = float(entry["open"])
    event = {
        "signal_id": signal["signal_id"],
        "date": signal["date"],
        "symbol": signal["symbol"],
        "market": signal.get("market"),
        "signal_name": signal["signal_name"],
        "signal_level": signal.get("signal_level"),
        "entry_date": entry["date"],
        "entry_price": entry_price,
        "excess_index_20d": None,
        "excess_industry_20d": None,
        "fail_reason": None,
    }
    for horizon in horizon_days:
        exit_position = entry_position + horizon
        key = f"ret_{horizon}d"
        event[key] = (
            float(bars.iloc[exit_position]["close"]) / entry_price - 1
            if exit_position < len(bars)
            else None
        )
    window_20 = bars.iloc[entry_position : min(entry_position + 21, len(bars))]
    event["max_adverse_20d"] = float(window_20["low"].min()) / entry_price - 1
    event["max_favorable_20d"] = float(window_20["high"].max()) / entry_price - 1
    event["success_flag"] = 1 if event.get("ret_20d") and event["ret_20d"] > 0 else 0

    if event.get("ret_20d") is not None:
        benchmark_symbol = _benchmark_symbol_for_market(signal.get("market"))
        if benchmark_symbol:
            benchmark_bars = _load_index_bars(benchmark_symbol)
            if not benchmark_bars.empty:
                entry_match = benchmark_bars[benchmark_bars["date"] == event["entry_date"]]
                if not entry_match.empty:
                    entry_idx = int(entry_match.index[0])
                    exit_idx = entry_idx + 20
                    if exit_idx < len(benchmark_bars):
                        index_entry = float(benchmark_bars.iloc[entry_idx]["close"])
                        index_exit = float(benchmark_bars.iloc[exit_idx]["close"])
                        index_ret_20d = index_exit / index_entry - 1
                        event["excess_index_20d"] = event["ret_20d"] - index_ret_20d
    return event


def run_event_backtest(
    signal_names: list[str] | None,
    start: str,
    end: str,
    horizon_days: tuple[int, ...] = (5, 20, 60),
) -> dict:
    init_db()
    events = []
    failures = []
    for signal in _load_signals(signal_names, start, end):
        bars = _load_bars(signal["symbol"])
        event = _calculate_event(signal, bars, horizon_days)
        if event is None:
            failures.append(_failure(signal, "no_executable_entry"))
            continue
        _persist_event(event)
        events.append(event)
    return {
        "start": start,
        "end": end,
        "signal_names": signal_names,
        "events": events,
        "failures": failures,
        "summary": summarize_events(events),
    }
