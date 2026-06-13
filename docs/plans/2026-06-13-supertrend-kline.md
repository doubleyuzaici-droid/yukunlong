# SuperTrend Kline Overlay Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a tested SuperTrend overlay with Buy/Sell trend-reversal markers to the symbol workbench K-line chart.

**Architecture:** Compute SuperTrend in `TradingSignalKline.helpers.ts` from normalized OHLC bars, using Wilder ATR smoothing with configurable period and multiplier. Render the resulting bullish and bearish line series plus reversal markers in `TradingViewKlineChart.tsx`, and expose a persisted ST toggle and parameters through `MarketWidgets.tsx`.

**Tech Stack:** React 18, TypeScript, Vite, lightweight-charts, existing helper tests.

---

### Task 1: SuperTrend Helper Test

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`

**Step 1: Write the failing test**

Add a test that imports `buildLightweightSuperTrendSeries`, feeds a deterministic OHLC sequence, and asserts:
- invalid bars are ignored;
- both bullish and bearish line points are produced;
- a Buy signal appears on bearish-to-bullish reversal;
- a Sell signal appears on bullish-to-bearish reversal.

**Step 2: Run test to verify it fails**

Run: `npm run test`

Expected: TypeScript compile fails because `buildLightweightSuperTrendSeries` is not exported.

**Step 3: Write minimal implementation**

Implement:
- `LightweightSuperTrendSignal`;
- `LightweightSuperTrendSeries`;
- `buildLightweightSuperTrendSeries`.

The helper should normalize valid OHLC bars, compute TR, compute Wilder ATR, apply the standard trailing upper/lower SuperTrend bands, and emit Buy/Sell when trend changes.

**Step 4: Run test to verify it passes**

Run: `npm run test`

Expected: helper tests pass.

### Task 2: Chart Rendering

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingViewKlineChart.tsx`

**Step 1: Add props**

Add `showSuperTrend`, `superTrendAtrPeriod`, and `superTrendMultiplier`.

**Step 2: Render lines**

Use `buildLightweightSuperTrendSeries` in the chart memo. Render bullish line in green and bearish line in red with no last-value label.

**Step 3: Render markers**

Merge SuperTrend Buy/Sell markers with existing signal and event markers, keeping signal-click behavior unchanged.

### Task 3: Workbench Controls

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`

**Step 1: Add persisted preference and params**

Add `supertrend` to chart preferences and add `superTrendAtrPeriod` / `superTrendMultiplier` to chart parameters.

**Step 2: Update presets and summaries**

Include ST in main overlays, enable it by default, and keep existing presets coherent.

**Step 3: Add UI controls**

Add an `ST` main-chart toggle and two parameter inputs.

**Step 4: Pass props**

Pass the toggle and parameters into `TradingViewKlineChart`.

### Task 4: Verification

**Files:**
- Existing frontend app

**Step 1:** Run `npm run test`.

**Step 2:** Run `npm run build`.

**Step 3:** Inspect `git diff --stat` and relevant diff chunks to ensure changes are scoped.
