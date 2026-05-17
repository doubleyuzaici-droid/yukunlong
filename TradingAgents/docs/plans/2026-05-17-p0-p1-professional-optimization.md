# P0/P1 Professional Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Finish the remaining P0/P1 professional usability gaps so data trust, tradable proxy mapping, signal explainability, trading plans, and review/backtest context are visible and verifiable.

**Architecture:** Keep the existing FastAPI + React architecture. Add small backend payloads that reuse existing local research tables, then surface them in the decision brief and symbol signal detail without introducing new external dependencies.

**Tech Stack:** FastAPI, SQLite research repository, pytest, React/TypeScript, Vite.

---

### Task 1: Tradable Proxy Layer

**Files:**
- Modify: `tradingagents/api/professional_routes.py`
- Test: `tests/test_professional_routes.py`

**Steps:**
1. Write failing tests for `/api/professional/trade-proxy` on `HSI`, `000016.SH`, and `00700.HK`.
2. Implement a deterministic proxy catalog for supported indexes and an equity passthrough payload.
3. Include the proxy status in investment governance so indexed targets are no longer reported as unmapped when a default proxy exists.
4. Run targeted tests.

### Task 2: Unified Signal Explain Payload

**Files:**
- Modify: `tradingagents/api/professional_routes.py`
- Test: `tests/test_professional_routes.py`

**Steps:**
1. Write a failing test for `/api/professional/signal-explain`.
2. Build a payload containing evidence, risks, invalidation rules, review status, event attribution, trading plan, data trust, and proxy mapping.
3. Keep unavailable data explicit instead of fabricating values.
4. Run targeted tests.

### Task 3: Frontend P0/P1 Visibility

**Files:**
- Modify: `frontend/src/pages/ResearchBriefPage.tsx`
- Modify: `frontend/src/pages/SymbolWorkspacePage.tsx`
- Modify: `frontend/src/index.css`

**Steps:**
1. Add TypeScript models and fetch calls for proxy/explain endpoints.
2. Show proxy mapping in the decision brief and selected-signal detail.
3. Show unified signal explanation with evidence, risk gate, review status, attribution, and trading plan.
4. Run `npm run build`.

### Task 4: Real Symbol Acceptance

**Steps:**
1. Run Tencent `00700.HK`, Hang Seng `HSI`, and `000016.SH` through quote, intraday, governance, signal explain, trading plan, and backtest endpoints.
2. Fix any regressions with focused tests first.
3. Run full pytest and frontend build.
