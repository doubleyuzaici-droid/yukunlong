from __future__ import annotations

import pandas as pd


def _resample(df: pd.DataFrame, rule: str) -> pd.DataFrame:
    frame = df.copy()
    frame["date"] = pd.to_datetime(frame["date"])
    frame = frame.sort_values("date").set_index("date")
    result = frame.resample(rule).agg(
        {
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum",
            "amount": "sum",
        }
    )
    return result.dropna(subset=["close"]).reset_index()


def resample_weekly(df: pd.DataFrame) -> pd.DataFrame:
    return _resample(df, "W-FRI")


def resample_monthly(df: pd.DataFrame) -> pd.DataFrame:
    return _resample(df, "ME")


def _classify_state(frame: pd.DataFrame) -> str:
    if len(frame) < 4:
        return "neutral"
    result = frame.copy()
    result["ma4"] = result["close"].rolling(4).mean()
    latest = result.iloc[-1]
    previous = result.iloc[-4]
    if latest["close"] > latest["ma4"] and latest["ma4"] >= previous["ma4"]:
        return "strong"
    if latest["close"] > latest["ma4"]:
        return "improving"
    if latest["close"] < latest["ma4"] and latest["ma4"] < previous["ma4"]:
        return "weak"
    return "neutral"


def classify_weekly_state(weekly_df: pd.DataFrame) -> str:
    return _classify_state(weekly_df)


def classify_monthly_state(monthly_df: pd.DataFrame) -> str:
    return _classify_state(monthly_df)
