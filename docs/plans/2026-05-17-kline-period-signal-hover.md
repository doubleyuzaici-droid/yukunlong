# Kline Period Signal Hover Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 让 V2 策略信号 K 线模块显式支持日线、周线、月线查看，并把买卖点文字改为鼠标悬停展示。

**Architecture:** 保持后端 V2 策略算法不变，继续使用“周线趋势 + 日线执行”的策略口径。前端在 `TradingSignalKlinePanel` 中强化周期切换可见性，复用现有日线聚合为周线/月线的逻辑，并调整信号 marker 渲染为默认只显示点位/箭头，hover 或选中时展示结构化提示。

**Tech Stack:** React 18, TypeScript, SVG K 线图, Vite build, existing CSS tokens.

---

### Task 1: Make Period Selection Obvious

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Inspect existing period controls**

Confirm `CANDLE_PERIODS` already provides `daily`, `weekly`, and `monthly`, and both `PriceHistoryChart` and `TradingSignalKlinePanel` use `preparePeriodChartData`.

**Step 2: Update trading K-line title controls**

In `TradingSignalKlinePanel`, add an explicit label such as `周期` before the day/week/month segmented control and make the control visually distinct from range controls.

**Step 3: Add CSS for labeled segmented controls**

Add compact CSS so the period selector is visible in the dense strategy workbench header without introducing a new design system.

**Step 4: Verify by build**

Run: `npm run build` in `TradingAgents/frontend`.

Expected: TypeScript and Vite build pass.

### Task 2: Hide Signal Text Until Hover

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Keep marker geometry but remove always-visible label text**

In `TradingSignalKlinePanel`, keep buy/sell arrow and dot markers on the chart, but render the label background/text only for active or hovered markers.

**Step 2: Add a structured hover tooltip**

Render a small SVG tooltip near the marker when active/hovered. Include original trigger date, mapped period date, signal name, direction, score, entry price, 20-day return, and max adverse return when available.

**Step 3: Preserve selection behavior**

Clicking a marker should still call `onSelectSignal`, update the inspector, and keep the selected marker highlighted.

**Step 4: Verify by build**

Run: `npm run build` in `TradingAgents/frontend`.

Expected: TypeScript and Vite build pass.

### Task 3: Clarify V2 Timeframe Semantics

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`

**Step 1: Update copy in the strategy trace and controls**

Replace ambiguous strategy period copy with `周线趋势 + 日线执行`, making it clear that chart period selection is a visualization layer.

**Step 2: Avoid backend changes**

Do not add `timeframe=daily|weekly|monthly` to the backend in this task. True weekly/monthly strategies require separate resampling, thresholds, risk sizing, and backtests.

**Step 3: Verify by build**

Run: `npm run build` in `TradingAgents/frontend`.

Expected: TypeScript and Vite build pass.

### Task 4: Final Verification

**Files:**
- Existing local app at `TradingAgents/frontend`

**Step 1: Run build**

Run: `npm run build`

Expected: exit code 0.

**Step 2: Review diff**

Run: `git diff -- TradingAgents/frontend/src/components/MarketWidgets.tsx TradingAgents/frontend/src/index.css docs/plans/2026-05-17-kline-period-signal-hover.md`

Expected: diff only contains planned frontend and plan-file changes.
