from tradingagents.backtest.metrics import summarize_equity_curve


def test_summarize_equity_curve_computes_risk_adjusted_metrics():
    rows = [
        {"date": "2026-01-01", "equity": 100.0, "drawdown": 0.0},
        {"date": "2026-01-02", "equity": 101.0, "drawdown": 0.0},
        {"date": "2026-01-03", "equity": 99.0, "drawdown": -0.02},
        {"date": "2026-01-04", "equity": 103.0, "drawdown": 0.0},
    ]
    metrics = summarize_equity_curve(rows)
    assert "sharpe" in metrics
    assert "sortino" in metrics
    assert "calmar" in metrics
    assert "information_ratio" in metrics
    assert metrics["max_drawdown"] == -0.02
