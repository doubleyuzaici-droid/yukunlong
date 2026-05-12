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


def _stock_hsgt_hist_em() -> pd.DataFrame:
    import akshare as ak

    return ak.stock_hsgt_hist_em()


def _pick_column(frame: pd.DataFrame, names: tuple[str, ...]) -> pd.Series:
    for name in names:
        if name in frame:
            return frame[name]
    return pd.Series([pd.NA] * len(frame), index=frame.index)


def _load_northbound_series(start: str, end: str) -> pd.Series:
    try:
        frame = _stock_hsgt_hist_em()
    except Exception:
        return pd.Series(dtype="float64")
    if frame is None or frame.empty:
        return pd.Series(dtype="float64")
    date_series = pd.to_datetime(_pick_column(frame, ("日期", "date")), errors="coerce").dt.strftime("%Y-%m-%d")
    value_series = pd.to_numeric(
        _pick_column(frame, ("当日成交净买额", "当日资金净流入", "北向资金净流入", "net_buy")),
        errors="coerce",
    )
    series = pd.Series(value_series.values, index=date_series)
    series = series[(series.index >= start) & (series.index <= end)]
    return series


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
    if symbol.endswith(".SH") or symbol.endswith(".SZ"):
        northbound_map = _load_northbound_series(start, end)
        result["northbound_net_inflow"] = result["date"].map(northbound_map)
    else:
        result["northbound_net_inflow"] = pd.NA
    result = result[(result["date"] >= start) & (result["date"] <= end)]
    return result[_COLUMNS].reset_index(drop=True)
