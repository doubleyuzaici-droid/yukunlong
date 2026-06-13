from __future__ import annotations

from datetime import datetime, timezone

from tradingagents.backtest.event_backtester import run_event_backtest
from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
from tradingagents.optimizer.diagnostics import summarize_signal_effectiveness
from tradingagents.research.data_sync import (
    sync_watchlist_bars,
    sync_watchlist_fund_flows,
)
from tradingagents.research.factor_pipeline import compute_watchlist_factors
from tradingagents.research.quality import list_quality_issues
from tradingagents.research.signals.scanner import persist_signals, scan_watchlist


_PIPELINE_WARNING_CHECKS = {"data_sync", "fund_flow_sync"}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _collect_pipeline_warnings(
    start: str,
    end: str,
    *,
    created_after: str | None = None,
) -> list[dict]:
    warnings_by_key: dict[tuple[str | None, str | None, str | None], dict] = {}
    for issue in list_quality_issues():
        issue_date = issue.get("date")
        if issue.get("check_name") not in _PIPELINE_WARNING_CHECKS:
            continue
        if issue_date is not None and not (start <= issue_date <= end):
            continue
        if created_after and (issue.get("created_at") or "") < created_after:
            continue
        key = (
            issue.get("check_name"),
            issue.get("symbol"),
            issue.get("message"),
        )
        current = warnings_by_key.get(key)
        if current is None or int(issue.get("id") or 0) > int(current.get("id") or 0):
            warnings_by_key[key] = issue
    return sorted(
        warnings_by_key.values(),
        key=lambda item: int(item.get("id") or 0),
        reverse=True,
    )


def run_pipeline(
    start: str,
    end: str,
    *,
    signal_date: str | None = None,
    source: str | None = None,
    include_fund_flow: bool = True,
) -> dict:
    signal_date = signal_date or end
    started_at = _now()
    if source is None:
        rows_synced = sync_watchlist_bars(start, end)
    else:
        rows_synced = sync_watchlist_bars(start, end, source=source)
    fund_flow_rows = sync_watchlist_fund_flows(start, end) if include_fund_flow else 0
    factor_rows = compute_watchlist_factors(start, end)
    signals = scan_watchlist(signal_date)
    persist_signals(signals)
    event_result = run_event_backtest(None, start, end)
    portfolio_result = run_portfolio_backtest(start, end)
    summary = summarize_signal_effectiveness()
    warnings = _collect_pipeline_warnings(start, end, created_after=started_at)
    return {
        "start": start,
        "end": end,
        "signal_date": signal_date,
        "rows_synced": rows_synced,
        "fund_flow_rows": fund_flow_rows,
        "factor_rows": factor_rows,
        "signal_count": len(signals),
        "warnings": warnings,
        "event_backtest": event_result,
        "portfolio_backtest": portfolio_result,
        "summary": summary,
    }
