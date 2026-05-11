def split_walk_forward_periods(start: str, end: str) -> list[dict]:
    return [
        {"train_start": start, "train_end": end, "test_start": start, "test_end": end}
    ]
