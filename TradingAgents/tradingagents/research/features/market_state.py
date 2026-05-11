def classify_market_state(ret20: float | None) -> str:
    if ret20 is None:
        return "neutral"
    if ret20 > 0.03:
        return "strong"
    if ret20 < -0.05:
        return "weak"
    return "neutral"
