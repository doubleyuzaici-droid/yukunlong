# Research Workbench Phase 4 Event Backtester

## Scope

Phase 4 adds event-level signal backtesting using the required `T` signal, `T+1` open entry assumption.

## Changes

- Added `tradingagents.backtest` package.
- Implemented event backtesting from `signal_log` and `daily_bars`.
- Persisted event outcomes and skipped-event reasons into `event_return`.
- Added summary metrics by signal name.
- Added Markdown event backtest report rendering.
- Added event backtest API routes:
  - `POST /api/backtests/event`
  - `GET /api/backtests/event/{backtest_id}`
  - `GET /api/backtests/event/{backtest_id}/report`
- Added tests for:
  - T+1 open entry
  - 5/20/60 day returns
  - suspended T+1 entry skip
  - API run/fetch/report flow

## Verification

- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`

## Notes

- Backtest API stores run results in process memory for MVP use. A durable backtest run table can be added when portfolio/backtest history becomes a frontend workflow.
- Excess return fields are left nullable until index and industry series are wired into the structured data layer.
