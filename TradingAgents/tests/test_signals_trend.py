import pandas as pd


def _featured_frame(**latest_overrides) -> pd.DataFrame:
    rows = []
    for index in range(70):
        rows.append(
            {
                "date": f"2026-03-{index + 1:02d}",
                "symbol": "600519.SH",
                "market": "CHINA",
                "close": 100.0 + index,
                "ma20": 120.0 + index,
                "ma60": 100.0 + index * 0.2,
                "amount_ratio20": 1.6,
                "rel_strength_index20": 0.03,
                "weekly_state": "strong",
            }
        )
    rows[-1].update(latest_overrides)
    return pd.DataFrame(rows)


def test_trend_enhancement_emits_opportunity_signal_with_evidence():
    from tradingagents.research.signals.trend import detect_trend_enhancement

    signal = detect_trend_enhancement(_featured_frame(), "2026-03-70")

    assert signal is not None
    assert signal.signal_name == "趋势增强"
    assert signal.direction == "opportunity"
    assert signal.signal_level == "A"
    assert signal.evidence
    assert signal.invalid_conditions


def test_trend_enhancement_downgrades_without_confirmation():
    from tradingagents.research.signals.trend import detect_trend_enhancement

    signal = detect_trend_enhancement(
        _featured_frame(amount_ratio20=1.0, rel_strength_index20=-0.01),
        "2026-03-70",
    )

    assert signal is not None
    assert signal.signal_level == "B"
    assert signal.risk
