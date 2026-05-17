# Resonance V2 Strategy Module Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add the V2 multi-indicator resonance strategy as a standalone analysis module in the symbol workspace.

**Architecture:** Implement a pure backend analyzer that loads local daily bars, optional index bars, and optional fund-flow data, then returns trend state, market filter, buy/sell resonance scores, ATR price channels, position sizing, and execution checklist. Expose it via a dedicated API route and render it as an independent panel in `SymbolWorkspacePage`.

**Tech Stack:** Python FastAPI, pandas, SQLite repository helpers, React + TypeScript, existing CSS/design tokens.

---

### Task 1: Backend Strategy Analyzer

**Files:**
- Create: `tradingagents/strategies/resonance_v2.py`
- Test: `tests/test_resonance_v2_strategy.py`

**Step 1: Write failing tests**

Cover:
- A symbol with enough rising bars returns `symbol`, `mode`, `decision`, `trend_state`, `buy_score`, `sell_score`, `price_channels`, `position_plan`, and `checklist`.
- Conservative mode reports the hard-AND entry condition separately from weighted `S_buy`.
- Missing index data returns a degraded but successful response with market filter status explaining the missing benchmark.

**Step 2: Run targeted test**

Run: `./.venv/bin/python -m pytest -q tests/test_resonance_v2_strategy.py`
Expected: fail because module does not exist.

**Step 3: Implement analyzer**

Use local `daily_bars`, `index_bars`, and `fund_flow_daily`. Implement EMA, ATR, MACD, KDJ, RSI, money-flow proxy, M1-M5 scores, three-layer ATR channel, emergency exit flags, and a compact execution checklist.

**Step 4: Verify targeted test passes**

Run: `./.venv/bin/python -m pytest -q tests/test_resonance_v2_strategy.py`
Expected: pass.

### Task 2: Dedicated API Route

**Files:**
- Create: `tradingagents/api/strategy_routes.py`
- Modify: `tradingagents/api/server.py`
- Test: `tests/test_strategy_routes.py`

**Step 1: Write failing route test**

Use `TestClient(create_app())` to request `/api/strategies/resonance-v2/analyze?symbol=600519.SH&start=2026-01-01&end=2026-05-12&mode=conservative`.

**Step 2: Run targeted test**

Run: `./.venv/bin/python -m pytest -q tests/test_strategy_routes.py`
Expected: fail because route does not exist.

**Step 3: Implement route**

Return `ApiResponse(success=True, data=analyze_resonance_v2(...))`; validate `mode` as `conservative | aggressive`.

**Step 4: Verify targeted test passes**

Run: `./.venv/bin/python -m pytest -q tests/test_strategy_routes.py`

### Task 3: Symbol Workspace UI Module

**Files:**
- Modify: `frontend/src/pages/SymbolWorkspacePage.tsx`
- Modify: `frontend/src/index.css`

**Step 1: Add TypeScript types and data fetch**

Fetch strategy analysis alongside market history, signal history, and market context. Keep failures local to the module so the symbol workspace still loads.

**Step 2: Render standalone module**

Place `ResonanceV2StrategyPanel` under the price chart and context dashboard, above historical signals. Include:
- decision banner
- M1/M2/M3/M4/M5 metrics
- ATR channel table
- execution checklist
- missing data notes

**Step 3: Build**

Run: `npm run build`
Expected: pass.

### Task 4: End-to-End Verification

**Files:**
- Existing local app at `http://127.0.0.1:5174/?view=symbol&symbol=600519.SH&date=2026-05-12`

**Step 1: Run full verification**

Run:
- `./.venv/bin/python -m pytest -q`
- `npm run build`
- `git diff --check`

**Step 2: Browser smoke test**

Open the symbol workspace and verify the standalone V2 strategy module renders without console errors.
