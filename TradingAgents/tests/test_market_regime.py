from tradingagents.research.features.market_state import classify_market_state


def test_classify_market_state_trend_and_volatility():
    assert classify_market_state(0.05, 12, 10, 8) == "bull_trend"
    assert classify_market_state(-0.06, 8, 10, 12) == "bear_trend"
    assert classify_market_state(0.01, 10, 10, 10, atr_percentile=0.9) == "high_volatility"
    assert classify_market_state(0.0, 10, 10, 10, atr_percentile=0.1) == "low_volatility"
