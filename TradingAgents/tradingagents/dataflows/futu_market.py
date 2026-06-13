from __future__ import annotations

import os
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import pandas as pd

from tradingagents.markets import (
    Market,
    detect_market,
    normalize_china_symbol,
    normalize_hk_symbol,
)
from tradingagents.research.index_catalog import (
    normalize_index_symbol,
    resolve_index_profile,
)

RET_OK = 0
ASIA_SHANGHAI = ZoneInfo("Asia/Shanghai")
FUTU_DELAY_POLICY = "富途 OpenAPI 行情，权限和延迟以 OpenD 登录账号为准"
HISTORY_BAR_COLUMNS = [
    "date",
    "symbol",
    "market",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "amount",
    "source",
]
INDEX_BAR_COLUMNS = [
    "date",
    "index_symbol",
    "market",
    "open",
    "high",
    "low",
    "close",
    "volume",
    "amount",
    "source",
]


class FutuMarketDataError(RuntimeError):
    pass


def _load_futu_sdk():
    try:
        import futu
    except ImportError as exc:
        raise FutuMarketDataError("futu-api SDK is not installed; install with .[futu]") from exc
    return futu


def _futu_host() -> str:
    return os.getenv("TRADINGAGENTS_FUTU_HOST", "127.0.0.1")


def _futu_port() -> int:
    try:
        return int(os.getenv("TRADINGAGENTS_FUTU_PORT", "11111"))
    except ValueError as exc:
        raise FutuMarketDataError("TRADINGAGENTS_FUTU_PORT must be an integer") from exc


def _open_quote_context():
    futu = _load_futu_sdk()
    return futu.OpenQuoteContext(host=_futu_host(), port=_futu_port())


def to_futu_index_code(index_symbol: str) -> str:
    canonical = normalize_index_symbol(index_symbol)
    if canonical == "HSI":
        return "HK.800000"
    code, exchange = normalize_china_symbol(canonical).split(".")
    return f"{exchange}.{code}"


def to_futu_code(symbol: str) -> str:
    index_profile = resolve_index_profile(symbol)
    if index_profile:
        return to_futu_index_code(index_profile.canonical_symbol)
    market = detect_market(symbol)
    if market == Market.HONGKONG:
        code = normalize_hk_symbol(symbol).split(".")[0]
        return f"HK.{code}"
    if market == Market.CHINA:
        code, exchange = normalize_china_symbol(symbol).split(".")
        return f"{exchange}.{code}"
    return f"US.{symbol.strip().upper()}"


def from_futu_code(code: str, fallback_symbol: str | None = None) -> str:
    value = str(code or "").strip().upper()
    if fallback_symbol:
        index_profile = resolve_index_profile(fallback_symbol)
        if index_profile:
            return index_profile.canonical_symbol
    if value == "HK.800000":
        return "HSI"
    if value.startswith("HK."):
        return f"{value.split('.', 1)[1].zfill(5)}.HK"
    if value.startswith("SH.") or value.startswith("SZ."):
        exchange, raw_code = value.split(".", 1)
        return f"{raw_code}.{exchange}"
    if value.startswith("US."):
        return value.split(".", 1)[1]
    if fallback_symbol:
        market = detect_market(fallback_symbol)
        if market == Market.HONGKONG:
            return normalize_hk_symbol(fallback_symbol)
        if market == Market.CHINA:
            return normalize_china_symbol(fallback_symbol)
        return fallback_symbol.strip().upper()
    return value


def _market_name(symbol: str) -> str:
    index_profile = resolve_index_profile(symbol)
    if index_profile:
        return index_profile.market
    market = detect_market(symbol)
    if market == Market.CHINA:
        return "CHINA"
    if market == Market.HONGKONG:
        return "HONGKONG"
    return "US"


def _row_get(row: Any, key: str, default: Any = None) -> Any:
    if hasattr(row, "get"):
        return row.get(key, default)
    return getattr(row, key, default)


def _date_from_time_key(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return text[:10]


def _to_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_change_pct(value: Any) -> float | None:
    parsed = _to_float(value)
    if parsed is None:
        return None
    return parsed / 100 if abs(parsed) > 1 else parsed


def _first(row: Any, keys: list[str]) -> Any:
    for key in keys:
        value = _row_get(row, key)
        if value is not None and value != "":
            return value
    return None


def _parse_update_time(value: Any) -> tuple[str | None, str | None, str | None]:
    if value is None:
        return None, None, None
    text = str(value).strip()
    if not text:
        return None, None, None
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(text, pattern).replace(tzinfo=ASIA_SHANGHAI)
            return (
                parsed.isoformat(timespec="seconds"),
                parsed.date().isoformat(),
                parsed.time().isoformat(timespec="seconds"),
            )
        except ValueError:
            continue
    if len(text) >= 10:
        return None, text[:10], None
    return None, None, None


def _parse_intraday_time(value: Any, trade_date: str | None) -> tuple[str | None, str | None, str | None]:
    if value is None:
        return trade_date, None, None
    text = str(value).strip()
    if not text:
        return trade_date, None, None
    for pattern in ("%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S"):
        try:
            parsed = datetime.strptime(text, pattern).replace(tzinfo=ASIA_SHANGHAI)
            return (
                parsed.date().isoformat(),
                parsed.time().isoformat(timespec="seconds")[:5],
                parsed.isoformat(timespec="seconds"),
            )
        except ValueError:
            continue
    if len(text) >= 16 and text[4] == "-" and text[10] in {" ", "T"}:
        trade_date = text[:10]
        minute = text[11:16]
        return trade_date, minute, f"{trade_date}T{minute}:00+08:00"
    if len(text) >= 5 and text[2] == ":" and trade_date:
        minute = text[:5]
        return trade_date, minute, f"{trade_date}T{minute}:00+08:00"
    return trade_date, text[:5] if len(text) >= 5 else text, None


def _history_rows(frame: pd.DataFrame, fallback_symbol: str) -> list[dict]:
    rows: list[dict] = []
    for _, row in frame.iterrows():
        symbol = from_futu_code(str(_row_get(row, "code") or ""), fallback_symbol)
        trade_date = _date_from_time_key(_row_get(row, "time_key"))
        if not trade_date:
            continue
        rows.append(
            {
                "date": trade_date,
                "symbol": symbol,
                "market": _market_name(symbol),
                "open": _to_float(_row_get(row, "open")),
                "high": _to_float(_row_get(row, "high")),
                "low": _to_float(_row_get(row, "low")),
                "close": _to_float(_row_get(row, "close")),
                "volume": _to_float(_row_get(row, "volume")),
                "amount": _to_float(_row_get(row, "turnover")),
                "source": "futu_history_kline",
            }
        )
    return rows


def _index_history_rows(frame: pd.DataFrame, fallback_symbol: str) -> list[dict]:
    rows: list[dict] = []
    index_symbol = from_futu_code("", fallback_symbol)
    for _, row in frame.iterrows():
        row_symbol = from_futu_code(str(_row_get(row, "code") or ""), index_symbol)
        trade_date = _date_from_time_key(_row_get(row, "time_key"))
        if not trade_date:
            continue
        rows.append(
            {
                "date": trade_date,
                "index_symbol": row_symbol,
                "market": _market_name(row_symbol),
                "open": _to_float(_row_get(row, "open")),
                "high": _to_float(_row_get(row, "high")),
                "low": _to_float(_row_get(row, "low")),
                "close": _to_float(_row_get(row, "close")),
                "volume": _to_float(_row_get(row, "volume")),
                "amount": _to_float(_row_get(row, "turnover")),
                "source": "futu_history_kline",
            }
        )
    return rows


def _raise_for_ret(ret: int, data: Any, operation: str) -> None:
    if ret == RET_OK:
        return
    raise FutuMarketDataError(f"{operation} failed: {data}")


def get_stock_data_frame_futu(symbol: str, start: str, end: str) -> pd.DataFrame:
    futu_code = to_futu_code(symbol)
    context = _open_quote_context()
    frames: list[pd.DataFrame] = []
    page_req_key = None
    try:
        while True:
            ret, data, page_req_key = context.request_history_kline(
                futu_code,
                start=start,
                end=end,
                max_count=1000,
                page_req_key=page_req_key,
            )
            _raise_for_ret(ret, data, "request_history_kline")
            if isinstance(data, pd.DataFrame) and not data.empty:
                frames.append(data)
            if not page_req_key:
                break
    finally:
        close = getattr(context, "close", None)
        if callable(close):
            close()

    if not frames:
        return pd.DataFrame(columns=HISTORY_BAR_COLUMNS)
    rows: list[dict] = []
    for frame in frames:
        rows.extend(_history_rows(frame, symbol))
    return pd.DataFrame(rows, columns=HISTORY_BAR_COLUMNS)


def get_index_data_frame_futu(index_symbol: str, start: str, end: str) -> pd.DataFrame:
    canonical = normalize_index_symbol(index_symbol)
    futu_code = to_futu_index_code(canonical)
    context = _open_quote_context()
    frames: list[pd.DataFrame] = []
    page_req_key = None
    try:
        while True:
            ret, data, page_req_key = context.request_history_kline(
                futu_code,
                start=start,
                end=end,
                max_count=1000,
                page_req_key=page_req_key,
            )
            _raise_for_ret(ret, data, "request_history_kline")
            if isinstance(data, pd.DataFrame) and not data.empty:
                frames.append(data)
            if not page_req_key:
                break
    finally:
        close = getattr(context, "close", None)
        if callable(close):
            close()

    if not frames:
        return pd.DataFrame(columns=INDEX_BAR_COLUMNS)
    rows: list[dict] = []
    for frame in frames:
        rows.extend(_index_history_rows(frame, canonical))
    return pd.DataFrame(rows, columns=INDEX_BAR_COLUMNS)


def fetch_futu_intraday_minutes(symbol: str, quote: dict | None = None) -> dict:
    futu_code = to_futu_code(symbol)
    context = _open_quote_context()
    try:
        ret, data = context.get_rt_data(futu_code)
        _raise_for_ret(ret, data, "get_rt_data")
        if not isinstance(data, pd.DataFrame) or data.empty:
            raise FutuMarketDataError("get_rt_data returned no rows")
        frame = data
    finally:
        close = getattr(context, "close", None)
        if callable(close):
            close()

    normalized = from_futu_code(str(_first(frame.iloc[0], ["code"]) or futu_code), symbol)
    quote_date = str((quote or {}).get("trade_date") or "").strip() or None
    points: list[dict] = []
    for _, row in frame.iterrows():
        trade_date, minute, datetime_text = _parse_intraday_time(
            _first(row, ["time_key", "datetime", "time"]),
            quote_date,
        )
        price = _to_float(_first(row, ["cur_price", "price", "last_price"]))
        if not trade_date or not minute or price is None:
            continue
        volume = _to_float(_first(row, ["volume", "vol"]))
        amount = _to_float(_first(row, ["turnover", "amount"]))
        points.append(
            {
                "symbol": normalized,
                "date": trade_date,
                "time": minute,
                "datetime": datetime_text or f"{trade_date}T{minute}:00+08:00",
                "price": price,
                "volume": volume,
                "amount": amount,
                "cumulative_volume": _to_float(_first(row, ["cumulative_volume", "acc_volume"])) or volume,
                "cumulative_amount": _to_float(_first(row, ["cumulative_amount", "acc_turnover"])) or amount,
            }
        )
    if not points:
        raise FutuMarketDataError("get_rt_data returned no valid points")

    return {
        "symbol": normalized,
        "market": _market_name(normalized),
        "date": points[-1]["date"],
        "interval": "1m",
        "point_count": len(points),
        "points": points,
        "quote": quote,
        "source": "futu_rt_data",
        "provider": "futu",
        "provider_status": "ok",
        "status": "live",
        "status_text": "富途1分钟分时行情",
        "is_realtime": True,
        "delay_policy": FUTU_DELAY_POLICY,
        "refresh_interval_seconds": 25,
        "generated_at": datetime.now(ASIA_SHANGHAI).isoformat(timespec="seconds"),
        "error": None,
    }


def fetch_futu_snapshot(symbol: str) -> dict:
    futu_code = to_futu_code(symbol)
    context = _open_quote_context()
    try:
        ret, data = context.get_market_snapshot([futu_code])
        _raise_for_ret(ret, data, "get_market_snapshot")
        if not isinstance(data, pd.DataFrame) or data.empty:
            raise FutuMarketDataError("get_market_snapshot returned no rows")
        row = data.iloc[0]
    finally:
        close = getattr(context, "close", None)
        if callable(close):
            close()

    normalized = from_futu_code(str(_first(row, ["code"]) or futu_code), symbol)
    timestamp, trade_date, trade_time = _parse_update_time(_first(row, ["update_time", "time_key"]))
    price = _to_float(_first(row, ["last_price", "price"]))
    prev_close = _to_float(_first(row, ["prev_close_price", "prev_close"]))
    change = _to_float(_first(row, ["change_val", "change"]))
    change_pct = _to_change_pct(_first(row, ["change_rate", "change_pct"]))
    if change is None and price is not None and prev_close is not None:
        change = price - prev_close
    if change_pct is None and price is not None and prev_close not in (None, 0):
        change_pct = price / prev_close - 1
    return {
        "symbol": normalized,
        "market": _market_name(normalized),
        "name": _first(row, ["stock_name", "name"]),
        "trade_date": trade_date,
        "trade_time": trade_time,
        "timestamp": timestamp,
        "price": price,
        "prev_close": prev_close,
        "change": change,
        "change_pct": change_pct,
        "open": _to_float(_first(row, ["open_price", "open"])),
        "high": _to_float(_first(row, ["high_price", "high"])),
        "low": _to_float(_first(row, ["low_price", "low"])),
        "volume": _to_float(_first(row, ["volume"])),
        "amount": _to_float(_first(row, ["turnover", "amount"])),
        "source": "futu_snapshot",
        "provider": "futu",
        "provider_status": "ok",
        "status": "live",
        "status_text": "富途实时行情快照",
        "is_realtime": True,
        "delay_policy": FUTU_DELAY_POLICY,
        "refresh_interval_seconds": 12,
        "sparkline": [],
        "error": None,
    }
