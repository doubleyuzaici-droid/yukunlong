def _seed_event_returns():
    from tradingagents.research.db import get_connection

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO event_return (
                signal_id, entry_date, entry_price, ret_5d, ret_20d, ret_60d,
                max_adverse_20d, max_favorable_20d, success_flag, fail_reason,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "trend-1",
                    "2026-01-11",
                    100,
                    0.02,
                    0.10,
                    0.15,
                    -0.03,
                    0.12,
                    1,
                    None,
                    "now",
                ),
                (
                    "trend-2",
                    "2026-02-11",
                    100,
                    -0.01,
                    -0.05,
                    0.02,
                    -0.08,
                    0.03,
                    0,
                    None,
                    "now",
                ),
            ],
        )
        conn.executemany(
            """
            INSERT INTO signal_log (
                signal_id, date, symbol, market, signal_name, signal_level,
                direction, timeframe
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    "trend-1",
                    "2026-01-10",
                    "600519.SH",
                    "CHINA",
                    "趋势增强",
                    "A",
                    "opportunity",
                    "daily",
                ),
                (
                    "trend-2",
                    "2026-02-10",
                    "600519.SH",
                    "CHINA",
                    "趋势增强",
                    "A",
                    "opportunity",
                    "daily",
                ),
            ],
        )
        conn.commit()


def test_optimizer_diagnostics_and_candidate_generation(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.optimizer.candidate_generator import (
        generate_candidate_strategy_yaml,
    )
    from tradingagents.optimizer.diagnostics import summarize_signal_effectiveness
    from tradingagents.optimizer.parameter_sweep import PARAMETER_GRID
    from tradingagents.research.db import init_db

    init_db()
    _seed_event_returns()

    summary = summarize_signal_effectiveness()
    yaml_text = generate_candidate_strategy_yaml(summary)

    assert summary[0]["signal_name"] == "趋势增强"
    assert summary[0]["sample_count"] == 2
    assert "volume_ratio_min" in PARAMETER_GRID
    assert "1.37" not in yaml_text
    assert "auto_apply: false" in yaml_text
