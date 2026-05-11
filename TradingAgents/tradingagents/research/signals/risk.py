from __future__ import annotations

import pandas as pd

from ._utils import history_until, value
from .schemas import ResearchSignal
from .scoring import score_for_level


def detect_trend_breakdown(df: pd.DataFrame, date: str) -> ResearchSignal | None:
    history = history_until(df, date)
    if history.empty:
        return None
    latest = history.iloc[-1]
    if not (
        value(latest, "close", 0.0) < value(latest, "ma60", 0.0)
        and value(latest, "amount_ratio20", 0.0) >= 1.3
        and value(latest, "ret20", 0.0) < 0
    ):
        return None
    return ResearchSignal(
        date=str(latest["date"]),
        symbol=str(latest["symbol"]),
        market=str(latest["market"]),
        signal_name="趋势破位",
        signal_level="D",
        direction="risk",
        timeframe="daily",
        evidence=["close < ma60", "amount_ratio20 >= 1.3", "ret20 < 0"],
        risk=["趋势结构转弱"],
        invalid_conditions=["重新站上 ma60 并获得成交确认"],
        score=score_for_level("D"),
    )


def detect_high_volume_stall(df: pd.DataFrame, date: str) -> ResearchSignal | None:
    history = history_until(df, date)
    if len(history) < 2:
        return None
    latest = history.iloc[-1]
    previous = history.iloc[-2]
    day_return = latest["close"] / previous["close"] - 1
    if not (
        value(latest, "ret20", 0.0) > 0.20
        and value(latest, "amount_ratio20", 0.0) >= 1.8
        and day_return < 0.02
        and value(latest, "rsi14", 0.0) > 70
    ):
        return None
    return ResearchSignal(
        date=str(latest["date"]),
        symbol=str(latest["symbol"]),
        market=str(latest["market"]),
        signal_name="高位放量滞涨",
        signal_level="C",
        direction="risk",
        timeframe="daily",
        evidence=["ret20 > 20%", "amount_ratio20 >= 1.8", "当日涨幅 < 2%"],
        risk=["短期筹码分歧加大"],
        invalid_conditions=["放量后继续有效突破并维持强势"],
        score=score_for_level("C"),
    )
