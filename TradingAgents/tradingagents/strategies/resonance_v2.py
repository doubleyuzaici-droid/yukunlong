from __future__ import annotations

import json
import math

import pandas as pd

from tradingagents.markets import Market, detect_market
from tradingagents.research.db import get_connection, init_db
from tradingagents.research.index_catalog import (
    is_supported_index_symbol,
    normalize_index_symbol,
    resolve_index_profile,
)
from tradingagents.research.market_data import normalize_market_symbol
from tradingagents.research.repository import (
    load_daily_bars,
    load_fund_flows,
    load_index_bars,
    upsert_signals,
)


VALID_MODES = {"conservative", "aggressive"}


def _safe_float(value) -> float | None:
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        return None
    return result if math.isfinite(result) else None


def _safe_bool(value) -> bool:
    return bool(value) if value is not None and not pd.isna(value) else False


def _ema(series: pd.Series, period: int) -> pd.Series:
    return series.ewm(span=period, adjust=False).mean()


def _atr(frame: pd.DataFrame, period: int = 14) -> pd.Series:
    previous_close = frame["close"].shift(1)
    true_range = pd.concat(
        [
            frame["high"] - frame["low"],
            (frame["high"] - previous_close).abs(),
            (frame["low"] - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    return true_range.ewm(span=period, adjust=False).mean()


def _macd(close: pd.Series) -> tuple[pd.Series, pd.Series, pd.Series]:
    dif = _ema(close, 12) - _ema(close, 26)
    dea = _ema(dif, 9)
    bar = (dif - dea) * 2
    return dif, dea, bar


def _kdj(frame: pd.DataFrame) -> tuple[pd.Series, pd.Series, pd.Series]:
    low_n = frame["low"].rolling(9, min_periods=9).min()
    high_n = frame["high"].rolling(9, min_periods=9).max()
    spread = (high_n - low_n).replace(0, pd.NA)
    rsv = ((frame["close"] - low_n) / spread * 100).fillna(50)
    k = rsv.ewm(alpha=1 / 3, adjust=False).mean()
    d = k.ewm(alpha=1 / 3, adjust=False).mean()
    j = 3 * k - 2 * d
    return k, d, j


def _rsi(close: pd.Series, period: int = 14) -> pd.Series:
    delta = close.diff()
    gain = delta.clip(lower=0).rolling(period, min_periods=period).mean()
    loss = (-delta.clip(upper=0)).rolling(period, min_periods=period).mean()
    rs = gain / loss.replace(0, pd.NA)
    rsi = 100 - 100 / (1 + rs)
    rsi = rsi.mask((loss == 0) & (gain > 0), 100.0)
    rsi = rsi.mask((loss == 0) & (gain == 0), 50.0)
    return rsi.fillna(50)


def _money_flow_proxy(frame: pd.DataFrame) -> pd.Series:
    low_n = frame["low"].rolling(9, min_periods=9).min()
    high_n = frame["high"].rolling(9, min_periods=9).max()
    spread = (high_n - low_n).replace(0, pd.NA)
    rsv = ((frame["close"] - low_n) / spread * 100).fillna(50)
    return _ema(rsv, 5)


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


def resolve_benchmark_symbol(symbol: str) -> tuple[str, str]:
    normalized = normalize_market_symbol(symbol)
    if is_supported_index_symbol(normalized):
        canonical = normalize_index_symbol(normalized)
        return canonical, "指数标的使用自身作为市场过滤基准"
    market = detect_market(normalized)
    code = normalized.split(".")[0].upper()

    if market == Market.CHINA:
        if normalized.endswith(".BJ"):
            return "000852.SH", "北交所标的映射中证1000中小盘基准"
        if code.startswith(("002", "003", "300", "301", "688")):
            return "000852.SH", "成长/中小盘标的映射中证1000基准"
        if code.startswith(("510", "511", "512", "513", "515", "516", "517", "518", "588", "159")):
            return "000300.SH", "ETF/宽基标的映射沪深300基准"
        return "000300.SH", "A股主板/大盘标的映射沪深300基准"
    if market == Market.HONGKONG:
        return "HSI", "港股标的映射恒生指数宽基基准"
    return "SPY", "美股标的映射SPY宽基基准"


def _benchmark_symbol(symbol: str) -> str:
    return resolve_benchmark_symbol(symbol)[0]


def _load_index_bars(index_symbol: str, start: str, end: str) -> pd.DataFrame:
    try:
        return load_index_bars(index_symbol, start, end)
    except ValueError:
        return pd.DataFrame()


def _trend_label(strength: float | None) -> str:
    if strength is None:
        return "未知"
    if strength > 3:
        return "强多头"
    if strength > 1:
        return "弱多头"
    if strength >= -1:
        return "中性"
    if strength >= -3:
        return "弱空头"
    return "强空头"


def _trend_action(label: str) -> str:
    return {
        "强多头": "积极做多",
        "弱多头": "谨慎做多",
        "中性": "不操作",
        "弱空头": "准备防守",
        "强空头": "禁止做多",
    }.get(label, "等待数据")


def _weekly_trend_state(frame: pd.DataFrame) -> dict:
    dated = frame.copy()
    dated["date_dt"] = pd.to_datetime(dated["date"], errors="coerce")
    dated = dated.dropna(subset=["date_dt", "close"]).sort_values("date_dt")
    if dated.empty:
        return {
            "period": "weekly",
            "label": "未知",
            "strength": None,
            "action": _trend_action("未知"),
            "ema21": None,
            "ema89": None,
            "sample_count": 0,
            "latest_date": None,
            "reliability": "missing",
        }

    weekly_close = (
        dated.set_index("date_dt")["close"]
        .astype(float)
        .resample("W-FRI")
        .last()
        .dropna()
    )
    if weekly_close.empty:
        return {
            "period": "weekly",
            "label": "未知",
            "strength": None,
            "action": _trend_action("未知"),
            "ema21": None,
            "ema89": None,
            "sample_count": 0,
            "latest_date": None,
            "reliability": "missing",
        }

    ema21 = _ema(weekly_close, 21)
    ema89 = _ema(weekly_close, 89)
    latest_ema89 = _safe_float(ema89.iloc[-1])
    strength = (
        float((ema21.iloc[-1] - ema89.iloc[-1]) / ema89.iloc[-1] * 100)
        if latest_ema89
        else None
    )
    label = _trend_label(strength)
    sample_count = int(len(weekly_close))
    if sample_count >= 89:
        reliability = "full"
    elif sample_count >= 21:
        reliability = "partial"
    else:
        reliability = "early"
    return {
        "period": "weekly",
        "label": label,
        "strength": strength,
        "action": _trend_action(label),
        "ema21": _safe_float(ema21.iloc[-1]),
        "ema89": _safe_float(ema89.iloc[-1]),
        "sample_count": sample_count,
        "latest_date": weekly_close.index[-1].date().isoformat(),
        "reliability": reliability,
    }


def _market_filter(
    index_frame: pd.DataFrame, benchmark_symbol: str, benchmark_reason: str
) -> tuple[dict, float, int, list[str]]:
    warnings: list[str] = []
    if index_frame.empty or len(index_frame) < 90:
        warnings.append("缺少基准指数数据")
        return (
            {
                "benchmark_symbol": benchmark_symbol,
                "benchmark_reason": benchmark_reason,
                "status": "missing",
                "passed": False,
                "trend_label": "未知",
                "rsi14": None,
                "market_strength": 0.0,
                "drivers": ["缺少基准指数数据，无法确认 M2 大盘过滤"],
            },
            0.0,
            0,
            warnings,
        )

    frame = index_frame.copy()
    for column in ["open", "high", "low", "close", "volume", "amount"]:
        if column in frame.columns:
            frame[column] = pd.to_numeric(frame[column], errors="coerce")
    close = frame["close"]
    ema21 = _ema(close, 21)
    ema89 = _ema(close, 89)
    atr14 = _atr(frame, 14)
    rsi14 = _rsi(close, 14)
    latest_idx = len(frame) - 1
    trend_strength = (
        float((ema21.iloc[-1] - ema89.iloc[-1]) / ema89.iloc[-1] * 100)
        if ema89.iloc[-1]
        else 0.0
    )
    label = _trend_label(trend_strength)
    latest_atr = float(atr14.iloc[-1]) if atr14.iloc[-1] else 0.0
    market_strength = (
        float((close.iloc[-1] - ema21.iloc[-1]) / latest_atr)
        if latest_atr
        else 0.0
    )
    latest_rsi = _safe_float(rsi14.iloc[-1])
    passed = label in {"强多头", "弱多头"} and (latest_rsi or 100) < 75
    status = "pass" if passed else "reject"
    drivers = [
        f"大盘趋势 {label}",
        f"RSI14 {latest_rsi:.1f}" if latest_rsi is not None else "RSI14 缺失",
        f"MarketStrength {market_strength:.2f}",
    ]
    return (
        {
            "benchmark_symbol": benchmark_symbol,
            "benchmark_reason": benchmark_reason,
            "status": status,
            "passed": passed,
            "trend_label": label,
            "trend_strength": trend_strength,
            "rsi14": latest_rsi,
            "market_strength": market_strength,
            "latest_date": frame.iloc[latest_idx]["date"],
            "drivers": drivers,
        },
        market_strength,
        1 if close.iloc[-1] < ema21.iloc[-1] else 0,
        warnings,
    )


def _latest_main_flow_ratio(symbol: str, start: str, end: str, latest_amount: float | None) -> float | None:
    flows = load_fund_flows(symbol, start, end)
    if flows.empty or latest_amount is None or latest_amount == 0:
        return None
    value = _safe_float(flows.iloc[-1].get("main_net_inflow"))
    return value / latest_amount if value is not None else None


def _money_coef(money_flow: float | None) -> float:
    if money_flow is None:
        return 0.7
    if money_flow >= 80:
        return 1.2
    if money_flow >= 30:
        return 1.0
    if money_flow >= 0:
        return 0.7
    return 0.5


def _market_coef(market_strength: float) -> float:
    if market_strength > 1:
        return 1.2
    if market_strength > 0:
        return 1.0
    if market_strength > -1:
        return 0.8
    return 0.6


def _lot_round(shares: float, lot_size: int) -> int:
    if not math.isfinite(shares) or shares <= 0:
        return 0
    return int(shares // lot_size * lot_size)


def _warning_level(
    emergency: bool, regular_exit: bool, sell_score: float, j: pd.Series
) -> dict:
    latest_j = _safe_float(j.iloc[-1])
    previous_j = _safe_float(j.iloc[-2]) if len(j) > 1 else None
    if emergency:
        return {"level": 4, "label": "四级 倾盆", "action": "立即清仓"}
    if regular_exit:
        return {"level": 4, "label": "四级 卖出共振", "action": "立即清仓"}
    if sell_score > 0.40:
        return {"level": 3, "label": "三级 卖警", "action": "减仓 50%"}
    if latest_j is not None and previous_j is not None and latest_j < 50 and previous_j > 70:
        return {"level": 2, "label": "二级 泥淖", "action": "减仓 25%"}
    if latest_j is not None and previous_j is not None and previous_j >= 80 and latest_j < previous_j:
        return {"level": 1, "label": "一级 拐点", "action": "警惕准备"}
    return {"level": 0, "label": "无预警", "action": "继续观察"}


def _decision(
    trend_label: str,
    market_passed: bool,
    conservative_entry: bool,
    aggressive_entry: bool,
    buy_score: float,
    sell_score: float,
    emergency: bool,
    blocking_reasons: list[str],
) -> dict:
    if blocking_reasons:
        return {"action": "observe", "label": "数据不足", "tone": "warn"}
    if emergency:
        return {"action": "exit", "label": "紧急平仓", "tone": "danger"}
    if sell_score > 0.55:
        return {"action": "exit", "label": "卖出共振", "tone": "danger"}
    if sell_score > 0.40:
        return {"action": "reduce", "label": "减仓预警", "tone": "warn"}
    if trend_label not in {"强多头", "弱多头"}:
        return {"action": "observe", "label": "趋势未通过", "tone": "neutral"}
    if not market_passed:
        return {"action": "observe", "label": "大盘过滤未通过", "tone": "neutral"}
    if conservative_entry or aggressive_entry:
        return {"action": "buy_allowed", "label": "买入条件通过", "tone": "positive"}
    if buy_score > 0.40:
        return {"action": "buy_watch", "label": "接近买点", "tone": "watch"}
    return {"action": "hold", "label": "观察持有", "tone": "neutral"}


def analyze_resonance_v2(
    symbol: str,
    start: str,
    end: str,
    *,
    mode: str = "conservative",
    capital: float = 1_000_000,
    risk_pct: float = 0.01,
) -> dict:
    if mode not in VALID_MODES:
        raise ValueError(f"Unsupported resonance V2 mode: {mode}")

    init_db()
    normalized = normalize_market_symbol(symbol)
    asset_type = "index" if is_supported_index_symbol(normalized) else "equity"
    frame = (
        load_index_bars(normalized, start, end)
        if asset_type == "index"
        else load_daily_bars(normalized, start, end)
    )
    warnings: list[str] = []
    blocking_reasons: list[str] = []
    if frame.empty:
        blocking_reasons.append(
            "缺少指数日线数据" if asset_type == "index" else "缺少个股日线数据"
        )
        return {
            "strategy_name": "多指标共振策略 V2",
            "symbol": normalized,
            "asset_type": asset_type,
            "mode": mode,
            "decision": {"action": "observe", "label": "缺少数据", "tone": "warn"},
            "data_quality": {"warnings": warnings, "blocking_reasons": blocking_reasons},
        }

    frame = frame.sort_values("date").reset_index(drop=True).copy()
    for column in ["open", "high", "low", "close", "volume", "amount"]:
        frame[column] = pd.to_numeric(frame[column], errors="coerce")
    frame = frame.dropna(subset=["open", "high", "low", "close"]).reset_index(drop=True)
    if len(frame) < 90:
        blocking_reasons.append("日线不足 90 根，EMA89 趋势状态不可靠")

    close = frame["close"]
    volume = frame["volume"]
    ema5 = _ema(close, 5)
    ema21 = _ema(close, 21)
    ema60 = _ema(close, 60)
    ema89 = _ema(close, 89)
    atr14 = _atr(frame, 14)
    dif, dea, macd_bar = _macd(close)
    _, _, j = _kdj(frame)
    money_flow = _money_flow_proxy(frame)

    latest = frame.iloc[-1]
    latest_close = float(latest["close"])
    latest_atr = _safe_float(atr14.iloc[-1]) or max(latest_close * 0.02, 0.01)
    daily_trend_strength = (
        float((ema21.iloc[-1] - ema89.iloc[-1]) / ema89.iloc[-1] * 100)
        if _safe_float(ema89.iloc[-1])
        else None
    )
    trend_state = _weekly_trend_state(frame)
    trend_strength = trend_state["strength"]
    trend_label = trend_state["label"]

    benchmark_symbol, benchmark_reason = resolve_benchmark_symbol(normalized)
    market_filter, market_strength, s_market, market_warnings = _market_filter(
        _load_index_bars(benchmark_symbol, start, end), benchmark_symbol, benchmark_reason
    )
    warnings.extend(market_warnings)

    trend_factor = (
        float((latest_close - ema60.iloc[-1]) / ema60.iloc[-1])
        if _safe_float(ema60.iloc[-1])
        else 0.0
    )
    momentum_factor = float(macd_bar.iloc[-1] / latest_atr) if latest_atr else 0.0
    latest_j = _safe_float(j.iloc[-1]) or 50.0
    oversold_factor = max(0.0, (30 - latest_j) / 30)
    ma_vol5 = volume.rolling(5, min_periods=5).mean()
    ma_vol20 = volume.rolling(20, min_periods=20).mean()
    volume_factor = (
        math.log(float(ma_vol5.iloc[-1] / ma_vol20.iloc[-1]))
        if _safe_float(ma_vol5.iloc[-1]) and _safe_float(ma_vol20.iloc[-1]) and ma_vol20.iloc[-1] > 0
        else 0.0
    )
    buy_score = (
        0.25 * trend_factor
        + 0.25 * momentum_factor
        + 0.20 * oversold_factor
        + 0.15 * volume_factor
        + 0.15 * market_strength
    )

    previous_bar = _safe_float(macd_bar.iloc[-2]) if len(frame) > 1 else None
    prior_bar = _safe_float(macd_bar.iloc[-3]) if len(frame) > 2 else None
    previous_j = _safe_float(j.iloc[-2]) if len(frame) > 1 else None
    conservative_entry = all(
        [
            latest_close > (_safe_float(ema60.iloc[-1]) or latest_close),
            _safe_float(macd_bar.iloc[-1]) is not None,
            macd_bar.iloc[-1] > 0,
            previous_bar is not None,
            prior_bar is not None,
            macd_bar.iloc[-1] > previous_bar > prior_bar,
            previous_j is not None,
            previous_j <= 30,
            latest_j > 30,
            _safe_float(ma_vol5.iloc[-1]) is not None,
            _safe_float(ma_vol20.iloc[-1]) is not None,
            ma_vol5.iloc[-1] > ma_vol20.iloc[-1] * 1.1,
            market_filter["passed"],
        ]
    )
    aggressive_entry = buy_score > 0.5 and market_filter["passed"]

    s_trend = 1 if latest_close < ema21.iloc[-1] else 0
    s_macd = 1 if dif.iloc[-1] < dea.iloc[-1] and dif.iloc[-1] < 0 else 0
    s_kdj = (
        1
        if len(j) >= 4
        and (_safe_float(j.iloc[-2]) or 0) > 70
        and latest_j <= 70
        and (_safe_float(j.iloc[-4]) or 0) > 80
        else 0
    )
    latest_mf = _safe_float(money_flow.iloc[-1])
    previous_mf = _safe_float(money_flow.iloc[-2]) if len(money_flow) > 1 else None
    s_money = 1 if previous_mf is not None and previous_mf >= 80 and (latest_mf or 0) < previous_mf else 0
    sell_score = 0.25 * s_trend + 0.20 * s_macd + 0.20 * s_kdj + 0.20 * s_market + 0.15 * s_money
    regular_exit = sell_score > 0.55
    top_divergence = bool(
        len(frame) >= 25
        and latest_close >= float(close.rolling(20).max().iloc[-1])
        and latest_j < float(j.rolling(20).max().shift(5).iloc[-1])
    )
    macd_cross_down = bool(len(frame) > 1 and dif.iloc[-2] > dea.iloc[-2] and dif.iloc[-1] < dea.iloc[-1])
    single_drop = bool(len(frame) > 1 and latest_close / close.iloc[-2] - 1 < -0.05)
    index_drop = False
    if market_filter.get("status") != "missing":
        index_rows = _load_index_bars(benchmark_symbol, start, end)
        if len(index_rows) > 1:
            index_drop = bool(float(index_rows.iloc[-1]["close"]) / float(index_rows.iloc[-2]["close"]) - 1 < -0.03)
    emergency = (top_divergence and macd_cross_down) or single_drop or index_drop
    warning_level = _warning_level(emergency, regular_exit, sell_score, j)

    hhv60 = float(frame["high"].tail(60).max())
    llv60 = float(frame["low"].tail(60).min())
    stop_price = latest_close - 1.5 * latest_atr
    target1 = latest_close + 2.0 * latest_atr
    target2 = latest_close + 4.0 * latest_atr
    trailing = max(latest_close, float(close.tail(5).max()) - 2.0 * latest_atr)
    price_channels = {
        "predict_high_1": float(ema5.iloc[-1] + latest_atr),
        "predict_low_1": float(ema5.iloc[-1] - latest_atr),
        "predict_high_2": float(ema21.iloc[-1] + 2 * latest_atr),
        "predict_low_2": float(ema21.iloc[-1] - 2 * latest_atr),
        "sell_price": hhv60 * 1.02,
        "buy_back_price": llv60 * 0.98,
        "stop_price": stop_price,
        "target1": target1,
        "target2": target2,
        "trailing_stop": trailing,
    }

    main_flow_ratio = _latest_main_flow_ratio(normalized, start, end, _safe_float(latest.get("amount")))
    if main_flow_ratio is None:
        if asset_type == "index":
            warnings.append("指数标的无个股主力资金流，M5 资金系数使用技术代理")
        else:
            warnings.append("缺少主力资金流数据，M5 资金系数使用技术资金代理")
    signal_strength = min(max((buy_score - 0.5) / 0.5, 0.0), 1.0)
    signal_coef = 0.5 + signal_strength
    money_coef = _money_coef(latest_mf)
    market_coef = _market_coef(market_strength)
    stop_distance = max(latest_close - stop_price, 0.01)
    base_shares = capital * risk_pct / stop_distance
    final_shares = base_shares * signal_coef * money_coef * market_coef
    lot_size = 100 if detect_market(normalized) == Market.CHINA else 1
    max_shares = capital * 0.25 / latest_close
    suggested_shares = _lot_round(min(final_shares, max_shares), lot_size)
    suggested_notional = suggested_shares * latest_close

    decision = _decision(
        trend_label,
        market_filter["passed"],
        conservative_entry,
        aggressive_entry,
        buy_score,
        sell_score,
        emergency,
        blocking_reasons,
    )

    checklist = [
        {
            "label": "M1 趋势多头",
            "passed": trend_label in {"强多头", "弱多头"},
            "detail": (
                f"周线{trend_label}，强度 {trend_strength:.2f}%"
                if trend_strength is not None
                else "周线趋势强度缺失"
            ),
        },
        {
            "label": "M2 大盘过滤",
            "passed": market_filter["passed"],
            "detail": "；".join(market_filter.get("drivers", [])),
        },
        {
            "label": "M3 进场触发",
            "passed": conservative_entry if mode == "conservative" else aggressive_entry,
            "detail": f"S_buy={buy_score:.3f}，保守={conservative_entry}，激进={aggressive_entry}",
        },
        {
            "label": "M4 出场风险",
            "passed": not regular_exit and not emergency,
            "detail": f"S_sell={sell_score:.2f}，{warning_level['label']}",
        },
        {
            "label": "M5 仓位约束",
            "passed": suggested_shares > 0,
            "detail": f"建议 {suggested_shares} 股，名义金额 {suggested_notional:.0f}",
        },
    ]

    factors = {
        "trend": trend_factor,
        "momentum": momentum_factor,
        "oversold": oversold_factor,
        "volume": volume_factor,
        "market": market_strength,
    }
    return {
        "strategy_name": "多指标共振策略 V2",
        "symbol": normalized,
        "asset_type": asset_type,
        "mode": mode,
        "start": start,
        "end": end,
        "latest_bar": {
            "date": latest["date"],
            "open": _safe_float(latest["open"]),
            "high": _safe_float(latest["high"]),
            "low": _safe_float(latest["low"]),
            "close": latest_close,
            "volume": _safe_float(latest.get("volume")),
            "amount": _safe_float(latest.get("amount")),
        },
        "decision": decision,
        "trend_state": {
            **trend_state,
            "daily_proxy": {
                "ema21": _safe_float(ema21.iloc[-1]),
                "ema89": _safe_float(ema89.iloc[-1]),
                "strength": daily_trend_strength,
            },
        },
        "market_filter": market_filter,
        "buy_signal": {
            "score": float(buy_score),
            "threshold": 0.5,
            "mode_signal": _safe_bool(conservative_entry if mode == "conservative" else aggressive_entry),
            "conservative_entry": _safe_bool(conservative_entry),
            "aggressive_entry": _safe_bool(aggressive_entry),
            "factors": factors,
        },
        "sell_signal": {
            "score": float(sell_score),
            "threshold": 0.55,
            "regular_exit": _safe_bool(regular_exit),
            "emergency": _safe_bool(emergency),
            "warning_level": warning_level,
            "components": {
                "trend": s_trend,
                "macd": s_macd,
                "kdj": s_kdj,
                "market": s_market,
                "money": s_money,
            },
        },
        "price_channels": price_channels,
        "position_plan": {
            "capital": capital,
            "risk_pct": risk_pct,
            "risk_amount": capital * risk_pct,
            "base_shares": _lot_round(base_shares, lot_size),
            "signal_coef": signal_coef,
            "money_coef": money_coef,
            "market_coef": market_coef,
            "max_position_pct": 0.25,
            "suggested_shares": suggested_shares,
            "suggested_notional": suggested_notional,
            "suggested_position_pct": suggested_notional / capital if capital else 0.0,
            "stop_distance": stop_distance,
            "lot_size": lot_size,
        },
        "checklist": checklist,
        "data_quality": {
            "warnings": warnings,
            "blocking_reasons": blocking_reasons,
            "bar_count": len(frame),
            "has_benchmark": market_filter.get("status") != "missing",
            "has_fund_flow": main_flow_ratio is not None,
        },
        "disclaimer": "策略分析仅用于研究和模拟交易，不构成投资建议或实盘指令。",
    }


def _json_list(items: list[str]) -> str:
    return json.dumps([item for item in items if item], ensure_ascii=False)


def _signal_level(action: str) -> str:
    if action in {"buy_allowed", "exit"}:
        return "A"
    if action in {"buy_watch", "reduce"}:
        return "B"
    return "C"


def _signal_direction(action: str) -> str:
    if action in {"buy_allowed", "buy_watch", "hold"}:
        return "opportunity"
    if action in {"reduce", "exit"}:
        return "risk"
    return "neutral"


def build_resonance_v2_signal(analysis: dict) -> dict:
    latest_bar = analysis.get("latest_bar") or {}
    latest_date = latest_bar.get("date") or analysis.get("end")
    symbol = analysis["symbol"]
    mode = analysis["mode"]
    action = (analysis.get("decision") or {}).get("action", "observe")
    buy_signal = analysis.get("buy_signal") or {}
    sell_signal = analysis.get("sell_signal") or {}
    market_filter = analysis.get("market_filter") or {}
    trend_state = analysis.get("trend_state") or {}
    position_plan = analysis.get("position_plan") or {}
    data_quality = analysis.get("data_quality") or {}
    score_source = sell_signal.get("score") if _signal_direction(action) == "risk" else buy_signal.get("score")
    score = _safe_float(score_source) or 0.0

    evidence = [
        f"M1周线趋势：{trend_state.get('label', '未知')}，强度 {score_or_dash(trend_state.get('strength'))}%",
        f"M2基准：{market_filter.get('benchmark_symbol', '-')}，{market_filter.get('status', '-')}",
        f"M3买入评分：S_buy={score_or_dash(buy_signal.get('score'))}",
        f"M5建议仓位：{int(position_plan.get('suggested_shares') or 0)} 股",
    ]
    risk = [
        f"M4卖出评分：S_sell={score_or_dash(sell_signal.get('score'))}",
        f"预警等级：{(sell_signal.get('warning_level') or {}).get('label', '-')}",
        *list(data_quality.get("warnings") or []),
    ]
    invalid = [
        "周线趋势转为空头",
        "大盘过滤转为reject或missing",
        "S_sell高于0.55",
        "单日跌幅或指数跌幅触发紧急退出",
        *list(data_quality.get("blocking_reasons") or []),
    ]
    return {
        "signal_id": f"resonance-v2:{mode}:{symbol}:{latest_date}",
        "date": latest_date,
        "symbol": symbol,
        "market": _market_name(symbol),
        "signal_name": "V2多指标共振",
        "signal_level": _signal_level(action),
        "direction": _signal_direction(action),
        "timeframe": "weekly+daily",
        "evidence_json": _json_list(evidence),
        "risk_json": _json_list(risk),
        "invalid_json": _json_list(invalid),
        "score": score * 100,
        "strategy_version": f"resonance_v2_{mode}",
        "market_regime": market_filter.get("trend_label") or trend_state.get("label"),
    }


def score_or_dash(value) -> str:
    number = _safe_float(value)
    return "-" if number is None else f"{number:.3f}"


def generate_resonance_v2_signal(
    symbol: str,
    start: str,
    end: str,
    *,
    mode: str = "conservative",
    capital: float = 1_000_000,
    persist: bool = True,
) -> dict:
    analysis = analyze_resonance_v2(symbol, start, end, mode=mode, capital=capital)
    signal = build_resonance_v2_signal(analysis)
    if persist:
        upsert_signals([signal])
    return {"analysis": analysis, "signal": signal, "persisted": bool(persist)}
