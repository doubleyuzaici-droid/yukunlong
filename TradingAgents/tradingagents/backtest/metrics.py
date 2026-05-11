from __future__ import annotations

import pandas as pd


def summarize_events(events: list[dict]) -> list[dict]:
    if not events:
        return []
    frame = pd.DataFrame(events)
    summaries = []
    for signal_name, group in frame.groupby("signal_name", dropna=False):
        summaries.append(
            {
                "signal_name": signal_name,
                "sample_count": int(len(group)),
                "win_rate_5d": float((group["ret_5d"] > 0).mean()),
                "win_rate_20d": float((group["ret_20d"] > 0).mean()),
                "median_ret_20d": float(group["ret_20d"].median()),
                "mean_ret_20d": float(group["ret_20d"].mean()),
                "mean_max_adverse_20d": float(group["max_adverse_20d"].mean()),
            }
        )
    return summaries
