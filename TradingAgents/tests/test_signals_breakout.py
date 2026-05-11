import pandas as pd


def _breakout_frame(**latest_overrides) -> pd.DataFrame:
    rows = []
    for index in range(65):
        rows.append(
            {
                "date": f"2026-04-{index + 1:02d}",
                "symbol": "600519.SH",
                "market": "CHINA",
                "close": 100.0 + index,
                "ma60": 90.0,
                "amount_ratio20": 1.8,
                "rsi14": 70.0,
                "weekly_state": "strong",
            }
        )
    rows[-1].update(latest_overrides)
    return pd.DataFrame(rows)


def test_volume_breakout_emits_signal():
    from tradingagents.research.signals.breakout import detect_volume_breakout

    signal = detect_volume_breakout(_breakout_frame(), "2026-04-65")

    assert signal is not None
    assert signal.signal_name == "放量突破"
    assert signal.direction == "opportunity"
    assert signal.signal_level == "A"
    assert signal.evidence


def test_weak_weekly_breakout_does_not_upgrade_to_a_or_s():
    from tradingagents.research.signals.breakout import detect_volume_breakout

    signal = detect_volume_breakout(
        _breakout_frame(weekly_state="weak", rsi14=80.0), "2026-04-65"
    )

    assert signal is not None
    assert signal.signal_level == "B"
    assert "周线未确认，降级" in signal.risk
    assert "短期偏热" in signal.risk
