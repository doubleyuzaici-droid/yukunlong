# Professional Research Workbench P0 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 给个股工作台补齐专业投研 P0 中尚缺的“盈利质量/现金流”和“筹码集中度”分析能力，并接入基本面 Tab。

**Architecture:** 后端复用现有 `financial_statement`、`fundamental_snapshot`、`security_master` 与新增的 `holding_concentration` 表。外部数据源仍走可选 `akshare_events`，不可用时返回 partial/empty，不阻塞工作台。前端在 `useSymbolFundamentals` 中并行拉取两个新接口，经过 mapper 转成稳定 UI 数据，再在 Tab 3 增加两个紧凑投研面板。

**Tech Stack:** FastAPI + SQLite + pytest；React 18 + TypeScript + Vite；现有 akshare 可选依赖。

---

### Task 1: 后端盈利质量接口

**Files:**
- Modify: `TradingAgents/tests/test_professional_routes.py`
- Modify: `TradingAgents/tradingagents/api/professional_routes.py`

**Step 1: Write the failing test**

Add a test that seeds `financial_statement` rows for income, balance, and cashflow, then calls:

```bash
GET /api/professional/quality-metrics?symbol=600519.SH&date=2026-05-10
```

Expected payload:
- `gross_margin`, `net_margin`, `ocf_to_net_income`, `free_cashflow`, `debt_to_assets`, `roe`
- `quality_score` in `0..1`
- `flags` includes positive operating cash flow quality when OCF exceeds net income

**Step 2: Run test to verify it fails**

Run: `cd TradingAgents && python -m pytest tests/test_professional_routes.py::test_quality_metrics_route_derives_cashflow_and_margin_ratios -q`

Expected: FAIL because `/quality-metrics` does not exist.

**Step 3: Write minimal implementation**

Add helper functions in `professional_routes.py`:
- parse latest statement metrics from `_financial_reports_payload`
- use `_finite_number` and `_number_from_payload`
- derive margins and leverage without inventing missing values
- return `null` for unavailable metrics

Add route:

```python
@router.get("/quality-metrics", response_model=ApiResponse)
async def get_quality_metrics(symbol: str, date: str | None = None): ...
```

**Step 4: Run test to verify it passes**

Run the same targeted pytest command.

Expected: PASS.

### Task 2: 后端筹码集中度表、同步与读取接口

**Files:**
- Modify: `TradingAgents/tradingagents/research/db.py`
- Modify: `TradingAgents/tradingagents/dataflows/akshare_events.py`
- Modify: `TradingAgents/tradingagents/api/professional_routes.py`
- Modify: `TradingAgents/tests/test_professional_routes.py`

**Step 1: Write the failing test**

Add a test that inserts one `holding_concentration` row and calls:

```bash
GET /api/professional/holding-concentration?symbol=600519.SH&date=2026-05-10
```

Expected payload:
- `northbound_float_pct`
- `fund_float_pct`
- `shareholder_count`
- `shareholder_count_delta_pct`
- `concentration_score`
- `items` with labels and tones

**Step 2: Run test to verify it fails**

Run: `cd TradingAgents && python -m pytest tests/test_professional_routes.py::test_holding_concentration_route_returns_latest_structure -q`

Expected: FAIL because table/route do not exist.

**Step 3: Write minimal implementation**

In `db.py`:
- create `holding_concentration`
- add migration columns if needed

In `akshare_events.py`:
- add `fetch_holding_concentration(symbol, end)` returning a normalized dict
- use broad column picking for AKShare field drift
- return empty dict when unavailable

In `professional_routes.py`:
- add `POST /holding-concentration/sync`
- add `GET /holding-concentration`
- empty state returns `available=false`, not 500

**Step 4: Run test to verify it passes**

Run the same targeted pytest command.

Expected: PASS.

### Task 3: 前端数据契约与 mapper

**Files:**
- Modify: `TradingAgents/frontend/src/types/symbol-workspace.ts`
- Modify: `TradingAgents/frontend/src/api/symbol-workspace/fetchers.ts`
- Modify: `TradingAgents/frontend/src/api/symbol-workspace/mappers.ts`
- Modify: `TradingAgents/frontend/src/api/symbol-workspace/mappers.test.ts`

**Step 1: Write failing mapper tests**

Add tests for:
- `mapQualityMetrics` maps null-safe ratios and flags
- `mapHoldingConcentration` maps latest holding metrics and items

**Step 2: Run test to verify it fails**

Run: `cd TradingAgents/frontend && npm test`

Expected: FAIL because mapper exports/types do not exist.

**Step 3: Write minimal implementation**

Add types:
- `QualityMetric`
- `QualityMetricsModel`
- `HoldingConcentrationModel`

Add fetchers:
- `fetchQualityMetrics`
- `fetchHoldingConcentration`

Add mappers:
- `mapQualityMetrics`
- `mapHoldingConcentration`

**Step 4: Run frontend test to verify it passes**

Run: `cd TradingAgents/frontend && npm test`

Expected: PASS.

### Task 4: 前端 Tab 3 面板接入

**Files:**
- Modify: `TradingAgents/frontend/src/api/symbol-workspace/hooks.ts`
- Modify: `TradingAgents/frontend/src/pages/symbol/fundamentals/FundamentalsTab.tsx`
- Modify: `TradingAgents/frontend/src/pages/symbol/workspace.css`

**Step 1: Extend hook payload**

Fetch quality and holding endpoints inside `useSymbolFundamentals`, map them, and mark partial keys when missing.

**Step 2: Add UI panels**

Add:
- `QualityPanel` after valuation/financial panels
- `HoldingPanel` near institutional/northbound panel

Panels must show compact metrics, partial empty states, and no explanatory marketing copy.

**Step 3: Run frontend verification**

Run: `cd TradingAgents/frontend && npm test`

Expected: PASS.

### Task 5: Full verification and diff review

**Files:**
- Review all changed files with `git diff --stat` and focused diff.

**Step 1: Backend targeted tests**

Run:

```bash
cd TradingAgents && python -m pytest tests/test_professional_routes.py -q
```

**Step 2: Frontend tests/build**

Run:

```bash
cd TradingAgents/frontend && npm test
cd TradingAgents/frontend && npm run build
```

**Step 3: Review diff**

Run:

```bash
git diff --stat
git diff -- TradingAgents/tradingagents/api/professional_routes.py TradingAgents/tradingagents/research/db.py TradingAgents/frontend/src/pages/symbol/fundamentals/FundamentalsTab.tsx
```

**Step 4: Final summary**

Summarize changed files, verification output, assumptions, and remaining P1 follow-ups in Chinese.
