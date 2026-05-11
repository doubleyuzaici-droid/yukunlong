from tradingagents.markets import detect_market, Market


def annotate_market_decision(decision: str, symbol: str) -> str:
    market = detect_market(symbol)

    if market == Market.CHINA:
        disclaimer = (
            "SIMULATION ONLY: This China A-share output is for research and paper trading only; "
            "it is not financial advice and must not be treated as a live brokerage instruction."
        )
    elif market == Market.HONGKONG:
        disclaimer = (
            "SIMULATION ONLY: This Hong Kong stock output is for research and paper trading only; "
            "it is not financial advice and must not be treated as a live brokerage instruction."
        )
    else:
        return decision

    if disclaimer in decision:
        return decision
    return f"{disclaimer}\n\n{decision}"
