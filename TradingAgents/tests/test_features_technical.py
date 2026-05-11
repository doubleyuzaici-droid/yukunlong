import pandas as pd
import pytest


def _price_frame(length: int = 130) -> pd.DataFrame:
    closes = [float(i) for i in range(1, length + 1)]
    return pd.DataFrame(
        {
            "date": pd.date_range("2026-01-01", periods=length, freq="D").strftime(
                "%Y-%m-%d"
            ),
            "open": closes,
            "high": [value + 1 for value in closes],
            "low": [value - 1 for value in closes],
            "close": closes,
            "volume": [1000.0 + i for i in range(length)],
            "amount": [100000.0 + i * 100 for i in range(length)],
        }
    )


def test_technical_features_add_expected_columns_and_values():
    from tradingagents.research.features.technical import (
        add_atr,
        add_moving_averages,
        add_returns,
        add_rsi,
        add_volume_ratios,
    )

    frame = _price_frame()
    result = add_returns(
        add_volume_ratios(add_atr(add_rsi(add_moving_averages(frame))))
    )

    latest = result.iloc[-1]
    assert latest["ma20"] == pytest.approx(sum(range(111, 131)) / 20)
    assert latest["ma60"] == pytest.approx(sum(range(71, 131)) / 60)
    assert latest["ma120"] == pytest.approx(sum(range(11, 131)) / 120)
    assert latest["rsi14"] == pytest.approx(100.0)
    assert latest["atr14"] > 0
    assert latest["volume_ratio20"] == pytest.approx(
        latest["volume"] / result["volume"].iloc[-20:].mean()
    )
    assert latest["ret20"] == pytest.approx(130 / 110 - 1)
    assert latest["ret60"] == pytest.approx(130 / 70 - 1)


def test_relative_strength_is_stock_return_minus_benchmark_return():
    from tradingagents.research.features.relative_strength import (
        calc_relative_strength_vs_index,
    )

    stock = pd.DataFrame({"date": ["2026-01-01", "2026-01-02"], "close": [100, 110]})
    index = pd.DataFrame({"date": ["2026-01-01", "2026-01-02"], "close": [100, 105]})

    result = calc_relative_strength_vs_index(stock, index, window=1)

    assert result.iloc[-1] == pytest.approx(0.05)


def test_timeframe_resampling_and_state_classification():
    from tradingagents.research.features.timeframe import (
        classify_weekly_state,
        resample_weekly,
    )

    frame = _price_frame(80)
    weekly = resample_weekly(frame)

    assert {"open", "high", "low", "close", "volume", "amount"}.issubset(weekly.columns)
    assert classify_weekly_state(weekly) == "strong"
