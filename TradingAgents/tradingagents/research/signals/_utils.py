from __future__ import annotations

import pandas as pd


def history_until(df: pd.DataFrame, date: str) -> pd.DataFrame:
    if "date" not in df.columns:
        return df.copy()
    return df[df["date"].astype(str) <= date].copy()


def value(row, key: str, default=None):
    current = row.get(key, default)
    if pd.isna(current):
        return default
    return current
