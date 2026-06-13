# Tension Flow Trend K 线接入 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 在个股工作台 K 线主图加入可开关、可调参的 Tension Flow Trend 图层，并显示 Z-Score 张力和固定 RR 模拟统计。

**Architecture:** 前端纯 helper 根据当前 OHLC bars 计算 HMA、Z-Score、ATR ribbon、START 信号与 RR 统计；`TradingViewKlineChart` 渲染图层和 marker；`MarketWidgets` 管理偏好、参数、预设和摘要卡片。

**Tech Stack:** React 18, TypeScript, Vite, lightweight-charts, existing helper tests.

---

### Task 1: TFT Helper 测试和计算

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`

**Step 1: Write the failing test**

添加测试导入 `buildLightweightTensionFlowTrendSeries` 和 `buildTensionFlowTrendBacktestSummary`，断言：

- 无效 OHLC 被过滤。
- HMA/ribbon 在足够样本后生成。
- START 信号包含买入和卖出，并遵守冷却间隔。
- Z-Score 状态能区分 `strong` 和 `overextended`。
- RR 模拟统计包含 wins、losses、winRate 和展示卡片。

**Step 2: Run test to verify it fails**

Run: `cd TradingAgents/frontend && npm run test`

Expected: FAIL because TFT helpers are not exported.

**Step 3: Write minimal implementation**

实现 TFT 类型和函数：

- `buildTensionFlowTrendSeries`
- `buildLightweightTensionFlowTrendSeries`
- `buildTensionFlowTrendBacktestSummary`

计算包括 WMA/HMA、标准差 Z-Score、ATR ribbon、趋势启动信号、固定 RR TP/SL 命中统计。

**Step 4: Run test to verify it passes**

Run: `cd TradingAgents/frontend && npm run test`

Expected: PASS.

### Task 2: 图表渲染

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingViewKlineChart.tsx`

**Step 1:** 添加 TFT props 和 useMemo。

**Step 2:** 渲染 HMA 分段线、ribbon 上下边界和 START markers。

**Step 3:** 把 TFT hover readout 接入现有 tooltip。

### Task 3: 工作台控制和摘要

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`

**Step 1:** 增加 `tensionFlowTrend` 偏好和参数。

**Step 2:** 更新预设、图层摘要、工具栏按钮、参数面板。

**Step 3:** 在摘要区域渲染 TFT 张力和 RR 卡片。

**Step 4:** 将参数传入 `TradingViewKlineChart`。

### Task 4: Verification

**Files:**
- Existing frontend app

**Step 1:** Run `cd TradingAgents/frontend && npm run test`.

**Step 2:** Run `cd TradingAgents/frontend && npm run build`.

**Step 3:** Inspect `git diff --stat` and relevant diff chunks to confirm scope.
