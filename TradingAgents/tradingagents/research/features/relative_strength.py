from __future__ import annotations

import pandas as pd


def _aligned_close_returns(
    left: pd.DataFrame, right: pd.DataFrame, window: int
) -> tuple[pd.Series, pd.Series]:
    merged = (
        left[["date", "close"]]
        .rename(columns={"close": "left_close"})
        .merge(
            right[["date", "close"]].rename(columns={"close": "right_close"}),
            on="date",
            how="left",
        )
    )
    left_ret = merged["left_close"] / merged["left_close"].shift(window) - 1
    right_ret = merged["right_close"] / merged["right_close"].shift(window) - 1
    return left_ret, right_ret


def calc_relative_strength_vs_index(
    stock_df: pd.DataFrame, index_df: pd.DataFrame, window: int = 20
) -> pd.Series:
    stock_ret, index_ret = _aligned_close_returns(stock_df, index_df, window)
    return stock_ret - index_ret


def calc_relative_strength_vs_industry(
    stock_df: pd.DataFrame, industry_df: pd.DataFrame, window: int = 20
) -> pd.Series:
    stock_ret, industry_ret = _aligned_close_returns(stock_df, industry_df, window)
    return stock_ret - industry_ret
