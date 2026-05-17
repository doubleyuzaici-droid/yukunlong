# V2 Decision Workbench Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rebuild the V2 strategy explanation area into a professional decision workbench that makes the final action, M1-M5 blocking reasons, risk controls, factor balance, and validation status easy to scan.

**Architecture:** Keep the V2 strategy API and K-line chart logic unchanged. Add small React rendering helpers inside `MarketWidgets.tsx` to derive display rows from the existing `StrategyKlineAnalysis`, then replace the current flat inspector/checklist/factor layout with a three-column decision workbench and lower professional panels. Update `index.css` with scoped styles and responsive single-column behavior.

**Tech Stack:** React 18, TypeScript, Vite, existing CSS variables and design tokens.

---

### Task 1: Add Display Model Helpers

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`

**Step 1: Inspect existing V2 payload usage**

Confirm current fields used by:
- `StrategyKlineTrace`
- `StrategyExecutionChecklist`
- `StrategyFactorWorkbench`
- `buildStrategyTradeDecision`
- formatter helpers such as `formatNumber`, `formatPercent`, `formatCompactNumber`

Expected: no API or type changes are needed.

**Step 2: Add local display types**

Add small local types near the current V2 helper components:

```ts
type StrategyWorkbenchTone = "good" | "warn" | "bad" | "neutral";

interface StrategyDecisionStep {
  key: string;
  label: string;
  status: string;
  detail: string;
  tone: StrategyWorkbenchTone;
}

interface StrategySnapshotItem {
  label: string;
  value: string;
  detail?: string;
  tone?: StrategyWorkbenchTone;
}
```

Expected: these types are local UI presentation types only.

**Step 3: Add derivation helpers**

Create helpers that map `StrategyKlineAnalysis` and `technicalDecision` into display rows:

- `buildStrategyDecisionSteps(analysis)`
- `buildStrategySnapshotItems(analysis, activeIndicators)`
- `buildStrategyCriticalReasons(analysis, technicalDecision)`
- `buildStrategyFactorRows(analysis)`

Keep the helpers pure, null-safe, and formatter-based.

**Step 4: Run build**

Run:

```bash
cd TradingAgents/frontend
npm run build
```

Expected: TypeScript passes before replacing the UI.

### Task 2: Replace Top Inspector With Decision Workbench

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`

**Step 1: Create `StrategyDecisionWorkbench`**

Add a component rendered only when `strategyAnalysis` is present. It should show:

- Left: final decision, symbol/date/mode, critical reasons, S_buy/S_sell.
- Middle: M1-M5 vertical decision chain.
- Right: compact indicator and risk snapshot.

**Step 2: Keep non-V2 signal inspector fallback**

For non-V2 mode, preserve the existing generic signal inspector behavior so normal signal K-line usage does not regress.

**Step 3: Replace V2 branch in `TradingSignalKlinePanel`**

Change the rendering so:

```tsx
{strategyAnalysis ? (
  <StrategyDecisionWorkbench ... />
) : (
  <ExistingGenericSignalInspector ... />
)}
```

If extracting the generic block is too invasive, keep it inline and branch only around the V2-specific inspector.

**Step 4: Run build**

Run:

```bash
cd TradingAgents/frontend
npm run build
```

Expected: build passes and existing generic signal UI remains available.

### Task 3: Rework Lower Strategy Panels

**Files:**
- Modify: `TradingAgents/frontend/src/components/MarketWidgets.tsx`

**Step 1: Replace separate buy/sell score cards**

Update `StrategyFactorWorkbench` so buy and sell factors render as one comparison panel instead of two independent cards.

**Step 2: Split trade plan and verification cards**

Rename or replace:

- `StrategyPriceChannelCard` -> `StrategyTradePlanCard`
- `StrategyBacktestCard` -> `StrategyVerificationCard`

The trade plan should include price channels plus position sizing. The verification card should stay compact when no backtest exists.

**Step 3: Preserve data disclosure**

Keep `strategy-disclosure-card` behavior for blocking reasons, warnings, and disclaimer.

**Step 4: Run build**

Run:

```bash
cd TradingAgents/frontend
npm run build
```

Expected: build passes and no backend changes are required.

### Task 4: Add Scoped Trading-Desk Styles

**Files:**
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add scoped CSS classes**

Add styles for:

- `.strategy-decision-workbench`
- `.strategy-decision-primary`
- `.strategy-critical-list`
- `.strategy-decision-chain`
- `.strategy-chain-step`
- `.strategy-snapshot-panel`
- `.strategy-factor-comparison`
- `.strategy-trade-plan-card`
- `.strategy-verification-card`

Use existing color variables and 8px radius. Avoid broad global selectors.

**Step 2: Update responsive rules**

Add these classes to the existing mobile grid collapse block near the bottom of `index.css`.

Expected: desktop uses three columns; mobile stacks into one column.

**Step 3: Check long text behavior**

Ensure long Chinese explanations and numeric values use `overflow-wrap: anywhere` or constrained grid columns where needed.

**Step 4: Run diff check and build**

Run:

```bash
git diff --check
cd TradingAgents/frontend
npm run build
```

Expected: no whitespace errors; build passes.

### Task 5: Browser Smoke Test

**Files:**
- Verify local app only.

**Step 1: Start or reuse the Vite dev server**

Run:

```bash
cd TradingAgents/frontend
npm run dev
```

Expected: Vite serves a local URL, usually `http://127.0.0.1:5173/` or the next free port.

**Step 2: Open symbol workspace**

Open a symbol workspace URL with V2 strategy data, for example:

```text
http://127.0.0.1:5173/?view=symbol&symbol=01024.HK&date=2026-05-15
```

**Step 3: Verify visually**

Check:

- Main conclusion is visible without scanning multiple panels.
- M1-M5 chain shows the blocking path.
- Indicator and risk snapshot does not dominate the page.
- Factor comparison, trade plan, and verification panels fit below.
- No console errors.

**Step 4: Final review**

Run:

```bash
git diff -- TradingAgents/frontend/src/components/MarketWidgets.tsx TradingAgents/frontend/src/index.css docs/plans/2026-05-17-v2-decision-workbench-design.md docs/plans/2026-05-17-v2-decision-workbench.md
```

Expected: diff is limited to the approved V2 decision workbench docs and frontend UI changes.
