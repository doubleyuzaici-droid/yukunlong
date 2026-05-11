# Research Workbench Phase 1 Structured Data Layer

## Scope

Phase 1 adds a local SQLite research data layer for A/H stock research workflows. It does not add trading execution, broker integration, or LLM-driven signal decisions.

## Changes

- Added `tradingagents.research` package with:
  - SQLite schema initialization in `db.py`
  - watchlist, daily bar, factor, and signal repository functions
  - lightweight data sync, calendar, data-quality, and CLI modules
- Added all Phase 1 database tables:
  - `security_master`
  - `watchlist`
  - `daily_bars`
  - `index_bars`
  - `factor_daily`
  - `signal_log`
  - `event_return`
  - `data_quality_log`
- Added structured A/H stock daily bar DataFrame functions in `tushare_china.py`.
- Added CLI commands:
  - `init-db`
  - `add-watchlist`
  - `list-watchlist`
  - `sync-bars`
  - `data-quality`
- Added tests for DB initialization, repository idempotency, CLI basics, and mocked Tushare structured data.

## Verification

- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`
- `python -m tradingagents.research.cli init-db`
- `python -m tradingagents.research.cli add-watchlist 00700.HK 1024.HK 600519.SH`
- `python -m tradingagents.research.cli list-watchlist`

## Notes

- Tests mock external market data and do not depend on network access.
- `sync-bars` uses the structured Tushare adapters and will require `TUSHARE_TOKEN` outside tests.
