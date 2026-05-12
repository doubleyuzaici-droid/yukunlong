from __future__ import annotations

import json

import pandas as pd

from tradingagents.research.features.liquidity import avg_amount, is_low_liquidity
from tradingagents.research.features.market_state import classify_market_state
from tradingagents.research.features.technical import add_all_technical_features
from tradingagents.research.features.timeframe import (
    classify_monthly_state,
    classify_weekly_state,
    resample_monthly,
    resample_weekly,
)
from tradingagents.research.repository import (
    list_watchlist,
    load_daily_bars,
    upsert_signals,
)

from .breakout import detect_volume_breakout
from .pullback import detect_pullback_confirmation
from .risk import detect_high_volume_stall, detect_trend_breakdown
from .schemas import ResearchSignal
from .trend import detect_relative_strength, detect_trend_enhancement


def _prepare_features(raw: pd.DataFrame) -> pd.DataFrame:
    frame = add_all_technical_features(raw)
    weekly_state = classify_weekly_state(resample_weekly(raw))
    monthly_state = classify_monthly_state(resample_monthly(raw))
    frame["weekly_state"] = weekly_state
    frame["monthly_state"] = monthly_state
    frame["rel_strength_index20"] = frame.get("rel_strength_index20", 0.0)
    frame["rel_strength_industry20"] = frame.get("rel_strength_industry20", 0.0)
    return frame


def _filter_low_liquidity(
    signals: list[ResearchSignal], history: pd.DataFrame
) -> list[ResearchSignal]:
    if history.empty:
        return signals
    market = str(history.iloc[-1]["market"])
    if not is_low_liquidity(market, avg_amount(history)):
        return signals
    return [signal for signal in signals if signal.direction != "opportunity"]


def scan_symbol(symbol: str, date: str) -> list[ResearchSignal]:
    raw = load_daily_bars(symbol, "1900-01-01", date)
    if raw.empty:
        return []
    features = _prepare_features(raw)
    detectors = [
        detect_trend_enhancement,
        detect_volume_breakout,
        detect_pullback_confirmation,
        detect_trend_breakdown,
        detect_high_volume_stall,
        detect_relative_strength,
    ]
    signals = [detector(features, date) for detector in detectors]
    signals = [signal for signal in signals if signal is not None]
    latest = features.iloc[-1]
    regime = classify_market_state(
        latest.get("ret20"), latest.get("ma20"), latest.get("ma60"), latest.get("ma120")
    )
    for signal in signals:
        signal.market_regime = regime
    return _filter_low_liquidity(signals, raw)


def scan_watchlist(date: str) -> list[ResearchSignal]:
    signals: list[ResearchSignal] = []
    for item in list_watchlist():
        signals.extend(scan_symbol(item["symbol"], date))
    return signals


def persist_signals(signals: list[ResearchSignal]) -> None:
    rows = []
    for signal in signals:
        rows.append(
            {
                "signal_id": signal.signal_id,
                "date": signal.date,
                "symbol": signal.symbol,
                "market": signal.market,
                "signal_name": signal.signal_name,
                "signal_level": signal.signal_level,
                "direction": signal.direction,
                "timeframe": signal.timeframe,
                "evidence_json": json.dumps(signal.evidence, ensure_ascii=False),
                "risk_json": json.dumps(signal.risk, ensure_ascii=False),
                "invalid_json": json.dumps(
                    signal.invalid_conditions, ensure_ascii=False
                ),
                "score": signal.score,
                "strategy_version": signal.strategy_version,
                "market_regime": signal.market_regime,
            }
        )
    if rows:
        upsert_signals(rows)
