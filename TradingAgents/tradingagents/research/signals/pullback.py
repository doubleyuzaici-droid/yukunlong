from __future__ import annotations

import pandas as pd

from ._utils import history_until, value
from .schemas import ResearchSignal
from .scoring import score_for_level


def detect_pullback_confirmation(df: pd.DataFrame, date: str) -> ResearchSignal | None:
    history = history_until(df, date)
    if len(history) < 20:
        return None
    latest = history.iloc[-1]
    close = value(latest, "close")
    ma20 = value(latest, "ma20")
    ma60 = value(latest, "ma60")
    if close is None or ma20 is None or ma60 is None:
        return None
    pullback = history["high"].tail(20).max() / close - 1
    weekly_state = value(latest, "weekly_state", "neutral")
    if not (
        close > ma60
        and 0.03 <= pullback <= 0.12
        and close > ma20
        and value(latest, "amount_ratio20", 0.0) < 1.2
        and weekly_state != "weak"
    ):
        return None

    return ResearchSignal(
        date=str(latest["date"]),
        symbol=str(latest["symbol"]),
        market=str(latest["market"]),
        signal_name="回踩确认",
        signal_level="B",
        direction="opportunity",
        timeframe="daily",
        evidence=["趋势上方回撤 3%-12%", "close 重新站上 ma20"],
        risk=["缩量确认信号需要后续成交跟进"],
        invalid_conditions=["close 跌破 ma60", "周线转弱"],
        score=score_for_level("B"),
    )
