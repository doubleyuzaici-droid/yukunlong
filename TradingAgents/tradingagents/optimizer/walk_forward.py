from __future__ import annotations

from datetime import date, timedelta


def _parse(value: str) -> date:
    return date.fromisoformat(value)


def split_walk_forward_periods(start: str, end: str, folds: int = 3) -> list[dict]:
    start_date = _parse(start)
    end_date = _parse(end)
    if folds < 1:
        raise ValueError("folds must be >= 1")
    total_days = (end_date - start_date).days + 1
    minimum_days = folds * 2
    if total_days < minimum_days:
        return []

    segment_days = total_days // (folds + 1)
    periods = []
    for index in range(folds):
        train_start = start_date
        train_end = start_date + timedelta(days=segment_days * (index + 1) - 1)
        test_start = train_end + timedelta(days=1)
        if index == folds - 1:
            test_end = end_date
        else:
            test_end = test_start + timedelta(days=segment_days - 1)
        if test_start > end_date:
            break
        periods.append(
            {
                "train_start": train_start.isoformat(),
                "train_end": min(train_end, end_date).isoformat(),
                "test_start": test_start.isoformat(),
                "test_end": min(test_end, end_date).isoformat(),
            }
        )
    return periods
