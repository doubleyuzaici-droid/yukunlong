from __future__ import annotations

import pandas as pd

from tradingagents.dataflows.tushare_china import (
    get_china_stock_data_frame,
    get_hk_stock_data_frame,
)
from tradingagents.markets import Market, detect_market

from .repository import list_watchlist, upsert_daily_bars


def fetch_daily_bars(symbol: str, start: str, end: str) -> pd.DataFrame:
    market = detect_market(symbol)
    if market == Market.CHINA:
        return get_china_stock_data_frame(symbol, start, end)
    if market == Market.HONGKONG:
        return get_hk_stock_data_frame(symbol, start, end)
    raise ValueError(f"Research data sync only supports A/H symbols: {symbol}")


def sync_watchlist_bars(start: str, end: str) -> int:
    total = 0
    for item in list_watchlist():
        frame = fetch_daily_bars(item["symbol"], start, end)
        if frame.empty:
            continue
        upsert_daily_bars(frame.to_dict("records"))
        total += len(frame)
    return total
