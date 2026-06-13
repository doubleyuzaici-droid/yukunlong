# SuperTrend Backtest Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add SuperTrend backtest statistics to the individual stock workbench K-line area.

**Architecture:** Compute SuperTrend backtest summaries in `TradingSignalKline.helpers.ts` from the same bars and parameters used by the chart. Render compact cards in `MarketWidgets.tsx` near the existing K-line signal backtest area, visible when SuperTrend is enabled, with a comparison between current parameters and a robust preset.

**Tech Stack:** React, TypeScript, existing frontend helper tests, Vite build.

---

### Task 1: Helper Test

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`

**Steps:**
1. Add tests for a new `buildSuperTrendBacktestSummary` helper.
2. Verify the test fails because the helper is not exported.
3. Implement the helper with the existing SuperTrend calculation.
4. Verify tests pass.

### Task 2: Workbench UI

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Steps:**
1. Compute current SuperTrend backtest from `periodData.bars`.
2. Compute a robust comparison preset using `ATR=30` and `Multiplier=3.5`.
3. Render compact cards next to the existing K-line signal backtest area.
4. Keep the panel hidden until the ST layer is enabled.

### Task 3: Verification

**Commands:**
- `npm run test`
- `npm run build`
- `curl -I -sS http://127.0.0.1:5173/`
