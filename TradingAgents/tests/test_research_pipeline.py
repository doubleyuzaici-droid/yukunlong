from tradingagents.research.pipeline import run_pipeline


def test_run_pipeline_executes_in_expected_order(monkeypatch):
    calls = []

    monkeypatch.setattr(
        "tradingagents.research.pipeline.sync_watchlist_bars",
        lambda start, end: calls.append(("sync", start, end)) or 10,
    )
    monkeypatch.setattr(
        "tradingagents.research.pipeline.sync_watchlist_fund_flows",
        lambda start, end: calls.append(("flow", start, end)) or 5,
    )
    monkeypatch.setattr(
        "tradingagents.research.pipeline.compute_watchlist_factors",
        lambda start, end: calls.append(("factor", start, end)) or 20,
    )
    monkeypatch.setattr(
        "tradingagents.research.pipeline.scan_watchlist",
        lambda date: calls.append(("scan", date)) or [{"signal_id": "s1"}],
    )
    monkeypatch.setattr(
        "tradingagents.research.pipeline.persist_signals",
        lambda signals: calls.append(("persist", len(signals))),
    )
    monkeypatch.setattr(
        "tradingagents.research.pipeline.run_event_backtest",
        lambda names, start, end: calls.append(("event", start, end)) or {"events": []},
    )
    monkeypatch.setattr(
        "tradingagents.research.pipeline.run_portfolio_backtest",
        lambda start, end: calls.append(("portfolio", start, end)) or {"metrics": {}},
    )
    monkeypatch.setattr(
        "tradingagents.research.pipeline.summarize_signal_effectiveness",
        lambda: calls.append(("summary",)) or [],
    )

    result = run_pipeline("2026-01-01", "2026-01-31")

    assert result["rows_synced"] == 10
    assert result["fund_flow_rows"] == 5
    assert result["factor_rows"] == 20
    assert result["signal_count"] == 1
    assert calls == [
        ("sync", "2026-01-01", "2026-01-31"),
        ("flow", "2026-01-01", "2026-01-31"),
        ("factor", "2026-01-01", "2026-01-31"),
        ("scan", "2026-01-31"),
        ("persist", 1),
        ("event", "2026-01-01", "2026-01-31"),
        ("portfolio", "2026-01-01", "2026-01-31"),
        ("summary",),
    ]
