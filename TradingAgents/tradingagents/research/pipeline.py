from __future__ import annotations

from tradingagents.backtest.event_backtester import run_event_backtest
from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
from tradingagents.optimizer.diagnostics import summarize_signal_effectiveness
from tradingagents.research.data_sync import (
    sync_watchlist_bars,
    sync_watchlist_fund_flows,
)
from tradingagents.research.factor_pipeline import compute_watchlist_factors
from tradingagents.research.signals.scanner import persist_signals, scan_watchlist


def run_pipeline(start: str, end: str, signal_date: str | None = None) -> dict:
    signal_date = signal_date or end
    rows_synced = sync_watchlist_bars(start, end)
    fund_flow_rows = sync_watchlist_fund_flows(start, end)
    factor_rows = compute_watchlist_factors(start, end)
    signals = scan_watchlist(signal_date)
    persist_signals(signals)
    event_result = run_event_backtest(None, start, end)
    portfolio_result = run_portfolio_backtest(start, end)
    summary = summarize_signal_effectiveness()
    return {
        "rows_synced": rows_synced,
        "fund_flow_rows": fund_flow_rows,
        "factor_rows": factor_rows,
        "signal_count": len(signals),
        "event_backtest": event_result,
        "portfolio_backtest": portfolio_result,
        "summary": summary,
    }
