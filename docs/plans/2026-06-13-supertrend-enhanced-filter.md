# SuperTrend Enhanced Filter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an optional `ST增强` backtest comparison to the individual stock workbench.

**Architecture:** Extend the existing SuperTrend backtest helper with an optional entry filter. The UI stores the toggle in chart preferences and renders an extra comparison card inside the existing `ST回测` block.

**Tech Stack:** React, TypeScript, existing helper tests, Vite build.

---

### Task 1: Helper Test

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`

**Steps:**
1. Add a failing test for `entryFilter: "trendBreakout"`.
2. Run `npm run test` and confirm TypeScript/test failure because the option is unsupported.
3. Implement the minimal helper logic to wait for MA120 slope and 20-bar breakout confirmation after a SuperTrend buy entry.
4. Run `npm run test` and confirm the test passes.

### Task 2: Workbench UI

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Steps:**
1. Add `supertrendEnhanced` to chart preferences and normalization.
2. Add a `ST增强` toggle next to `ST`.
3. Compute enhanced SuperTrend backtest only when both `ST` and `ST增强` are enabled.
4. Render an `增强ST` card in the existing `ST回测` block.

### Task 3: Verification

**Commands:**
- `npm run test`
- `npm run build`
- Browser check on `http://127.0.0.1:5173/?view=symbolWorkspace&symbol=600519.SH&date=2026-06-13&ws=v1&tab=chart`
