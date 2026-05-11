from __future__ import annotations

import pandas as pd


def avg_amount(df: pd.DataFrame, window: int = 20) -> float:
    if df.empty or "amount" not in df:
        return 0.0
    return float(df["amount"].tail(window).mean())


def is_low_liquidity(market: str, average_amount: float) -> bool:
    if market == "HONGKONG":
        return average_amount < 30_000_000
    if market == "CHINA":
        return average_amount < 30_000_000
    return False
