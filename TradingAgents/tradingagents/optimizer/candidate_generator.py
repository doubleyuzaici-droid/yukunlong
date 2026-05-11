from __future__ import annotations

import yaml


def generate_candidate_strategy_yaml(summary: list[dict]) -> str:
    strongest = summary[0]["signal_name"] if summary else "放量突破"
    candidate = {
        "strategy_name": "candidate_research_signal_v1",
        "auto_apply": False,
        "entry": {
            "signal_names": [strongest],
            "min_signal_level": "A",
        },
        "filters": {
            "volume_ratio_min": 1.5,
            "rsi_max": 75,
            "breakout_lookback": 60,
            "min_avg_amount_hk": 50_000_000,
        },
        "exit": {
            "holding_days": 20,
        },
        "review_required": True,
    }
    return yaml.safe_dump(candidate, allow_unicode=True, sort_keys=False)
