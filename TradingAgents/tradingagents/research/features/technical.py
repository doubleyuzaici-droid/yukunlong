from __future__ import annotations

import pandas as pd


def _sorted_copy(df: pd.DataFrame) -> pd.DataFrame:
    if "date" in df.columns:
        return df.sort_values("date").reset_index(drop=True).copy()
    return df.reset_index(drop=True).copy()


def add_moving_averages(df: pd.DataFrame) -> pd.DataFrame:
    result = _sorted_copy(df)
    result["ma20"] = result["close"].rolling(20).mean()
    result["ma60"] = result["close"].rolling(60).mean()
    result["ma120"] = result["close"].rolling(120).mean()
    return result


def add_rsi(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    result = _sorted_copy(df)
    delta = result["close"].diff()
    gain = delta.clip(lower=0).rolling(period).mean()
    loss = (-delta.clip(upper=0)).rolling(period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    rsi = rsi.mask((loss == 0) & (gain > 0), 100.0)
    rsi = rsi.mask((loss == 0) & (gain == 0), 50.0)
    result[f"rsi{period}"] = rsi
    return result


def add_atr(df: pd.DataFrame, period: int = 14) -> pd.DataFrame:
    result = _sorted_copy(df)
    previous_close = result["close"].shift(1)
    true_range = pd.concat(
        [
            result["high"] - result["low"],
            (result["high"] - previous_close).abs(),
            (result["low"] - previous_close).abs(),
        ],
        axis=1,
    ).max(axis=1)
    result[f"atr{period}"] = true_range.rolling(period).mean()
    return result


def add_volume_ratios(df: pd.DataFrame) -> pd.DataFrame:
    result = _sorted_copy(df)
    result["volume_ratio20"] = result["volume"] / result["volume"].rolling(20).mean()
    result["amount_ratio20"] = result["amount"] / result["amount"].rolling(20).mean()
    result["avg_amount20"] = result["amount"].rolling(20).mean()
    return result


def add_returns(df: pd.DataFrame) -> pd.DataFrame:
    result = _sorted_copy(df)
    result["ret20"] = result["close"] / result["close"].shift(20) - 1
    result["ret60"] = result["close"] / result["close"].shift(60) - 1
    return result


def add_all_technical_features(df: pd.DataFrame) -> pd.DataFrame:
    result = add_moving_averages(df)
    result = add_rsi(result)
    result = add_atr(result)
    result = add_volume_ratios(result)
    return add_returns(result)
