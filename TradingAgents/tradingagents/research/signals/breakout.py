from __future__ import annotations

import pandas as pd

from ._utils import history_until, value
from .schemas import ResearchSignal
from .scoring import score_for_level


def detect_volume_breakout(df: pd.DataFrame, date: str) -> ResearchSignal | None:
    history = history_until(df, date)
    if len(history) < 60:
        return None
    latest = history.iloc[-1]
    close = value(latest, "close")
    ma60 = value(latest, "ma60")
    amount_ratio = value(latest, "amount_ratio20", 0.0)
    if close is None or ma60 is None:
        return None
    highest_close_60 = history["close"].tail(60).max()
    if not (close >= highest_close_60 and amount_ratio >= 1.5 and close > ma60):
        return None

    weekly_state = value(latest, "weekly_state", "neutral")
    level = "A"
    risk = []
    if value(latest, "rsi14", 0.0) > 75:
        risk.append("短期偏热")
    if weekly_state == "weak":
        risk.append("周线未确认，降级")
        level = "B"

    return ResearchSignal(
        date=str(latest["date"]),
        symbol=str(latest["symbol"]),
        market=str(latest["market"]),
        signal_name="放量突破",
        signal_level=level,
        direction="opportunity",
        timeframe="daily",
        evidence=[
            "close >= 最近 60 日最高收盘价",
            "amount_ratio20 >= 1.5",
            "close > ma60",
        ],
        risk=risk,
        invalid_conditions=["突破后 5 日内跌回突破区间", "close 跌破 ma60"],
        score=score_for_level(level),
    )
