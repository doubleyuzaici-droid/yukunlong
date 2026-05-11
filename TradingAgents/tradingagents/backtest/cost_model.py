def estimate_cost(market: str, side: str, notional: float) -> float:
    if market == "CHINA":
        bps = 3
        if side == "exit":
            bps += 5
        return notional * bps / 10_000
    if market == "HONGKONG":
        return notional * 15.565 / 10_000
    return notional * 5 / 10_000
