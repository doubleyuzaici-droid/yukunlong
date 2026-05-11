# Research Workbench Phase 0 Stabilization

## Scope

Phase 0 prepared the existing TradingAgents codebase for the A/H research workbench work without adding new signal, backtest, or trading features.

## Changes

- Formatted Python source and tests with Black.
- Fixed remaining Ruff issues while preserving existing compatibility re-exports.
- Fixed `_fetch_returns()` so benchmark comparison uses a valid benchmark symbol fallback and reports the same effective return window for raw and alpha returns.
- Rewrote `start.sh` into a maintainable Bash script with strict mode, local data directory setup, process cleanup, and automatic frontend port selection when `5173` is already occupied.
- Added baseline research configuration files:
  - `TradingAgents/config/research.yaml`
  - `TradingAgents/config/universe.yaml`
  - `TradingAgents/config/strategy.yaml`
  - `TradingAgents/config/cost.yaml`
- Extended `TradingAgents/.env.example` with `TUSHARE_TOKEN` and `TRADINGAGENTS_DATA_DIR`.

## Verification

- `bash -n start.sh`
- `python - <<'PY' ... yaml.safe_load(...) ... PY`
- `.venv/bin/ruff check tradingagents tests`
- `.venv/bin/pytest tests -q`
- `npm run build`
- `./start.sh`
- `curl http://localhost:8100/docs` returned `200`.
- `curl http://localhost:5174/` returned the TradingAgents frontend when `5173` was occupied by another local project.
- `curl http://localhost:8100/openapi.json` confirmed `/api/analyze` is still registered.

## Notes

- A real `/api/analyze` run was not triggered during verification because it can require provider credentials and external model calls.
- `npm install` reports existing moderate dependency advisories; they were not changed in Phase 0.
