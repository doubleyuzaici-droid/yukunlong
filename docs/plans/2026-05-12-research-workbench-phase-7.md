# Research Workbench Phase 7 Strategy Optimizer Skeleton

## Scope

Phase 7 adds a safe strategy optimization skeleton. It diagnoses historical signal outcomes and generates candidate configuration text for human review only.

## Changes

- Added optimizer package with diagnostics, failure reason classification, parameter grid, ablation steps, walk-forward placeholder, candidate generation, and report rendering.
- Added coarse parameter grid only:
  - volume ratio
  - RSI cap
  - breakout lookback
  - holding days
  - HK liquidity floor
- Added candidate YAML generation with `auto_apply: false`.
- Added tests for diagnostics and candidate generation.

## Verification

- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`

## Notes

- The optimizer does not apply, activate, or delete strategies.
- Fine-grained overfit-prone parameters are intentionally excluded.
