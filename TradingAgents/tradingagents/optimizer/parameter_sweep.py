from __future__ import annotations

from itertools import product

PARAMETER_GRID = {
    "volume_ratio_min": [1.2, 1.5, 1.8, 2.0],
    "rsi_max": [70, 75, 80],
    "breakout_lookback": [20, 60, 120],
    "holding_days": [5, 20, 60],
    "min_avg_amount_hk": [30_000_000, 50_000_000, 100_000_000],
}


def iter_parameter_grid(grid: dict | None = None):
    active_grid = grid or PARAMETER_GRID
    keys = list(active_grid)
    for values in product(*(active_grid[key] for key in keys)):
        yield dict(zip(keys, values))


def run_parameter_sweep(
    start: str,
    end: str,
    backtest_fn,
    grid: dict | None = None,
    score_key: str = "sharpe",
) -> list[dict]:
    results = []
    for params in iter_parameter_grid(grid):
        result = backtest_fn(start=start, end=end, params=params)
        metrics = result.get("metrics", {})
        results.append(
            {
                "params": params,
                "metrics": metrics,
                "score": metrics.get(score_key, 0.0),
            }
        )
    return sorted(results, key=lambda item: item["score"], reverse=True)
