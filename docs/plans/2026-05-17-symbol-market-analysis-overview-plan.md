# Symbol Market Analysis Overview Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Futu-inspired research market-analysis default tab for the symbol workspace, with stronger K line and technical indicator discoverability.

**Architecture:** Reuse the existing React 18 + TypeScript + Vite frontend and existing market/context/strategy/readiness payloads. Add pure helper functions for deriving indicator status from loaded bars and context, then render a new `行情分析` tab inside `SymbolWorkspacePage` without changing backend strategy semantics.

**Tech Stack:** React 18, TypeScript, Vite, SVG-based existing chart components, existing FastAPI endpoints.

---

### Task 1: Document And Branch State

**Files:**
- Create: `docs/plans/2026-05-17-symbol-market-analysis-overview-design.md`
- Create: `docs/plans/2026-05-17-symbol-market-analysis-overview-plan.md`

**Step 1: Verify branch**

Run: `git status --short --branch`

Expected: branch is `codex/symbol-market-analysis-overview` and there are only the two plan documents after this task.

**Step 2: Commit documents**

Run:

```bash
git add docs/plans/2026-05-17-symbol-market-analysis-overview-design.md docs/plans/2026-05-17-symbol-market-analysis-overview-plan.md
git commit -m "docs: plan symbol market analysis overview"
```

Expected: a focused documentation commit.

### Task 2: Add Indicator Helper Tests

**Files:**
- Create: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.test.ts`
- Modify: `TradingAgents/frontend/package.json`
- Modify: `TradingAgents/frontend/tsconfig.json`
- Modify: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx`

**Step 1: Add a lightweight node test script**

Use Node's built-in test runner and TypeScript compiler output. Add scripts:

```json
"test": "tsc --project tsconfig.json --outDir .tmp/test-build --noEmit false && node --test .tmp/test-build/**/*.test.js"
```

**Step 2: Export pure helpers**

From `SymbolWorkspacePage.tsx`, export helpers such as:

```ts
export function buildMarketAnalysisOverview(...)
export function classifyIndicatorTone(...)
```

Keep them pure: no React hooks, no fetch, no DOM.

**Step 3: Write failing tests**

Create tests that assert:

- bullish MA alignment and positive MACD produce opportunity tone.
- high RSI or negative MACD creates warn/risk language.
- missing data produces `missing` tone and explicit next step.

Run: `cd TradingAgents/frontend && npm test`

Expected before implementation: test fails because helpers are missing or incomplete.

### Task 3: Implement Market Analysis Overview Data Model

**Files:**
- Modify: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx`

**Step 1: Implement minimal helper logic**

Use existing `history`, `context`, `signals`, `readiness`, and `strategyAnalysis` payloads to derive:

- market radar metrics
- technical indicator cards
- chart feature checklist
- data gap summary
- next-step recommendations

**Step 2: Run tests**

Run: `cd TradingAgents/frontend && npm test`

Expected: helper tests pass.

### Task 4: Render The Default `行情分析` Tab

**Files:**
- Modify: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add tab**

Change:

```ts
type SymbolWorkspaceTab = "overview" | "chart" | ...
```

Set default active tab to `overview`.

**Step 2: Add component**

Add `MarketAnalysisOverview` that renders:

- 行情雷达
- K线指标矩阵
- 指标图表组
- 策略与风险
- 证据闭环

Use compact, dense dashboard styling consistent with existing workbench UI.

**Step 3: Preserve chart tab**

Keep `TradingSignalKlinePanel` unchanged in `图表信号`, but add clear CTA from overview to switch into it.

### Task 5: Style And Responsive Layout

**Files:**
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add styles**

Add classes for:

- `.market-analysis-overview`
- `.analysis-radar-grid`
- `.indicator-matrix`
- `.indicator-card`
- `.overview-chart-card`
- `.overview-evidence-grid`

**Step 2: Check mobile breakpoints**

Reuse existing breakpoints near the bottom of `index.css`. Ensure cards do not overflow and text wraps cleanly.

### Task 6: Verification

**Files:**
- Modify as needed based on verification.

**Step 1: Run tests**

Run: `cd TradingAgents/frontend && npm test`

Expected: tests pass.

**Step 2: Run build**

Run: `cd TradingAgents/frontend && npm run build`

Expected: TypeScript and Vite build pass.

**Step 3: Inspect diff**

Run:

```bash
git status --short
git diff --stat
git diff -- TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx TradingAgents/frontend/src/index.css TradingAgents/frontend/package.json TradingAgents/frontend/tsconfig.json
```

Expected: diff is limited to the symbol workspace overview, tests, scripts, and docs.
