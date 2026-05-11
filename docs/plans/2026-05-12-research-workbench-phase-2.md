# Research Workbench Phase 2 Signal Engine

## Scope

Phase 2 adds deterministic, rule-based A/H stock research signal generation. LLMs are not used for signal detection.

## Changes

- Added technical feature calculations:
  - moving averages
  - RSI
  - ATR
  - volume and amount ratios
  - 20/60 day returns
- Added relative strength and timeframe helpers.
- Added rule signal schema and detectors for:
  - 趋势增强
  - 放量突破
  - 回踩确认
  - 趋势破位
  - 高位放量滞涨
  - 相对强势
- Added low-liquidity filtering for opportunity signals.
- Added watchlist scanner and signal persistence into `signal_log`.
- Added signal API routes:
  - `POST /api/signals/scan`
  - `GET /api/signals/today`
  - `GET /api/signals/{symbol}`

## Verification

- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`
- Added focused tests for technical features, trend signals, breakout downgrade behavior, scanner persistence, and signal API routes.

## Notes

- Signal outputs use observation/risk language and avoid broker execution or position guidance.
- Relative strength can be enriched later with index and industry series when those datasets are available.
