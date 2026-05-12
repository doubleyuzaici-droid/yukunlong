# One-Click Research Pipeline Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a one-click A/H stock research pipeline that syncs watchlist data, computes factors, scans signals, and makes 今日信号/每日复盘 actionable.

**Architecture:** Reuse the existing research modules instead of introducing a new workflow engine. Add a thin orchestration service for pipeline status/readiness, expose it through FastAPI research routes, then wire the React pages to the new endpoints with clear progress and empty-state messaging.

**Tech Stack:** Python 3.12, FastAPI, pandas, SQLite, pytest, React 18, TypeScript, Vite.

---

## Task 1: Add Backend Pipeline Status Helpers

**Files:**
- Modify: `TradingAgents/tradingagents/research/repository.py`
- Create: `TradingAgents/tradingagents/research/pipeline_status.py`
- Test: `TradingAgents/tests/test_research_pipeline_status.py`

**Step 1: Write failing tests**

Create tests that seed watchlist symbols and daily bars, then assert readiness labels.

```python
def test_watchlist_status_marks_no_data_and_ready(tmp_path, monkeypatch):
    from tradingagents.research.repository import upsert_daily_bars, upsert_watchlist_symbols
    from tradingagents.research.pipeline_status import get_watchlist_status

    upsert_watchlist_symbols(["00700.HK", "01024.HK"])
    upsert_daily_bars([
        {
            "date": f"2026-01-{day:02d}",
            "symbol": "00700.HK",
            "market": "HONGKONG",
            "open": 1.0,
            "high": 1.0,
            "low": 1.0,
            "close": 1.0,
            "volume": 1000,
            "amount": 1000,
            "source": "test",
        }
        for day in range(1, 32)
    ])

    rows = get_watchlist_status()

    by_symbol = {row["symbol"]: row for row in rows}
    assert by_symbol["00700.HK"]["bar_count"] == 31
    assert by_symbol["00700.HK"]["scan_readiness"] == "insufficient_60"
    assert by_symbol["01024.HK"]["scan_readiness"] == "no_data"
```

Run:

```bash
PYTHONPATH=TradingAgents python -m pytest TradingAgents/tests/test_research_pipeline_status.py -q
```

Expected: fail because `pipeline_status.py` does not exist.

**Step 2: Implement helpers**

Add repository query helpers for bar counts/latest dates/signals, and a status service:

- `get_watchlist_data_status()`
- `get_watchlist_status()`
- `readiness_for_bar_count(count)`

Readiness thresholds:

- `0`: `no_data`
- `1-19`: `insufficient_20`
- `20-59`: `insufficient_60`
- `60-119`: `partial`
- `>=120`: `ready`

**Step 3: Run tests**

Run the new test file and fix until passing.

## Task 2: Add One-Click Pipeline API

**Files:**
- Modify: `TradingAgents/tradingagents/api/research_routes.py`
- Modify: `TradingAgents/tradingagents/research/pipeline.py`
- Test: `TradingAgents/tests/test_research_routes.py`

**Step 1: Write failing route tests**

Add tests for:

- `GET /api/research/status`
- `POST /api/research/pipeline/run`

Mock expensive functions:

- `sync_watchlist_bars`
- `sync_watchlist_fund_flows`
- `compute_watchlist_factors`
- `scan_watchlist`
- `persist_signals`

Expected response includes:

- `rows_synced`
- `factor_rows`
- `signal_count`
- `watchlist_status`
- `warnings`

**Step 2: Implement request schemas**

Add Pydantic models:

- `ResearchPipelineRequest`
- `SyncBarsRequest`

Defaults:

- `start`: 18 months before `end`
- `end`: today
- `signal_date`: `end`
- `source`: optional
- `include_fund_flow`: true

**Step 3: Implement routes**

Add:

- `GET /api/research/status`
- `POST /api/research/sync-bars`
- `POST /api/research/pipeline/run`

The full pipeline route should call `run_pipeline(...)` and include `get_watchlist_status()` in the response.

**Step 4: Run route tests**

```bash
PYTHONPATH=TradingAgents python -m pytest TradingAgents/tests/test_research_routes.py -q
```

Expected: pass.

## Task 3: Make Pipeline Robust for Partial Failures

**Files:**
- Modify: `TradingAgents/tradingagents/research/pipeline.py`
- Modify: `TradingAgents/tradingagents/research/data_sync.py` if needed
- Test: `TradingAgents/tests/test_research_pipeline.py`

**Step 1: Write failing tests**

Add a test proving one failed data source does not make the route unusable. The result should contain warnings and still return counts for completed steps.

**Step 2: Implement warning collection**

Keep the existing per-symbol quality logging in `data_sync.py`. In `run_pipeline`, capture recent quality issues for the run window and return them as warnings.

**Step 3: Run tests**

```bash
PYTHONPATH=TradingAgents python -m pytest TradingAgents/tests/test_research_pipeline.py TradingAgents/tests/test_research_routes.py -q
```

Expected: pass.

## Task 4: Wire Today Signals UI

**Files:**
- Modify: `TradingAgents/frontend/src/pages/TodaySignalsPage.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add TypeScript types**

Add:

- `PipelineSummary`
- `WatchlistStatusRow`

**Step 2: Add actions**

Add buttons:

- `仅扫描已有数据`
- `同步并扫描`

The one-click action posts to `/api/research/pipeline/run`.

**Step 3: Add summary and empty states**

Show:

- synced rows
- factor rows
- signal count
- readiness counts
- warnings

When all groups are empty, show a reason instead of only `暂无记录`.

**Step 4: Build frontend**

```bash
cd TradingAgents/frontend
npm run build
```

Expected: pass.

## Task 5: Wire Daily Review UI

**Files:**
- Modify: `TradingAgents/frontend/src/pages/DailyReportPage.tsx`
- Modify: `TradingAgents/frontend/src/index.css`

**Step 1: Add one-click generate action**

Add `同步并生成` button:

1. POST `/api/research/pipeline/run`.
2. GET `/api/reports/daily?date=...`.
3. Render Markdown and pipeline summary.

**Step 2: Improve empty report messaging**

When report has zero signals, show a short summary from pipeline status above the Markdown.

**Step 3: Build frontend**

```bash
cd TradingAgents/frontend
npm run build
```

Expected: pass.

## Task 6: Verify End-to-End

**Files:**
- Verify only.

**Step 1: Run backend tests**

```bash
PYTHONPATH=TradingAgents python -m pytest \
  TradingAgents/tests/test_research_routes.py \
  TradingAgents/tests/test_research_pipeline.py \
  TradingAgents/tests/test_research_pipeline_status.py \
  TradingAgents/tests/test_signal_routes.py \
  TradingAgents/tests/test_daily_report_routes.py \
  -q
```

Expected: pass.

**Step 2: Run frontend build**

```bash
cd TradingAgents/frontend
npm run build
```

Expected: pass.

**Step 3: Manual smoke check**

With backend and frontend running:

1. Open `http://localhost:5173/`.
2. Go to 今日信号.
3. Click 同步并扫描.
4. Confirm a summary appears.
5. Go to 每日复盘.
6. Click 同步并生成.
7. Confirm the report renders and explains empty results if no signal fires.

**Step 4: Commit**

```bash
git add TradingAgents/tradingagents TradingAgents/tests TradingAgents/frontend/src TradingAgents/docs/plans
git commit -m "feat: add one-click research pipeline"
```
