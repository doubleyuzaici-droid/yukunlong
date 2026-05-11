from __future__ import annotations

import math
from typing import Any

import pandas as pd

from tradingagents.research.features.technical import add_all_technical_features
from tradingagents.research.features.timeframe import (
    classify_monthly_state,
    classify_weekly_state,
    resample_monthly,
    resample_weekly,
)

from .repository import list_watchlist, load_daily_bars, upsert_factors


def _clean_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, float) and math.isnan(value):
        return None
    if pd.isna(value):
        return None
    return value


def _factor_rows(frame: pd.DataFrame) -> list[dict]:
    if frame.empty:
        return []
    features = add_all_technical_features(frame)
    weekly_state = classify_weekly_state(resample_weekly(frame))
    monthly_state = classify_monthly_state(resample_monthly(frame))
    rows = []
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
            }
        )
    return rows


def compute_symbol_factors(symbol: str, start: str, end: str) -> int:
    frame = load_daily_bars(symbol, start, end)
    rows = _factor_rows(frame)
    if rows:
        upsert_factors(rows)
    return len(rows)


def compute_watchlist_factors(start: str, end: str) -> int:
    total = 0
    for item in list_watchlist():
        total += compute_symbol_factors(item["symbol"], start, end)
    return total
