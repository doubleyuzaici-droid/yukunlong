from __future__ import annotations

import os
import re
import time
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import requests

from tradingagents.markets import (
    Market,
    detect_market,
    normalize_china_symbol,
    normalize_hk_symbol,
)

from tradingagents.dataflows.futu_market import (
    FUTU_DELAY_POLICY,
    fetch_futu_intraday_minutes,
    fetch_futu_snapshot,
)

from .index_catalog import resolve_index_profile
from .market_data import list_market_quotes, parse_symbol_list

TENCENT_QUOTE_URL = "https://qt.gtimg.cn/q={code}"
TENCENT_MINUTE_URL = "https://web.ifzq.gtimg.cn/appstock/app/minute/query"
REALTIME_DELAY_POLICY = "公开行情源准实时快照，非交易所授权实时行情"
INTRADAY_DELAY_POLICY = "公开行情源1分钟分时，非Level-2逐笔行情"
QUOTE_CACHE_TTL_SECONDS = 12
INTRADAY_CACHE_TTL_SECONDS = 25
ASIA_SHANGHAI = ZoneInfo("Asia/Shanghai")

_QUOTE_CACHE: dict[str, tuple[float, dict]] = {}
_INTRADAY_CACHE: dict[str, tuple[float, dict]] = {}


def clear_realtime_cache() -> None:
    _QUOTE_CACHE.clear()
    _INTRADAY_CACHE.clear()


def _now_iso() -> str:
    return datetime.now(ASIA_SHANGHAI).isoformat(timespec="seconds")


def _to_float(value: Any) -> float | None:
    try:
        if value is None or value == "":
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_percent_decimal(value: Any) -> float | None:
    parsed = _to_float(value)
    if parsed is None:
        return None
    return parsed / 100


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


def _normalize_symbol(symbol: str) -> str:
    index_profile = resolve_index_profile(symbol)
    if index_profile:
        return index_profile.canonical_symbol
    market = detect_market(symbol)
    if market == Market.CHINA:
        return normalize_china_symbol(symbol)
    if market == Market.HONGKONG:
        return normalize_hk_symbol(symbol)
    return symbol.strip().upper()


def _quote_provider() -> str:
    return os.getenv("TRADINGAGENTS_QUOTE_PROVIDER", "tencent").strip().lower()


def _tencent_code(symbol: str) -> str:
    index_profile = resolve_index_profile(symbol)
    if index_profile:
        if index_profile.market == "CHINA" and index_profile.akshare_symbol:
            return index_profile.akshare_symbol
        if index_profile.market == "HONGKONG":
            return f"hk{index_profile.canonical_symbol}"
    market = detect_market(symbol)
    if market == Market.CHINA:
        normalized = normalize_china_symbol(symbol)
        code, exchange = normalized.split(".")
        return f"{exchange.lower()}{code}"
    if market == Market.HONGKONG:
        return f"hk{normalize_hk_symbol(symbol).split('.')[0]}"
    raise ValueError(f"腾讯准实时行情暂不支持该市场: {symbol}")


def _parse_tencent_timestamp(raw: str | None) -> tuple[str | None, str | None, str | None]:
    if not raw:
        return None, None, None
    value = raw.strip()
    patterns = [
        ("%Y%m%d%H%M%S", value),
        ("%Y/%m/%d %H:%M:%S", value),
    ]
    for pattern, candidate in patterns:
        try:
            parsed = datetime.strptime(candidate, pattern).replace(tzinfo=ASIA_SHANGHAI)
            return (
                parsed.isoformat(timespec="seconds"),
                parsed.date().isoformat(),
                parsed.time().isoformat(timespec="seconds"),
            )
        except ValueError:
            continue
    return None, None, None


def _extract_tencent_fields(text: str) -> list[str]:
    match = re.search(r'="(.*)"', text.strip())
    if not match:
        raise ValueError("腾讯行情返回格式异常")
    fields = match.group(1).split("~")
    if len(fields) < 38:
        raise ValueError("腾讯行情字段数量不足")
    return fields


def _extract_amount(fields: list[str]) -> float | None:
    bundle = fields[35] if len(fields) > 35 else ""
    if "/" in bundle:
        parts = bundle.split("/")
        if len(parts) >= 3:
            amount = _to_float(parts[2])
            if amount is not None:
                return amount
    return _to_float(fields[37] if len(fields) > 37 else None)


def _fetch_tencent_quote_text(code: str) -> str:
    response = requests.get(
        TENCENT_QUOTE_URL.format(code=code),
        headers={"User-Agent": "Mozilla/5.0 TradingAgents/0.2"},
        timeout=8,
    )
    response.raise_for_status()
    response.encoding = "gbk"
    return response.text


def _fetch_tencent_intraday_payload(code: str) -> dict:
    response = requests.get(
        TENCENT_MINUTE_URL,
        params={"code": code},
        headers={"User-Agent": "Mozilla/5.0 TradingAgents/0.2"},
        timeout=8,
    )
    response.raise_for_status()
    return response.json()


def _fallback_quote(symbol: str, message: str) -> dict:
    payload = list_market_quotes([symbol])
    quote = payload["quotes"][0] if payload["quotes"] else {}
    if quote.get("status") == "ok":
        return {
            **quote,
            "name": None,
            "trade_time": None,
            "timestamp": None,
            "provider": quote.get("source") or "local_daily_cache",
            "provider_status": "fallback",
            "status": "fallback",
            "status_text": "准实时源不可用，已回退本地日线",
            "is_realtime": False,
            "delay_policy": quote.get("delay_policy") or "本地日线缓存，非实时行情",
            "refresh_interval_seconds": None,
            "error": message,
        }
    return {
        "symbol": symbol,
        "market": _market_name(symbol),
        "name": None,
        "trade_date": None,
        "trade_time": None,
        "timestamp": None,
        "price": None,
        "prev_close": None,
        "change": None,
        "change_pct": None,
        "open": None,
        "high": None,
        "low": None,
        "volume": None,
        "amount": None,
        "source": None,
        "provider": "tencent",
        "provider_status": "failed",
        "status": "unavailable",
        "status_text": "准实时行情不可用，且无本地日线可回退",
        "is_realtime": False,
        "delay_policy": REALTIME_DELAY_POLICY,
        "refresh_interval_seconds": None,
        "sparkline": [],
        "error": message,
    }


def fetch_realtime_quote(symbol: str, *, allow_fallback: bool = True) -> dict:
    normalized = _normalize_symbol(symbol)
    provider = _quote_provider()
    cache_key = f"quote:{provider}:{normalized}"
    cached = _QUOTE_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] <= QUOTE_CACHE_TTL_SECONDS:
        return dict(cached[1])

    try:
        if provider == "futu":
            quote = fetch_futu_snapshot(normalized)
            _QUOTE_CACHE[cache_key] = (time.monotonic(), quote)
            return dict(quote)
        code = _tencent_code(normalized)
        fields = _extract_tencent_fields(_fetch_tencent_quote_text(code))
        timestamp, trade_date, trade_time = _parse_tencent_timestamp(fields[30])
        price = _to_float(fields[3])
        prev_close = _to_float(fields[4])
        change = _to_float(fields[31])
        change_pct = _to_percent_decimal(fields[32])
        if change is None and price is not None and prev_close is not None:
            change = price - prev_close
        if change_pct is None and price is not None and prev_close not in (None, 0):
            change_pct = price / prev_close - 1
        quote = {
            "symbol": normalized,
            "market": _market_name(normalized),
            "name": fields[1] or None,
            "trade_date": trade_date,
            "trade_time": trade_time,
            "timestamp": timestamp,
            "price": price,
            "prev_close": prev_close,
            "change": change,
            "change_pct": change_pct,
            "open": _to_float(fields[5]),
            "high": _to_float(fields[33]),
            "low": _to_float(fields[34]),
            "volume": _to_float(fields[36] or fields[6]),
            "amount": _extract_amount(fields),
            "source": "tencent_quote",
            "provider": "tencent",
            "provider_status": "ok",
            "status": "live",
            "status_text": "准实时行情快照",
            "is_realtime": True,
            "delay_policy": REALTIME_DELAY_POLICY,
            "refresh_interval_seconds": QUOTE_CACHE_TTL_SECONDS,
            "sparkline": [],
            "error": None,
        }
        _QUOTE_CACHE[cache_key] = (time.monotonic(), quote)
        return dict(quote)
    except Exception as exc:
        if allow_fallback:
            return _fallback_quote(normalized, str(exc))
        raise


def list_realtime_quotes(symbols: list[str] | str, *, allow_fallback: bool = True) -> dict:
    normalized_symbols = parse_symbol_list(symbols)
    provider = _quote_provider()
    quotes = [
        fetch_realtime_quote(symbol, allow_fallback=allow_fallback)
        for symbol in normalized_symbols
    ]
    return {
        "requested_count": len(normalized_symbols),
        "loaded_count": sum(1 for quote in quotes if quote.get("status") in {"live", "fallback"}),
        "live_count": sum(1 for quote in quotes if quote.get("status") == "live"),
        "fallback_count": sum(1 for quote in quotes if quote.get("status") == "fallback"),
        "unavailable_count": sum(1 for quote in quotes if quote.get("status") == "unavailable"),
        "generated_at": _now_iso(),
        "refresh_interval_seconds": QUOTE_CACHE_TTL_SECONDS,
        "delay_policy": FUTU_DELAY_POLICY if provider == "futu" else REALTIME_DELAY_POLICY,
        "quotes": quotes,
    }


def _parse_intraday_points(
    *,
    symbol: str,
    trade_date: str,
    raw_points: list[str],
) -> list[dict]:
    normalized_date = f"{trade_date[:4]}-{trade_date[4:6]}-{trade_date[6:8]}"
    points = []
    previous_volume = 0.0
    previous_amount = 0.0
    for raw in raw_points:
        parts = raw.split()
        if len(parts) < 4:
            continue
        minute = parts[0]
        if len(minute) != 4:
            continue
        price = _to_float(parts[1])
        cumulative_volume = _to_float(parts[2]) or 0.0
        cumulative_amount = _to_float(parts[3]) or 0.0
        volume = max(0.0, cumulative_volume - previous_volume)
        amount = max(0.0, cumulative_amount - previous_amount)
        previous_volume = cumulative_volume
        previous_amount = cumulative_amount
        points.append(
            {
                "symbol": symbol,
                "date": normalized_date,
                "time": f"{minute[:2]}:{minute[2:]}",
                "datetime": f"{normalized_date}T{minute[:2]}:{minute[2:]}:00+08:00",
                "price": price,
                "volume": volume,
                "amount": amount,
                "cumulative_volume": cumulative_volume,
                "cumulative_amount": cumulative_amount,
            }
        )
    return points


def get_intraday_minutes(symbol: str, *, allow_fallback: bool = True) -> dict:
    normalized = _normalize_symbol(symbol)
    provider = _quote_provider()
    cache_key = f"intraday:{provider}:{normalized}"
    cached = _INTRADAY_CACHE.get(cache_key)
    if cached and time.monotonic() - cached[0] <= INTRADAY_CACHE_TTL_SECONDS:
        return dict(cached[1])

    quote = fetch_realtime_quote(normalized, allow_fallback=allow_fallback)
    try:
        if provider == "futu":
            result = fetch_futu_intraday_minutes(normalized, quote=quote)
            _INTRADAY_CACHE[cache_key] = (time.monotonic(), result)
            return dict(result)
        code = _tencent_code(normalized)
        payload = _fetch_tencent_intraday_payload(code)
        data = payload.get("data", {}).get(code, {}).get("data", {})
        trade_date = str(data.get("date") or "").strip()
        raw_points = data.get("data") or []
        if len(trade_date) != 8 or not raw_points:
            raise ValueError("腾讯分时返回为空")
        points = _parse_intraday_points(
            symbol=normalized,
            trade_date=trade_date,
            raw_points=raw_points,
        )
        if not points:
            raise ValueError("腾讯分时无有效点位")
        result = {
            "symbol": normalized,
            "market": _market_name(normalized),
            "date": points[-1]["date"],
            "interval": "1m",
            "point_count": len(points),
            "points": points,
            "quote": quote,
            "source": "tencent_minute",
            "provider": "tencent",
            "provider_status": "ok",
            "status": "live",
            "status_text": "1分钟分时行情",
            "is_realtime": True,
            "delay_policy": INTRADAY_DELAY_POLICY,
            "refresh_interval_seconds": INTRADAY_CACHE_TTL_SECONDS,
            "generated_at": _now_iso(),
            "error": None,
        }
        _INTRADAY_CACHE[cache_key] = (time.monotonic(), result)
        return dict(result)
    except Exception as exc:
        return {
            "symbol": normalized,
            "market": _market_name(normalized),
            "date": quote.get("trade_date"),
            "interval": "1m",
            "point_count": 0,
            "points": [],
            "quote": quote,
            "source": None,
            "provider": "tencent",
            "provider_status": "failed",
            "status": "unavailable",
            "status_text": "分时行情暂不可用",
            "is_realtime": False,
            "delay_policy": INTRADAY_DELAY_POLICY,
            "refresh_interval_seconds": INTRADAY_CACHE_TTL_SECONDS,
            "generated_at": _now_iso(),
            "error": str(exc),
        }
