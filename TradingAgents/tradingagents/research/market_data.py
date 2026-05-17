from __future__ import annotations

from datetime import date, timedelta
from typing import Any

from tradingagents.markets import (
    ChinaBoard,
    HongKongBoard,
    Market,
    classify_china_symbol,
    classify_hk_symbol,
    detect_market,
    normalize_china_symbol,
    normalize_hk_symbol,
)

from .db import get_connection, init_db
from .features.market_state import classify_market_state
from .index_catalog import resolve_index_profile
from .repository import list_watchlist

DEFAULT_MARKET_SYMBOLS = ["600519.SH", "00700.HK", "AAPL", "MSFT"]


def normalize_market_symbol(symbol: str) -> str:
    index_profile = resolve_index_profile(symbol)
    if index_profile:
        return index_profile.canonical_symbol
    market = detect_market(symbol)
    if market == Market.CHINA:
        return normalize_china_symbol(symbol)
    if market == Market.HONGKONG:
        return normalize_hk_symbol(symbol)
    return symbol.strip().upper()


def parse_symbol_list(symbols: str | list[str] | None) -> list[str]:
    if symbols is None:
        return []
    if isinstance(symbols, str):
        raw_symbols = symbols.replace("，", ",").replace(" ", ",").split(",")
    else:
        raw_symbols = symbols
    normalized: list[str] = []
    seen: set[str] = set()
    for raw_symbol in raw_symbols:
        value = str(raw_symbol).strip()
        if not value:
            continue
        symbol = normalize_market_symbol(value)
        if symbol in seen:
            continue
        seen.add(symbol)
        normalized.append(symbol)
    return normalized


def _row_to_dict(row: Any) -> dict:
    return dict(row)


def _market_name(symbol: str, fallback: str | None = None) -> str:
    if fallback:
        return fallback
    market = detect_market(symbol)
    if market == Market.CHINA:
        return "CHINA"
    if market == Market.HONGKONG:
        return "HONGKONG"
    return "US"


def _change(price: float | None, prev_close: float | None) -> tuple[float | None, float | None]:
    if price is None or prev_close in (None, 0):
        return None, None
    absolute = price - prev_close
    return absolute, absolute / prev_close


def _freshness(trade_date: str | None) -> dict:
    if not trade_date:
        return {
            "data_age_days": None,
            "freshness_status": "missing",
            "freshness_text": "无本地行情",
            "delay_policy": "本地日线缓存，非实时行情",
        }
    age = max(0, (date.today() - date.fromisoformat(trade_date)).days)
    if age <= 1:
        status = "fresh"
        text = "最近交易日"
    elif age <= 5:
        status = "delayed"
        text = f"延迟 {age} 天"
    else:
        status = "stale"
        text = f"陈旧 {age} 天"
    return {
        "data_age_days": age,
        "freshness_status": status,
        "freshness_text": text,
        "delay_policy": "本地日线缓存，非实时行情",
    }


def _quote_from_rows(symbol: str, rows: list[dict], sparkline: list[dict]) -> dict:
    if not rows:
        return {
            "symbol": symbol,
            "market": _market_name(symbol),
            "trade_date": None,
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
            "status": "missing",
            "status_text": "本地研究库暂无行情",
            **_freshness(None),
            "sparkline": [],
        }

    latest = rows[0]
    previous = rows[1] if len(rows) > 1 else None
    price = latest.get("close")
    prev_close = previous.get("close") if previous else None
    change, change_pct = _change(price, prev_close)
    return {
        "symbol": symbol,
        "market": _market_name(symbol, latest.get("market")),
        "trade_date": latest.get("date"),
        "price": price,
        "prev_close": prev_close,
        "change": change,
        "change_pct": change_pct,
        "open": latest.get("open"),
        "high": latest.get("high"),
        "low": latest.get("low"),
        "volume": latest.get("volume"),
        "amount": latest.get("amount"),
        "source": latest.get("source"),
        "status": "ok",
        "status_text": "本地研究库最新行情",
        **_freshness(latest.get("date")),
        "sparkline": sparkline,
    }


def _recent_sparkline(symbol: str, limit: int = 24) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT date, close
            FROM daily_bars
            WHERE symbol = ? AND close IS NOT NULL
            ORDER BY date DESC
            LIMIT ?
            """,
            (symbol, limit),
        ).fetchall()
    return [
        {"date": row["date"], "close": row["close"]}
        for row in reversed(rows)
    ]


def _recent_index_sparkline(index_symbol: str, limit: int = 24) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT date, close
            FROM index_bars
            WHERE index_symbol = ? AND close IS NOT NULL
            ORDER BY date DESC
            LIMIT ?
            """,
            (index_symbol, limit),
        ).fetchall()
    return [{"date": row["date"], "close": row["close"]} for row in reversed(rows)]


def list_market_quotes(symbols: list[str] | str, *, sparkline_limit: int = 24) -> dict:
    init_db()
    normalized_symbols = parse_symbol_list(symbols)
    quotes = []
    with get_connection() as conn:
        for symbol in normalized_symbols:
            index_profile = resolve_index_profile(symbol)
            if index_profile:
                rows = conn.execute(
                    """
                    SELECT *
                    FROM index_bars
                    WHERE index_symbol = ?
                    ORDER BY date DESC
                    LIMIT 2
                    """,
                    (index_profile.canonical_symbol,),
                ).fetchall()
                quote = _quote_from_rows(
                    index_profile.canonical_symbol,
                    [_row_to_dict(row) for row in rows],
                    _recent_index_sparkline(
                        index_profile.canonical_symbol, limit=sparkline_limit
                    ),
                )
                quote["asset_type"] = "index"
                quote["name"] = index_profile.name
            else:
                rows = conn.execute(
                    """
                    SELECT *
                    FROM daily_bars
                    WHERE symbol = ?
                    ORDER BY date DESC
                    LIMIT 2
                    """,
                    (symbol,),
                ).fetchall()
                quote = _quote_from_rows(
                    symbol,
                    [_row_to_dict(row) for row in rows],
                    _recent_sparkline(symbol, limit=sparkline_limit),
                )
                quote["asset_type"] = "equity"
            quotes.append(quote)

    loaded_count = sum(1 for quote in quotes if quote["status"] == "ok")
    return {
        "requested_count": len(normalized_symbols),
        "loaded_count": loaded_count,
        "missing_count": len(normalized_symbols) - loaded_count,
        "quotes": quotes,
    }


def get_market_history(
    symbol: str,
    *,
    start: str | None = None,
    end: str | None = None,
    limit: int = 180,
) -> dict:
    init_db()
    raw_symbol = str(symbol).strip().upper()
    index_profile = resolve_index_profile(raw_symbol)
    normalized_symbol = (
        index_profile.canonical_symbol if index_profile else normalize_market_symbol(symbol)
    )
    resolved_end = end or date.today().isoformat()
    resolved_start = start or (date.fromisoformat(resolved_end) - timedelta(days=365)).isoformat()
    if index_profile:
        display_name = f"{index_profile.name} / {index_profile.canonical_symbol}"
        alias_notice = (
            f"{raw_symbol} 已标准化为 {display_name}"
            if raw_symbol != normalized_symbol
            else None
        )
        with get_connection() as conn:
            rows = conn.execute(
                """
                SELECT *
                FROM index_bars
                WHERE index_symbol = ? AND date >= ? AND date <= ?
                ORDER BY date
                """,
                (normalized_symbol, resolved_start, resolved_end),
            ).fetchall()
            quote_rows = conn.execute(
                """
                SELECT *
                FROM index_bars
                WHERE index_symbol = ?
                ORDER BY date DESC
                LIMIT 2
                """,
                (normalized_symbol,),
            ).fetchall()
        bars = [_row_to_dict(row) for row in rows]
        if limit > 0:
            bars = bars[-limit:]
        quote = _quote_from_rows(
            normalized_symbol,
            [_row_to_dict(row) for row in quote_rows],
            _recent_index_sparkline(normalized_symbol),
        )
        quote["asset_type"] = "index"
        quote["name"] = index_profile.name
        quote["display_name"] = display_name
        quote["alias_notice"] = alias_notice
        return {
            "symbol": normalized_symbol,
            "alias_symbol": raw_symbol if raw_symbol != normalized_symbol else None,
            "asset_type": "index",
            "name": index_profile.name,
            "display_name": display_name,
            "alias_notice": alias_notice,
            "start": resolved_start,
            "end": resolved_end,
            "bar_count": len(bars),
            "quote": quote,
            "bars": bars,
        }

    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM daily_bars
            WHERE symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (normalized_symbol, resolved_start, resolved_end),
        ).fetchall()
    bars = [_row_to_dict(row) for row in rows]
    if limit > 0:
        bars = bars[-limit:]
    quote_payload = list_market_quotes([normalized_symbol])
    quote = quote_payload["quotes"][0] if quote_payload["quotes"] else None
    return {
        "symbol": normalized_symbol,
        "asset_type": "equity",
        "alias_symbol": None,
        "start": resolved_start,
        "end": resolved_end,
        "bar_count": len(bars),
        "quote": quote,
        "bars": bars,
    }


def _latest_before(table: str, symbol: str, end: str) -> dict | None:
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT *
            FROM {table}
            WHERE symbol = ? AND date <= ?
            ORDER BY date DESC
            LIMIT 1
            """,
            (symbol, end),
        ).fetchone()
    return _row_to_dict(row) if row else None


def _series_rows(table: str, symbol: str, start: str, end: str, limit: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            f"""
            SELECT *
            FROM {table}
            WHERE symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (symbol, start, end),
        ).fetchall()
    data = [_row_to_dict(row) for row in rows]
    return data[-limit:] if limit > 0 else data


def _count_rows(table: str, symbol: str, start: str, end: str) -> int:
    with get_connection() as conn:
        row = conn.execute(
            f"""
            SELECT COUNT(*) AS count
            FROM {table}
            WHERE symbol = ? AND date >= ? AND date <= ?
            """,
            (symbol, start, end),
        ).fetchone()
    return int(row["count"] if row else 0)


def _index_series_rows(index_symbol: str, start: str, end: str, limit: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM index_bars
            WHERE index_symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (index_symbol, start, end),
        ).fetchall()
    data = [_row_to_dict(row) for row in rows]
    return data[-limit:] if limit > 0 else data


def _count_index_rows(index_symbol: str, start: str, end: str) -> int:
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT COUNT(*) AS count
            FROM index_bars
            WHERE index_symbol = ? AND date >= ? AND date <= ?
            """,
            (index_symbol, start, end),
        ).fetchone()
    return int(row["count"] if row else 0)


def _as_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number


def _avg(values: list[float]) -> float | None:
    return sum(values) / len(values) if values else None


def _rsi(closes: list[float], period: int = 14) -> float | None:
    if len(closes) <= period:
        return None
    deltas = [
        closes[index] - closes[index - 1]
        for index in range(len(closes) - period, len(closes))
    ]
    gains = [value for value in deltas if value > 0]
    losses = [-value for value in deltas if value < 0]
    avg_gain = _avg(gains) or 0.0
    avg_loss = _avg(losses) or 0.0
    if avg_loss == 0:
        return 100.0 if avg_gain > 0 else 50.0
    rs = avg_gain / avg_loss
    return 100 - 100 / (1 + rs)


def _atr(rows: list[dict], end_index: int, period: int = 14) -> float | None:
    start_index = max(0, end_index - period + 1)
    true_ranges: list[float] = []
    for index in range(start_index, end_index + 1):
        high = _as_float(rows[index].get("high"))
        low = _as_float(rows[index].get("low"))
        if high is None or low is None:
            continue
        previous_close = _as_float(rows[index - 1].get("close")) if index > 0 else None
        ranges = [high - low]
        if previous_close is not None:
            ranges.extend([abs(high - previous_close), abs(low - previous_close)])
        true_ranges.append(max(ranges))
    return _avg(true_ranges)


def derive_index_factor_series(index_symbol: str, rows: list[dict]) -> list[dict]:
    factors: list[dict] = []
    closes: list[float] = []
    volumes: list[float] = []
    amounts: list[float] = []
    for index, row in enumerate(rows):
        close = _as_float(row.get("close"))
        if close is None:
            continue
        closes.append(close)
        volumes.append(_as_float(row.get("volume")) or 0.0)
        amounts.append(_as_float(row.get("amount")) or 0.0)
        close_window20 = closes[-20:]
        close_window60 = closes[-60:]
        close_window120 = closes[-120:]
        volume_window20 = volumes[-20:]
        amount_window20 = amounts[-20:]
        ma20 = _avg(close_window20) if len(close_window20) >= 20 else None
        ma60 = _avg(close_window60) if len(close_window60) >= 60 else None
        ma120 = _avg(close_window120) if len(close_window120) >= 120 else None
        ret20 = close / closes[-21] - 1 if len(closes) >= 21 and closes[-21] else None
        ret60 = close / closes[-61] - 1 if len(closes) >= 61 and closes[-61] else None
        volume_ratio20 = (
            volumes[-1] / (_avg(volume_window20) or volumes[-1])
            if len(volume_window20) >= 20 and (_avg(volume_window20) or 0) > 0
            else None
        )
        amount_ratio20 = (
            amounts[-1] / (_avg(amount_window20) or amounts[-1])
            if len(amount_window20) >= 20 and (_avg(amount_window20) or 0) > 0
            else None
        )
        weekly_state = "uptrend" if ma20 is not None and close >= ma20 else "range"
        factors.append(
            {
                "date": row.get("date"),
                "symbol": index_symbol,
                "ma20": ma20,
                "ma60": ma60,
                "ma120": ma120,
                "rsi14": _rsi(closes),
                "atr14": _atr(rows, index),
                "volume_ratio20": volume_ratio20,
                "amount_ratio20": amount_ratio20,
                "ret20": ret20,
                "ret60": ret60,
                "rel_strength_index20": ret20,
                "rel_strength_industry20": None,
                "weekly_state": weekly_state,
                "monthly_state": "range",
                "source": "index_bars_derived",
                "updated_at": row.get("updated_at"),
            }
        )
    return factors


def _security_profile(symbol: str) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM security_master WHERE symbol = ?",
            (symbol,),
        ).fetchone()
    return _row_to_dict(row) if row else {}


def _price_limit_for_china(symbol: str, is_st: bool) -> float:
    board = classify_china_symbol(symbol)
    if is_st:
        return 0.05
    if board in {ChinaBoard.CHINEXT, ChinaBoard.STAR}:
        return 0.20
    if board == ChinaBoard.BSE:
        return 0.30
    return 0.10


def _recent_trade_dates(symbol: str, end: str | None = None, limit: int = 5) -> list[str]:
    query = """
        SELECT date
        FROM daily_bars
        WHERE symbol = ?
    """
    params: list = [symbol]
    if end:
        query += " AND date <= ?"
        params.append(end)
    query += " ORDER BY date DESC LIMIT ?"
    params.append(limit)
    with get_connection() as conn:
        rows = conn.execute(query, params).fetchall()
    return [row["date"] for row in rows]


def _trading_calendar(symbol: str, latest_bar: dict | None, profile: dict) -> dict:
    latest_date = latest_bar.get("date") if latest_bar else None
    recent_dates = _recent_trade_dates(symbol, latest_date)
    list_date = profile.get("list_date")
    trade_days_since_listing = None
    if list_date and latest_date:
        with get_connection() as conn:
            row = conn.execute(
                """
                SELECT COUNT(*) AS count
                FROM daily_bars
                WHERE symbol = ? AND date >= ? AND date <= ?
                """,
                (symbol, list_date, latest_date),
            ).fetchone()
        trade_days_since_listing = int(row["count"] if row else 0)
    return {
        "latest_trade_date": latest_date,
        "recent_trade_dates": recent_dates,
        "list_date": list_date,
        "trade_days_since_listing": trade_days_since_listing,
    }


def _trading_rules(symbol: str, latest_bar: dict | None) -> dict:
    market = detect_market(symbol)
    profile = _security_profile(symbol)
    is_st = bool(profile.get("is_st"))
    lot_size = int(profile.get("lot_size") or 0)
    warnings: list[str] = []
    calendar = _trading_calendar(symbol, latest_bar, profile)
    close = latest_bar.get("close") if latest_bar else None
    limit_up = latest_bar.get("limit_up") if latest_bar else None
    limit_down = latest_bar.get("limit_down") if latest_bar else None
    is_suspended = bool(latest_bar.get("is_suspended")) if latest_bar else False
    is_limit_up = bool(close is not None and limit_up is not None and close >= limit_up)
    is_limit_down = bool(close is not None and limit_down is not None and close <= limit_down)
    is_first_five = (
        calendar["trade_days_since_listing"] is not None
        and calendar["trade_days_since_listing"] <= 5
    )

    if market == Market.CHINA:
        board = classify_china_symbol(symbol)
        limit = _price_limit_for_china(symbol, is_st)
        if is_st:
            warnings.append("ST 标的适用 5% 涨跌幅限制，并存在更高退市风险")
        warnings.append("A 股买入数量需为 100 股整数倍，卖出需满足 T+1 可用")
        return {
            "market": market.value,
            "board": board.value,
            "lot_size": lot_size or 100,
            "settlement": "T+1",
            "price_limit_pct": None if is_first_five else limit,
            "limit_up": limit_up,
            "limit_down": limit_down,
            "is_st": is_st,
            "is_suspended": is_suspended,
            "is_limit_up": is_limit_up,
            "is_limit_down": is_limit_down,
            "is_first_five_listing_days": is_first_five,
            "calendar": calendar,
            "warnings": warnings,
        }

    if market == Market.HONGKONG:
        board = classify_hk_symbol(symbol)
        warnings.append("港股买卖数量需匹配每手股数，卖出需关注 T+2 交收")
        return {
            "market": market.value,
            "board": board.value if isinstance(board, HongKongBoard) else str(board),
            "lot_size": lot_size or 100,
            "settlement": "T+2",
            "price_limit_pct": None,
            "limit_up": limit_up,
            "limit_down": limit_down,
            "is_st": is_st,
            "is_suspended": is_suspended,
            "is_limit_up": is_limit_up,
            "is_limit_down": is_limit_down,
            "is_first_five_listing_days": is_first_five,
            "calendar": calendar,
            "warnings": warnings,
        }

    warnings.append("美股无固定涨跌停限制，需关注盘前盘后流动性和熔断机制")
    return {
        "market": Market.US.value,
        "board": "us_equity",
        "lot_size": lot_size or 1,
        "settlement": "T+1",
        "price_limit_pct": None,
        "limit_up": limit_up,
        "limit_down": limit_down,
        "is_st": is_st,
        "is_suspended": is_suspended,
        "is_limit_up": is_limit_up,
        "is_limit_down": is_limit_down,
        "is_first_five_listing_days": is_first_five,
        "calendar": calendar,
        "warnings": warnings,
    }


def _relative_strength_rank(symbol: str, factor_snapshot: dict | None) -> dict:
    if not factor_snapshot or not factor_snapshot.get("date"):
        return {"rank": None, "total": 0, "percentile": None, "leader": None}
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT symbol, rel_strength_index20
            FROM factor_daily
            WHERE date = ? AND rel_strength_index20 IS NOT NULL
            ORDER BY rel_strength_index20 DESC
            """,
            (factor_snapshot["date"],),
        ).fetchall()
    ranked = [_row_to_dict(row) for row in rows]
    total = len(ranked)
    rank = next((index + 1 for index, row in enumerate(ranked) if row["symbol"] == symbol), None)
    return {
        "rank": rank,
        "total": total,
        "percentile": (1 - (rank - 1) / total) if rank and total else None,
        "leader": ranked[0] if ranked else None,
    }


def _market_state_from_factor(factor_snapshot: dict | None) -> dict:
    if not factor_snapshot:
        return {
            "regime": "unknown",
            "label": "因子未计算",
            "tone": "missing",
            "drivers": ["请先运行 compute-factors 或研究流水线"],
        }
    regime = classify_market_state(
        factor_snapshot.get("ret20"),
        factor_snapshot.get("ma20"),
        factor_snapshot.get("ma60"),
        factor_snapshot.get("ma120"),
    )
    labels = {
        "bull_trend": "多头趋势",
        "bear_trend": "空头趋势",
        "high_volatility": "高波动",
        "low_volatility": "低波动",
        "range_bound": "震荡区间",
    }
    drivers = [
        f"20日收益 {factor_snapshot.get('ret20')}",
        f"MA20/60/120 {factor_snapshot.get('ma20')} / {factor_snapshot.get('ma60')} / {factor_snapshot.get('ma120')}",
        f"周线/月份 {factor_snapshot.get('weekly_state') or '-'} / {factor_snapshot.get('monthly_state') or '-'}",
    ]
    return {
        "regime": regime,
        "label": labels.get(regime, regime),
        "tone": "positive" if regime == "bull_trend" else "negative" if regime == "bear_trend" else "flat",
        "drivers": drivers,
    }


def get_market_context(
    symbol: str,
    *,
    start: str | None = None,
    end: str | None = None,
    limit: int = 120,
) -> dict:
    init_db()
    index_profile = resolve_index_profile(symbol)
    normalized_symbol = normalize_market_symbol(symbol)
    resolved_end = end or date.today().isoformat()
    resolved_start = start or (date.fromisoformat(resolved_end) - timedelta(days=365)).isoformat()
    if index_profile:
        index_rows = _index_series_rows(normalized_symbol, resolved_start, resolved_end, limit)
        factor_series = derive_index_factor_series(normalized_symbol, index_rows)
        factor_snapshot = factor_series[-1] if factor_series else None
        latest_bar = index_rows[-1] if index_rows else None
        return {
            "symbol": normalized_symbol,
            "asset_type": "index",
            "name": index_profile.name,
            "start": resolved_start,
            "end": resolved_end,
            "factor_snapshot": factor_snapshot,
            "factor_series": factor_series,
            "fund_flow_snapshot": None,
            "fund_flow_series": [],
            "market_state": _market_state_from_factor(factor_snapshot),
            "relative_strength": {
                "rank": None,
                "total": 0,
                "percentile": None,
                "leader": None,
                "method": "指数标的不参与个股横截面排名",
            },
            "trading_rules": {
                "market": index_profile.market.lower(),
                "board": "index",
                "lot_size": None,
                "settlement": "指数不可直接交易，需映射 ETF、股指期货或篮子组合",
                "price_limit_pct": None,
                "limit_up": None,
                "limit_down": None,
                "is_st": False,
                "is_suspended": False,
                "is_limit_up": False,
                "is_limit_down": False,
                "is_first_five_listing_days": False,
                "calendar": {
                    "latest_trade_date": latest_bar.get("date") if latest_bar else None,
                    "recent_trade_dates": [row["date"] for row in index_rows[-5:]][::-1],
                    "list_date": None,
                    "trade_days_since_listing": None,
                },
                "warnings": ["指数信号用于市场状态判断，执行前需选择可交易代理工具"],
            },
            "data_coverage": {
                "bar_rows": 0,
                "index_bar_rows": _count_index_rows(normalized_symbol, resolved_start, resolved_end),
                "factor_rows": len(factor_series),
                "fund_flow_rows": 0,
                "latest_bar_date": latest_bar.get("date") if latest_bar else None,
                "latest_factor_date": factor_snapshot.get("date") if factor_snapshot else None,
                "latest_fund_flow_date": None,
                "source": latest_bar.get("source") if latest_bar else None,
            },
        }
    factor_series = _series_rows(
        "factor_daily", normalized_symbol, resolved_start, resolved_end, limit
    )
    fund_flow_series = _series_rows(
        "fund_flow_daily", normalized_symbol, resolved_start, resolved_end, limit
    )
    factor_snapshot = factor_series[-1] if factor_series else _latest_before(
        "factor_daily", normalized_symbol, resolved_end
    )
    fund_flow_snapshot = fund_flow_series[-1] if fund_flow_series else _latest_before(
        "fund_flow_daily", normalized_symbol, resolved_end
    )
    latest_bar = _latest_before("daily_bars", normalized_symbol, resolved_end)
    return {
        "symbol": normalized_symbol,
        "start": resolved_start,
        "end": resolved_end,
        "factor_snapshot": factor_snapshot,
        "factor_series": factor_series,
        "fund_flow_snapshot": fund_flow_snapshot,
        "fund_flow_series": fund_flow_series,
        "market_state": _market_state_from_factor(factor_snapshot),
        "relative_strength": _relative_strength_rank(normalized_symbol, factor_snapshot),
        "trading_rules": _trading_rules(normalized_symbol, latest_bar),
        "data_coverage": {
            "bar_rows": _count_rows("daily_bars", normalized_symbol, resolved_start, resolved_end),
            "factor_rows": _count_rows("factor_daily", normalized_symbol, resolved_start, resolved_end),
            "fund_flow_rows": _count_rows("fund_flow_daily", normalized_symbol, resolved_start, resolved_end),
            "latest_bar_date": latest_bar.get("date") if latest_bar else None,
            "latest_factor_date": factor_snapshot.get("date") if factor_snapshot else None,
            "latest_fund_flow_date": fund_flow_snapshot.get("date") if fund_flow_snapshot else None,
            "source": latest_bar.get("source") if latest_bar else None,
        },
    }


def _watchlist_symbols() -> list[str]:
    return [row["symbol"] for row in list_watchlist()]


def _recent_symbols(limit: int = 40) -> list[str]:
    init_db()
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT symbol, MAX(date) AS latest_date
            FROM daily_bars
            GROUP BY symbol
            ORDER BY latest_date DESC, symbol
            LIMIT ?
            """,
            (limit,),
        ).fetchall()
    return [row["symbol"] for row in rows]


def _summarize_by_market(quotes: list[dict]) -> list[dict]:
    markets: dict[str, dict] = {}
    for quote in quotes:
        market = quote.get("market") or "UNKNOWN"
        bucket = markets.setdefault(
            market,
            {
                "market": market,
                "count": 0,
                "advancers": 0,
                "decliners": 0,
                "unchanged": 0,
                "avg_change_pct": 0.0,
                "amount": 0.0,
            },
        )
        bucket["count"] += 1
        change_pct = quote.get("change_pct") or 0
        bucket["avg_change_pct"] += change_pct
        bucket["amount"] += quote.get("amount") or 0
        if change_pct > 0:
            bucket["advancers"] += 1
        elif change_pct < 0:
            bucket["decliners"] += 1
        else:
            bucket["unchanged"] += 1
    for bucket in markets.values():
        if bucket["count"]:
            bucket["avg_change_pct"] = bucket["avg_change_pct"] / bucket["count"]
    return sorted(markets.values(), key=lambda row: row["market"])


def _summarize_freshness(quotes: list[dict]) -> dict:
    statuses = {"fresh": 0, "delayed": 0, "stale": 0, "missing": 0}
    ages = [
        quote.get("data_age_days")
        for quote in quotes
        if isinstance(quote.get("data_age_days"), int)
    ]
    for quote in quotes:
        status = quote.get("freshness_status") or "missing"
        statuses[status] = statuses.get(status, 0) + 1
    return {
        "latest_date": max((quote.get("trade_date") for quote in quotes if quote.get("trade_date")), default=None),
        "max_age_days": max(ages) if ages else None,
        "fresh_count": statuses.get("fresh", 0),
        "delayed_count": statuses.get("delayed", 0),
        "stale_count": statuses.get("stale", 0),
        "missing_count": statuses.get("missing", 0),
        "delay_policy": "本地日线缓存，非实时行情",
    }


def get_market_pulse(symbols: str | list[str] | None = None) -> dict:
    requested_symbols = parse_symbol_list(symbols)
    if not requested_symbols:
        requested_symbols = _watchlist_symbols() or _recent_symbols() or DEFAULT_MARKET_SYMBOLS

    quote_payload = list_market_quotes(requested_symbols)
    loaded_quotes = [
        quote for quote in quote_payload["quotes"] if quote.get("status") == "ok"
    ]
    latest_date = max((quote.get("trade_date") for quote in loaded_quotes), default=None)
    advancers = sum(1 for quote in loaded_quotes if (quote.get("change_pct") or 0) > 0)
    decliners = sum(1 for quote in loaded_quotes if (quote.get("change_pct") or 0) < 0)
    unchanged = len(loaded_quotes) - advancers - decliners
    movers = [quote for quote in loaded_quotes if quote.get("change_pct") is not None]

    return {
        "symbols": requested_symbols,
        "latest_date": latest_date,
        "breadth": {
            "requested_count": quote_payload["requested_count"],
            "loaded_count": quote_payload["loaded_count"],
            "missing_count": quote_payload["missing_count"],
            "advancers": advancers,
            "decliners": decliners,
            "unchanged": unchanged,
            "advance_decline_ratio": advancers / decliners if decliners else None,
        },
        "gainers": sorted(movers, key=lambda row: row["change_pct"], reverse=True)[:5],
        "losers": sorted(movers, key=lambda row: row["change_pct"])[:5],
        "market_snapshots": _summarize_by_market(loaded_quotes),
        "freshness": _summarize_freshness(quote_payload["quotes"]),
        "quotes": quote_payload["quotes"],
    }
