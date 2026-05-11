# Research Workbench Phase 3 Daily Report

## Scope

Phase 3 adds Markdown daily recap generation for rule-based research signals.

## Changes

- Added report summary and Markdown rendering modules under `tradingagents.research.reports`.
- Added daily report generation and file saving to `local_data/reports`.
- Added report API routes:
  - `GET /api/reports/daily`
  - `GET /api/reports/daily/download`
- Added tests verifying:
  - Markdown signal summary content
  - report file writing
  - report API return and download behavior
  - prohibited trading-direction terms are absent from generated report content

## Verification

- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`

## Notes

- Data quality fields are present as placeholders and can be wired to richer checks in later phases.
- Report language stays in observation/risk/review terminology.
