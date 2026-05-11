LEVEL_SCORES = {
    "S": 95.0,
    "A": 85.0,
    "B": 70.0,
    "C": 45.0,
    "D": 20.0,
}


def score_for_level(level: str) -> float:
    return LEVEL_SCORES.get(level, 0.0)


def downgrade_level(level: str) -> str:
    order = ["S", "A", "B", "C", "D"]
    if level not in order:
        return "D"
    return order[min(order.index(level) + 1, len(order) - 1)]
