from __future__ import annotations

import os

import pandas as pd

from tradingagents.dataflows.akshare_china import (
    get_china_index_data_frame_akshare,
    get_china_stock_data_frame_akshare,
    get_hk_index_data_frame_akshare,
    get_hk_stock_data_frame_akshare,
)
from tradingagents.dataflows.tushare_china import (
    get_china_stock_data_frame as get_china_stock_data_frame_tushare,
    get_hk_stock_data_frame as get_hk_stock_data_frame_tushare,
)
from tradingagents.dataflows.futu_market import (
    get_index_data_frame_futu,
    get_stock_data_frame_futu,
)
from tradingagents.dataflows.fund_flow import fetch_fund_flow_daily
from tradingagents.markets import Market, detect_market

from .index_catalog import DEFAULT_CHINA_INDEX_SYMBOLS, normalize_index_symbol, resolve_index_profile
from .quality import log_quality_issue
from .repository import (
    list_watchlist,
    upsert_daily_bars,
    upsert_fund_flows,
    upsert_index_bars,
)

DATA_SOURCES = ("akshare", "tushare", "futu", "auto")
DEFAULT_DATA_SOURCE = "akshare"


def _resolve_data_source(source: str | None = None) -> str:
    value = (source or os.getenv("TRADINGAGENTS_DATA_SOURCE") or DEFAULT_DATA_SOURCE)
    normalized = value.strip().lower()
    if normalized not in DATA_SOURCES:
        supported = ", ".join(DATA_SOURCES)
        raise ValueError(
            f"Unsupported research data source: {value}. Use one of: {supported}"
        )
    return normalized


def _fetch_daily_bars_from_source(
    symbol: str,
    start: str,
    end: str,
    *,
    market: Market,
    source: str,
) -> pd.DataFrame:
    if source == "futu":
        return get_stock_data_frame_futu(symbol, start, end)
    if market == Market.CHINA and source == "akshare":
        return get_china_stock_data_frame_akshare(symbol, start, end)
    if market == Market.HONGKONG and source == "akshare":
        return get_hk_stock_data_frame_akshare(symbol, start, end)
    if market == Market.CHINA and source == "tushare":
        return get_china_stock_data_frame_tushare(symbol, start, end)
    if market == Market.HONGKONG and source == "tushare":
        return get_hk_stock_data_frame_tushare(symbol, start, end)
    raise ValueError(f"Research data sync only supports A/H symbols: {symbol}")


def fetch_daily_bars(
    symbol: str, start: str, end: str, *, source: str | None = None
) -> pd.DataFrame:
    market = detect_market(symbol)
    data_source = _resolve_data_source(source)
    if data_source != "auto":
        return _fetch_daily_bars_from_source(
            symbol, start, end, market=market, source=data_source
        )

    errors = []
    for candidate in ("akshare", "tushare"):
        try:
            frame = _fetch_daily_bars_from_source(
                symbol, start, end, market=market, source=candidate
            )
        except Exception as exc:
            errors.append(f"{candidate}: {exc}")
            continue
        if not frame.empty:
            return frame

    if errors:
        raise RuntimeError("; ".join(errors))
    return pd.DataFrame()


def fetch_index_bars(
    index_symbol: str, start: str, end: str, *, source: str | None = None
) -> pd.DataFrame:
    data_source = _resolve_data_source(source)
    canonical = normalize_index_symbol(index_symbol)
    if data_source == "futu":
        return get_index_data_frame_futu(canonical, start, end)
    if data_source in {"akshare", "auto"}:
        profile = resolve_index_profile(canonical)
        if profile and profile.market == "HONGKONG":
            return get_hk_index_data_frame_akshare(canonical, start, end)
        return get_china_index_data_frame_akshare(canonical, start, end)
    raise ValueError("Index data sync currently supports akshare or auto")


def _sync_error_message(source: str, exc: Exception) -> str:
    message = f"{source} sync failed: {exc}"
    if len(message) > 500:
        return f"{message[:497]}..."
    return message


def sync_watchlist_bars(start: str, end: str, *, source: str | None = None) -> int:
    data_source = _resolve_data_source(source)
    total = 0
    for item in list_watchlist():
        symbol = item["symbol"]
        try:
            frame = fetch_daily_bars(symbol, start, end, source=data_source)
        except Exception as exc:
            log_quality_issue(
                check_name="data_sync",
                severity="error",
                date=end,
                symbol=symbol,
                message=_sync_error_message(data_source, exc),
            )
            continue
        if frame.empty:
            continue
        upsert_daily_bars(frame.to_dict("records"))
        total += len(frame)
    return total


def sync_index_bars(
    start: str,
    end: str,
    *,
    index_symbols: list[str] | None = None,
    source: str | None = None,
) -> int:
    data_source = _resolve_data_source(source)
    symbols = index_symbols or list(DEFAULT_CHINA_INDEX_SYMBOLS)
    total = 0
    for symbol in symbols:
        try:
            frame = fetch_index_bars(symbol, start, end, source=data_source)
        except Exception as exc:
            log_quality_issue(
                check_name="index_sync",
                severity="error",
                date=end,
                symbol=str(symbol),
                message=_sync_error_message(data_source, exc),
            )
            continue
        if frame.empty:
            continue
        upsert_index_bars(frame.to_dict("records"))
        total += len(frame)
    return total



def sync_watchlist_fund_flows(start: str, end: str) -> int:
    total = 0
    for item in list_watchlist():
        symbol = item["symbol"]
        try:
            frame = fetch_fund_flow_daily(symbol, start, end)
        except Exception as exc:
            log_quality_issue(
                check_name="fund_flow_sync",
                severity="warning",
                date=end,
                symbol=symbol,
                message=_sync_error_message("fund_flow", exc),
            )
            continue
        if frame.empty:
            log_quality_issue(
                check_name="fund_flow_sync",
                severity="warning",
                date=end,
                symbol=symbol,
                message="fund flow unavailable",
            )
            continue
        upsert_fund_flows(frame.to_dict("records"))
        total += len(frame)
    return total
