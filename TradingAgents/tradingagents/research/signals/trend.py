from __future__ import annotations

import pandas as pd

from ._utils import history_until, value
from .schemas import ResearchSignal
from .scoring import score_for_level


def detect_trend_enhancement(df: pd.DataFrame, date: str) -> ResearchSignal | None:
    history = history_until(df, date)
    if len(history) < 6:
        return None
    latest = history.iloc[-1]
    close = value(latest, "close")
    ma20 = value(latest, "ma20")
    ma60 = value(latest, "ma60")
    if close is None or ma20 is None or ma60 is None:
        return None
    ma60_slope = history["ma60"].tail(6).iloc[-1] - history["ma60"].tail(6).iloc[0]
    if not (close > ma60 and ma20 > ma60 and ma60_slope >= 0):
        return None

    amount_ratio = value(latest, "amount_ratio20", 0.0)
    relative_strength = value(latest, "rel_strength_index20", 0.0)
    weekly_state = value(latest, "weekly_state", "neutral")
    confirmed = (
        amount_ratio >= 1.5
        and relative_strength > 0
        and weekly_state in ("strong", "improving")
    )
    level = "A" if confirmed else "B"
    risk = [] if confirmed else ["成交或相对强度确认不足"]
    signal = ResearchSignal(
        date=str(latest["date"]),
        symbol=str(latest["symbol"]),
        market=str(latest["market"]),
        signal_name="趋势增强",
        signal_level=level,
        direction="opportunity",
        timeframe="daily",
        evidence=[
            "close > ma60",
            "ma20 > ma60",
            "ma60 最近 5 日斜率 >= 0",
        ],
        risk=risk,
        invalid_conditions=["close 跌破 ma60", "ma20 跌破 ma60"],
        score=score_for_level(level),
    )
    return signal


def detect_relative_strength(df: pd.DataFrame, date: str) -> ResearchSignal | None:
    history = history_until(df, date)
    if history.empty:
        return None
    latest = history.iloc[-1]
    rs_index = value(latest, "rel_strength_index20", 0.0)
    rs_industry = value(latest, "rel_strength_industry20", 0.0)
    if not (rs_index > 0.05 or rs_industry > 0.03):
        return None
    return ResearchSignal(
        date=str(latest["date"]),
        symbol=str(latest["symbol"]),
        market=str(latest["market"]),
        signal_name="相对强势",
        signal_level="B",
        direction="opportunity",
        timeframe="daily",
        evidence=["相对指数或行业 20 日表现占优"],
        risk=["仅为相对表现信号，需要趋势和成交确认"],
        invalid_conditions=["相对强度回落至阈值下方"],
        score=score_for_level("B"),
    )
