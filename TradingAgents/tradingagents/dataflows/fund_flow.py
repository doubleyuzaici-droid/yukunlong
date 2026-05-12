from __future__ import annotations

import pandas as pd

_COLUMNS = [
    "date",
    "symbol",
    "main_net_inflow",
    "large_net_inflow",
    "northbound_net_inflow",
]


def _stock_individual_fund_flow(symbol: str) -> pd.DataFrame:
    import akshare as ak

    return ak.stock_individual_fund_flow(stock=symbol)


def fetch_fund_flow_daily(symbol: str, start: str, end: str) -> pd.DataFrame:
    code = symbol.split(".")[0]
    try:
        frame = _stock_individual_fund_flow(code)
    except Exception:
        return pd.DataFrame(columns=_COLUMNS)
    if frame is None or frame.empty:
        return pd.DataFrame(columns=_COLUMNS)

    result = pd.DataFrame()
    result["date"] = pd.to_datetime(frame.get("日期"), errors="coerce").dt.strftime("%Y-%m-%d")
    result["symbol"] = symbol
    result["main_net_inflow"] = pd.to_numeric(frame.get("主力净流入-净额"), errors="coerce")
    result["large_net_inflow"] = pd.to_numeric(frame.get("超大单净流入-净额"), errors="coerce")
    result["northbound_net_inflow"] = pd.NA
    result = result[(result["date"] >= start) & (result["date"] <= end)]
    return result[_COLUMNS].reset_index(drop=True)
