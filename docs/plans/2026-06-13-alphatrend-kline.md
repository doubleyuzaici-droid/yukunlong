# AlphaTrend K 线主图接入 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在个股工作台 K 线主图加入可开关、可调参的 AlphaTrend 指标，包含双线、趋势填充和 BUY/SELL 信号。

**Architecture:** 在前端纯 helper 中根据现有 OHLCV bars 计算 AlphaTrend，不新增后端接口。`TradingSignalKlinePanel` 负责偏好和参数，`TradingViewKlineChart` 负责绘制 AlphaTrend line series、baseline fill 和信号 marker。旧 SVG 图层保持原样，避免扩大当前 Lightweight Charts 迁移的风险。

**Tech Stack:** React 18, TypeScript, Vite, lightweight-charts, existing `TradingSignalKline.helpers.ts` tests.

---

### Task 1: AlphaTrend Helper 测试

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`

**Step 1: Write the failing test**

Add tests that call `buildAlphaTrendSeries` with deterministic OHLCV bars and assert:

- output length follows valid source bars
- first emitted AlphaTrend value appears only after enough ATR and MFI/RSI data
- missing or zero volume triggers RSI fallback
- BUY/SELL signals appear when AlphaTrend crosses its 2-bar lag

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents/frontend
npm run test
```

Expected: FAIL because `buildAlphaTrendSeries` is not exported.

**Step 3: Write minimal implementation**

Implement exported types and `buildAlphaTrendSeries` in `TradingSignalKline.helpers.ts`:

- sanitize valid OHLC bars
- compute true range and SMA ATR
- compute RSI and MFI snapshots without future data
- recursively calculate AlphaTrend
- emit current line, lag-2 line, trend tone, and BUY/SELL signal markers

**Step 4: Run test to verify it passes**

Run:

```bash
cd TradingAgents/frontend
npm run test
```

Expected: PASS.

### Task 2: Lightweight Charts AlphaTrend 渲染

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingViewKlineChart.tsx`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`

**Step 1: Write the failing test**

Add a helper-level test that verifies `buildLightweightAlphaTrendSeries` converts AlphaTrend points into:

- current line data
- lag line data
- baseline fill segments or area-compatible bands
- BUY/SELL marker-like payloads with stable ids and dates

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents/frontend
npm run test
```

Expected: FAIL because the lightweight adapter does not exist.

**Step 3: Write minimal implementation**

Implement `buildLightweightAlphaTrendSeries` and render it in `TradingViewKlineChart` when `showAlphaTrend` is true:

- draw current line in blue
- draw lag line in red
- use `BaselineSeries` for fill when supported by the installed lightweight-charts API
- add AlphaTrend BUY/SELL markers to the candle marker list

**Step 4: Run test to verify it passes**

Run:

```bash
cd TradingAgents/frontend
npm run test
```

Expected: PASS.

### Task 3: K 线工具栏与参数接入

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`

**Step 1: Write the failing test**

Update preset/summary tests to assert:

- `alphaTrend` is included in chart preference names
- full preset enables AlphaTrend
- layer summary lists `AT`
- parameter preset exposes `alphaTrendPeriod` and `alphaTrendMultiplier`

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents/frontend
npm run test
```

Expected: FAIL because preferences and parameters do not include AlphaTrend.

**Step 3: Write minimal implementation**

Wire AlphaTrend through:

- `TradingChartPreferences`
- `DEFAULT_TRADING_CHART_PREFS`
- `normalizeTradingChartPrefs`
- `ChartPreferenceName`
- `BASE_CHART_PRESET_VALUES`
- `CHART_LAYER_MAIN_OVERLAYS`
- `TradingChartParameters`
- `DEFAULT_TRADING_CHART_PARAMS`
- `normalizeTradingChartParams`
- `ChartParameterName`
- `STANDARD_CHART_PARAMETER_VALUES`
- toolbar button
- parameter inputs
- `TradingViewKlineChart` props

**Step 4: Run test to verify it passes**

Run:

```bash
cd TradingAgents/frontend
npm run test
```

Expected: PASS.

### Task 4: Build Verification

**Files:**
- Existing frontend app

**Step 1: Run full frontend tests**

Run:

```bash
cd TradingAgents/frontend
npm run test
```

Expected: PASS.

**Step 2: Run production build**

Run:

```bash
cd TradingAgents/frontend
npm run build
```

Expected: PASS.

**Step 3: Inspect diff**

Run:

```bash
git diff -- TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts TradingAgents/frontend/src/components/TradingViewKlineChart.tsx TradingAgents/frontend/src/components/MarketWidgets.tsx docs/plans/2026-06-13-alphatrend-kline-design.md docs/plans/2026-06-13-alphatrend-kline.md
```

Expected: Diff only includes AlphaTrend-related changes.
