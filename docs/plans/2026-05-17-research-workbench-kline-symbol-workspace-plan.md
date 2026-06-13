# Research Workbench Kline Symbol Workspace Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 把现有 A/H 股投研工作台优化为以投研型 K 线和三栏个股工作台为核心的研究体验。

**Architecture:** 保持现有 React 18 + TypeScript + Vite 前端结构，优先复用 `MarketWidgets.tsx`、`SymbolWorkspacePage.tsx`、`FundamentalsPage.tsx`、`NewsEvidencePage.tsx`、`AgentReviewPage.tsx`、`SignalTimelinePage.tsx` 和现有 `/api/research`、`/api/professional`、`/api/signals` 路由。第一期不新增交易接口，不改变后端策略语义，只整合现有行情、信号、基本面、新闻、审查和历史表现数据。

**Tech Stack:** React 18, TypeScript, SVG K 线图, Vite, existing CSS tokens, existing FastAPI research/professional routes.

---

### Task 1: Audit Existing Kline and Symbol Workspace Surface

**Files:**
- Read: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Read: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx`
- Read: `TradingAgents/frontend/src/pages/FundamentalsPage.tsx`
- Read: `TradingAgents/frontend/src/pages/NewsEvidencePage.tsx`
- Read: `TradingAgents/frontend/src/pages/SignalTimelinePage.tsx`
- Read: `TradingAgents/frontend/src/pages/AgentReviewPage.tsx`
- Read: `TradingAgents/frontend/src/index.css`

**Step 1: Locate existing chart components**

Use `rg` to find `TradingSignalKlinePanel`, `PriceHistoryChart`, `CANDLE_PERIODS`, `preparePeriodChartData`, signal marker rendering, crosshair rendering, and quote helpers.

**Step 2: Locate existing symbol workspace composition**

Inspect how `SymbolWorkspacePage` currently loads symbol, date, history, strategy analysis, signals, fundamentals, news, and reviews.

**Step 3: Write an implementation note**

Add a short note to the implementation PR description or task log listing which components already support:

- daily/weekly/monthly aggregation
- signal hover
- selected signal inspector
- quote cards or context chips
- fundamentals/news/history navigation

**Step 4: Do not change code in this task**

Expected: no diff except task notes if the executor keeps a working log.

### Task 2: Strengthen Kline Toolbar and Crosshair

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add or refine toolbar grouping**

In the K line panel header, group controls into:

- `周期`: 日线、周线、月线
- `区间`: 1月、3月、6月、1年、3年
- `指标`: 成交量、MACD、RSI、相对强弱、信号评分

If a control already exists, preserve its state and behavior instead of duplicating it.

**Step 2: Make strategy timeframe semantics explicit**

Ensure the visible copy states:

```text
策略口径：周线趋势 + 日线执行；周期切换仅改变图表展示。
```

**Step 3: Strengthen crosshair payload**

When the user hovers over a candle, show:

- date
- open/high/low/close
- volume
- daily return when available
- active period label
- nearby signal count if available

**Step 4: Add focused CSS**

Use existing compact workbench styling. Keep the toolbar dense, stable, and readable at desktop widths.

**Step 5: Verify build**

Run:

```bash
npm run build
```

from `TradingAgents/frontend`.

Expected: TypeScript and Vite build pass.

### Task 3: Convert Signal Markers into Research Tooltips

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Keep marker geometry**

Retain current signal point, arrow, and selected-state geometry. Do not make signal labels always visible on the chart.

**Step 2: Render structured hover tooltip**

On hover or selected marker, show:

- original signal date
- mapped period date
- signal name
- direction
- score
- signal level
- entry price when available
- 20-day return when available
- max adverse return when available

**Step 3: Preserve selection behavior**

Clicking a marker must continue to update the active signal inspector and call the existing selection callback.

**Step 4: Add empty-state handling**

If a field is unavailable, display `-` instead of fabricating data.

**Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

### Task 4: Add Right-Side Symbol Context Panel

**Files:**
- Modify: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx`
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx` if shared cards are reused
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Define a compact context model in the page**

Without adding a new API in the first pass, derive context from already-loaded data where possible:

- symbol
- date
- latest price
- 20d/60d return
- current selected signal
- signal level and score
- data trust status
- latest review summary when available
- risk flags when available

**Step 2: Render a sticky right panel**

The right panel should remain visible while switching tabs inside the symbol workspace.

Panel sections:

- 行情摘要
- 当前信号
- 数据可信度
- Agent 审查
- 风险旗标
- 下一步

**Step 3: Keep disclaimers research-oriented**

Use research language such as `观察`, `审查`, `风险`, `历史表现`. Avoid transaction wording.

**Step 4: Add responsive fallback**

At narrower widths, stack the context panel below the chart instead of overlapping content.

**Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

### Task 5: Recompose Symbol Workspace into Tabs

**Files:**
- Modify: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx`
- Modify: `TradingAgents/frontend/src/pages/FundamentalsPage.tsx` if a compact embedded mode is needed
- Modify: `TradingAgents/frontend/src/pages/NewsEvidencePage.tsx` if a compact embedded mode is needed
- Modify: `TradingAgents/frontend/src/pages/SignalTimelinePage.tsx` if a compact embedded mode is needed
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add workspace tabs**

Tabs:

- 图表信号
- 基本面估值
- 新闻证据
- 信号审查
- 历史表现

Default tab: 图表信号.

**Step 2: Preserve deep-link context**

When `initialSymbol` or `initialEnd` changes, all tabs should use the same symbol/date context.

**Step 3: Embed or adapt existing pages**

Prefer extracting reusable inner panels from existing pages only if needed. Keep the first iteration small:

- Chart tab uses existing K line and signal inspector.
- Fundamentals tab may render current fundamentals summary or an embedded compact section.
- News tab may render current news evidence summary.
- Review tab may render latest review and link to full review workflow.
- History tab may render signal timeline/backtest summary.

**Step 4: Avoid duplicating fetch logic unnecessarily**

If existing pages already fetch their own data, pass `initialSymbol` and `initialEnd` into them. Extract shared hooks only if duplication becomes harmful.

**Step 5: Verify build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

### Task 6: Improve Market Entry Points into Symbol Workspace

**Files:**
- Modify: `TradingAgents/frontend/src/pages/MarketPulsePage.tsx`
- Modify: `TradingAgents/frontend/src/pages/MarketMatrixPage.tsx`
- Modify: `TradingAgents/frontend/src/pages/TodaySignalsPage.tsx`
- Modify: `TradingAgents/frontend/src/App.tsx` only if routing/context propagation needs adjustment

**Step 1: Confirm open symbol behavior**

All market, matrix, and signal list entries should call the existing `onOpenSymbol(symbol, date?)` path.

**Step 2: Add clear row/card affordance**

Rows or cards that open the symbol workspace should have consistent hover and selected styling.

**Step 3: Carry signal date when relevant**

From today's signal or historical signal entries, pass the signal date into `onOpenSymbol` where available.

**Step 4: Verify build**

Run:

```bash
npm run build
```

Expected: TypeScript and Vite build pass.

### Task 7: Add Focused Tests for Data Formatting and State Logic

**Files:**
- Modify or create frontend test utilities only if the project already has a frontend test setup.
- Otherwise document manual verification in the final PR notes.

**Step 1: Inspect test setup**

Check `TradingAgents/frontend/package.json` for test scripts. If no frontend test runner exists, do not introduce a new dependency in this task.

**Step 2: Prefer existing build verification**

If no frontend test framework exists, rely on:

```bash
npm run build
```

and manual browser verification.

**Step 3: Optional lightweight pure tests**

Only if an existing test setup is present, test pure helpers such as date mapping, period labels, and missing-value formatting.

Expected: no new dependency unless explicitly approved.

### Task 8: Browser Verification

**Files:**
- Existing local app at `TradingAgents/frontend`

**Step 1: Start local app**

Use the repository's existing start script if backend data is required. Otherwise run:

```bash
npm run dev
```

from `TradingAgents/frontend`.

**Step 2: Verify main flows**

Check:

- 投研首页 opens.
- 今日信号 can open 个股工作台.
- 个股工作台 shows three-column layout.
- K line toolbar shows 周期, 区间, 指标.
- Hovering candle shows crosshair details.
- Hovering signal marker shows structured tooltip.
- Clicking signal updates right-side context.
- Switching tabs preserves symbol/date.
- Narrow viewport does not overlap text or panels.

**Step 3: Capture issues**

Fix layout overlap, text clipping, or blank chart states before completion.

### Task 9: Final Verification and Diff Review

**Files:**
- Review all modified files.

**Step 1: Run production build**

Run:

```bash
npm run build
```

from `TradingAgents/frontend`.

Expected: exit code 0.

**Step 2: Review diff**

Run:

```bash
git diff -- TradingAgents/frontend/src/components/MarketWidgets.tsx TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx TradingAgents/frontend/src/pages/FundamentalsPage.tsx TradingAgents/frontend/src/pages/NewsEvidencePage.tsx TradingAgents/frontend/src/pages/SignalTimelinePage.tsx TradingAgents/frontend/src/pages/MarketPulsePage.tsx TradingAgents/frontend/src/pages/MarketMatrixPage.tsx TradingAgents/frontend/src/pages/TodaySignalsPage.tsx TradingAgents/frontend/src/App.tsx TradingAgents/frontend/src/index.css
```

Expected: diff only contains K line, symbol workspace, market entry, and styling changes required by this plan.

**Step 3: Summarize residual risks**

Final summary must include:

- changed files
- verification commands and results
- any skipped tests
- data-source limitations
- remaining UX follow-ups

**Step 4: Do not claim trading readiness**

The final response must state that the work remains research/simulation oriented and does not add real trading execution.
