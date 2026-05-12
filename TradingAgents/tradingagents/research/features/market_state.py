from __future__ import annotations


def classify_market_state(
    ret20: float | None,
    ma20: float | None = None,
    ma60: float | None = None,
    ma120: float | None = None,
    ma60_slope: float | None = None,
    atr_percentile: float | None = None,
    breadth: float | None = None,
) -> str:
    if atr_percentile is not None:
        if atr_percentile >= 0.8:
            return "high_volatility"
        if atr_percentile <= 0.2:
            return "low_volatility"

    if all(v is not None for v in (ma20, ma60, ma120)) and ma20 > ma60 > ma120:
        if (ret20 or 0) > 0.02 and (ma60_slope is None or ma60_slope >= 0):
            return "bull_trend"

    if all(v is not None for v in (ma20, ma60, ma120)) and ma20 < ma60 < ma120:
        if (ret20 or 0) < -0.03 and (ma60_slope is None or ma60_slope <= 0):
            return "bear_trend"

    if breadth is not None and 0.45 <= breadth <= 0.55:
        return "range_bound"
    if ret20 is not None and -0.02 <= ret20 <= 0.02:
        return "range_bound"
    return "range_bound"
