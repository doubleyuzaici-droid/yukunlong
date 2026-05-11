# Research Workbench Phase 5 Portfolio Backtester

## Scope

Phase 5 adds a minimal portfolio backtester for research simulation only. It does not connect to brokers or place real orders.

## Changes

- Added `trade_log` and `equity_curve` tables to the SQLite schema.
- Added cost, execution, position, and portfolio backtest modules.
- Implemented simple equal-allocation signal entry and fixed holding-period exit.
- Added execution checks for suspended or missing-price entry/exit rows.
- Persisted simulated entry/exit records and equity points.
- Added tests for trade/equity persistence and suspended-entry skip behavior.

## Verification

- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`

## Notes

- Trade sides are stored as `entry` and `exit` to keep the research output vocabulary separate from transaction instructions.
- This MVP uses a fixed holding-period exit; richer portfolio constraints can be layered in later.
