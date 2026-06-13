# TradingView Lightweight Charts K 线替换实施计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 用 TradingView Lightweight Charts 替换个股工作台当前自研 SVG K 线主图，获得更接近富途的拖拽、滚轮缩放和时间轴交互体验。

**Architecture:** 保留现有 `/api/market/history`、分时数据、V2 策略、缠论分析和指标计算入口，替换 `TradingSignalKlinePanel` 内部的图表渲染层。新增一个轻量适配层把项目内 `MarketHistoryBar`、信号、事件和核心指标转换成 Lightweight Charts 的 candlestick、histogram、line、marker 数据。

**Tech Stack:** React 18, TypeScript, Vite, TradingView Lightweight Charts, existing market data APIs.

---

### Task 1: 数据适配测试

**Files:**
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.test.ts`
- Modify: `TradingAgents/frontend/src/components/TradingSignalKline.helpers.ts`

**Step 1:** 写失败测试，覆盖 `MarketHistoryBar` 到 Lightweight Charts 蜡烛与成交量序列的转换。

**Step 2:** 运行 `npm run test`，确认因函数未导出或行为缺失而失败。

**Step 3:** 实现最小 helper：过滤无效 OHLC，输出稳定时间字段、涨跌颜色、MA/BOLL 等核心线数据。

**Step 4:** 重新运行 `npm run test`，确认 helper 测试通过。

### Task 2: 引入图表库

**Files:**
- Modify: `TradingAgents/frontend/package.json`
- Modify: `TradingAgents/frontend/package-lock.json`

**Step 1:** 安装 `lightweight-charts`。

**Step 2:** 检查锁文件和 TypeScript 类型可用性。

### Task 3: 新建 TradingView K 线组件

**Files:**
- Create: `TradingAgents/frontend/src/components/TradingViewKlineChart.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1:** 创建 React 组件，初始化 `createChart`、candlestick、volume、MA/BOLL line series。

**Step 2:** 接入 `timeScale().fitContent()`、鼠标拖拽平移、滚轮缩放和 crosshair 订阅。

**Step 3:** 映射策略信号、技术信号和事件 marker，保持点击信号后能更新右侧解释面板。

**Step 4:** 增加容器样式、空态和悬浮读数样式。

### Task 4: 替换工作台图表渲染

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`

**Step 1:** 在 `TradingSignalKlinePanel` 中保留周期、区间、图层、策略解释、读数面板。

**Step 2:** 用 `TradingViewKlineChart` 替换 SVG 图表区域。

**Step 3:** 确保周期切换、区间切换、复权、信号选择、缠论/策略状态不被破坏。

### Task 5: 验证

**Files:**
- Existing frontend app

**Step 1:** 运行 `npm run test`。

**Step 2:** 运行 `npm run build`。

**Step 3:** 用浏览器打开个股工作台图表页，验证 K 线非空、可拖拽、可滚轮缩放、周期和区间按钮生效。

**Step 4:** 检查 diff，确认没有改动无关模块。
