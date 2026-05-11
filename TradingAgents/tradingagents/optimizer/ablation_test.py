ABLATION_STEPS = [
    "base_strategy",
    "market_filter",
    "industry_filter",
    "weekly_confirmation",
    "liquidity_filter",
    "rsi_overheat_filter",
]


def list_ablation_steps() -> list[str]:
    return list(ABLATION_STEPS)
