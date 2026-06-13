# Symbol Analysis Readiness Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a reusable analysis-readiness diagnostic layer so each symbol workspace can show what is complete, what is missing, and what action should happen next.

**Architecture:** Add a backend `/api/professional/analysis-readiness` endpoint that aggregates existing tables into normalized readiness categories. Then surface the payload in the symbol workspace as a compact completeness panel. The first implementation diagnoses gaps; later phases can attach sync actions.

**Tech Stack:** FastAPI, SQLite repository tables, pytest/TestClient, React, TypeScript, Vite.

---

### Task 1: Backend Readiness Route

**Files:**
- Modify: `TradingAgents/tests/test_professional_routes.py`
- Modify: `TradingAgents/tradingagents/api/professional_routes.py`

**Step 1: Write failing test**

Add a test that seeds `01024.HK` with daily bars, factors, and placeholder news, then calls `/api/professional/analysis-readiness`.

Expected assertions:
- response status is 200
- symbol is normalized to `01024.HK`
- `market_data` and `technical_factors` are `ready`
- `fundamentals`, `fund_flow`, `signals`, `agent_review`, and `attribution` are not `ready`
- placeholder news is `warn`
- next actions include syncing fundamentals and replacing placeholder news

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_professional_routes.py::test_professional_analysis_readiness_flags_hk_symbol_gaps -q
```

Expected: FAIL because the route does not exist.

**Step 3: Implement minimal backend route**

Add helpers in `professional_routes.py`:
- `_count_valid_news`
- `_readiness_category`
- `_analysis_level`
- `_build_analysis_readiness`

Add route:

```python
@router.get("/analysis-readiness", response_model=ApiResponse)
async def get_analysis_readiness(symbol: str, date: str | None = None):
    ...
```

**Step 4: Run test to verify it passes**

Run the same pytest command. Expected: PASS.

### Task 2: Frontend Readiness Panel

**Files:**
- Modify: `TradingAgents/frontend/src/pages/SymbolWorkspacePage.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add TypeScript types and state**

Define `AnalysisReadinessPayload`, add `readiness` state, and fetch `/api/professional/analysis-readiness` during workspace load.

**Step 2: Render compact panel**

Add `AnalysisReadinessPanel` near the top of the symbol workspace and show:
- score
- level
- ready/warn/blocker counts
- key gaps
- next actions

**Step 3: Build**

Run:

```bash
cd TradingAgents/frontend && npm run build
```

Expected: TypeScript and Vite build pass.

### Task 3: Browser Check

**Files:**
- No production code unless layout issues are found.

**Step 1: Start local frontend**

Run:

```bash
cd TradingAgents/frontend && npm run dev -- --host 127.0.0.1
```

**Step 2: Open symbol workspace**

Open:

```text
http://127.0.0.1:<port>/?view=symbolWorkspace&symbol=01024.HK
```

Verify the readiness panel is visible and does not overlap the existing workbench layout.

**Step 3: Stop only the dev server started for this check**

Leave unrelated existing Vite processes untouched.

### Task 4: Final Verification

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_professional_routes.py::test_professional_analysis_readiness_flags_hk_symbol_gaps -q
cd TradingAgents/frontend && npm run build
```

Report results, known risks, and next recommended phase.
