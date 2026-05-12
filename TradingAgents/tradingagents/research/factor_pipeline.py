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


def compute_watchlist_factors(start: str, end: str) -> int:
    total = 0
    for item in list_watchlist():
        total += compute_symbol_factors(item["symbol"], start, end)
    return total
