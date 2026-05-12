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


def test_walk_forward_periods_are_ordered_and_out_of_sample():
    from tradingagents.optimizer.walk_forward import split_walk_forward_periods

    periods = split_walk_forward_periods("2026-01-01", "2026-06-30", folds=3)

    assert len(periods) == 3
    for period in periods:
        assert period["train_start"] <= period["train_end"]
        assert period["train_end"] < period["test_start"]
        assert period["test_start"] <= period["test_end"]


def test_parameter_sweep_runs_all_combinations_and_ranks():
    from tradingagents.optimizer.parameter_sweep import run_parameter_sweep

    calls = []

    def fake_backtest(*, start, end, params):
        calls.append((start, end, params))
        return {"metrics": {"sharpe": params["a"] + params["b"]}}

    ranked = run_parameter_sweep(
        "2026-01-01",
        "2026-01-31",
        backtest_fn=fake_backtest,
        grid={"a": [1, 2], "b": [10, 20]},
    )

    assert len(calls) == 4
    assert ranked[0]["score"] == 22
    assert ranked[-1]["score"] == 11


def test_walk_forward_orchestrator_runs_fold_pipeline():
    from tradingagents.optimizer.walk_forward import run_walk_forward

    sweep_calls = []
    backtest_calls = []

    def fake_sweep(train_start, train_end):
        sweep_calls.append((train_start, train_end))
        return [{"params": {"p": 1}, "score": 2.0}]

    def fake_backtest(test_start, test_end, params):
        backtest_calls.append((test_start, test_end, params))
        return {"metrics": {"total_return": 0.1}}

    result = run_walk_forward(
        "2026-01-01", "2026-06-30", sweep_fn=fake_sweep, backtest_fn=fake_backtest, folds=3
    )

    assert result["fold_count"] == 3
    assert len(sweep_calls) == 3
    assert len(backtest_calls) == 3
    assert all(call[2] == {"p": 1} for call in backtest_calls)


def test_optimizer_report_includes_failure_and_ablation_sections(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.optimizer.ablation_test import list_ablation_steps
    from tradingagents.optimizer.diagnostics import summarize_failure_reasons
    from tradingagents.optimizer.optimizer_report import render_optimizer_report
    from tradingagents.research.db import get_connection, init_db

    init_db()
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
                ("failed-1", "2026-01-11", 100, None, None, None, None, None, 0, "low_liquidity", "now"),
                ("failed-2", "2026-01-12", 100, None, None, None, None, None, 0, "no_executable_entry", "now"),
            ],
        )
        conn.commit()

    failures = summarize_failure_reasons()
    markdown = render_optimizer_report([], failures, list_ablation_steps())

    assert failures[0]["fail_reason"] == "low_liquidity"
    assert "失败归因" in markdown
    assert "消融检查" in markdown
    assert "liquidity_filter" in markdown
