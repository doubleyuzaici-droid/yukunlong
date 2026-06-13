# One-Click Research Pipeline Design

**Goal:** Make the 自选股池、今日信号、每日复盘 pages work as one complete A/H stock research workflow instead of three isolated empty-looking panels.

**Decision:** Implement the "一键流水线" option first. A single user action should sync watchlist data, compute research factors, scan signals, and make the daily review meaningful.

---

## Current Problem

The current pages are wired to backend APIs, but the product flow is incomplete:

- 自选股池 can add and remove symbols, but it does not show whether each symbol has enough local market data.
- 今日信号 scans only existing local rows in `daily_bars`; it does not sync data first.
- 每日复盘 reads `signal_log`; when no signals exist, it renders a mostly empty report.
- The current local database has only a few trading days of bars for the watchlist, while several detectors need 20, 60, or 120 trading days.
- Data sync failures are logged to `data_quality_log`, but the UI does not explain them when the user sees no signal.

This makes the features look unavailable even though the backend pieces exist.

## User Workflow

Target workflow:

1. User adds symbols in 自选股池.
2. User clicks 同步并扫描.
3. The system fetches daily bars for the watchlist.
4. The system optionally fetches fund-flow data.
5. The system computes factor rows.
6. The system scans rule-based signals for the selected date.
7. 今日信号 shows grouped signal results or an explicit empty-state reason.
8. 每日复盘 generates a report from the same pipeline result and data quality state.

## Product Behavior

### 自选股池

Show the watchlist plus data readiness:

- Latest available bar date.
- Number of local daily bars.
- Whether the symbol has enough rows for common scan rules.
- Last signal date and count, when available.

Add actions:

- 同步数据: sync bars only.
- 同步并扫描: run the full pipeline.

### 今日信号

Replace the bare "扫描" experience with:

- 仅扫描已有数据.
- 同步并扫描.
- A summary strip with synced rows, factor rows, signal count, failed symbols, and warnings.
- Empty states that distinguish:
  - No watchlist.
  - Data unavailable.
  - Data insufficient.
  - Scan completed but no rule fired.

### 每日复盘

Keep the existing Generate and Download actions, but add:

- A "同步并生成" action that runs the pipeline before rendering the report.
- A summary above the Markdown panel.
- If no signal exists, explain why using pipeline status and data quality information.

## Backend Design

Add a research pipeline API layer under `/api/research`.

Endpoints:

- `GET /api/research/status`
  - Returns watchlist readiness and recent pipeline state.
- `POST /api/research/sync-bars`
  - Syncs daily bars only.
- `POST /api/research/pipeline/run`
  - Runs bars sync, optional fund-flow sync, factor computation, signal scan, and signal persistence.

Request:

```json
{
  "start": "2025-01-01",
  "end": "2026-05-12",
  "signal_date": "2026-05-12",
  "source": "akshare",
  "include_fund_flow": true
}
```

Response:

```json
{
  "success": true,
  "data": {
    "start": "2025-01-01",
    "end": "2026-05-12",
    "signal_date": "2026-05-12",
    "rows_synced": 720,
    "fund_flow_rows": 300,
    "factor_rows": 720,
    "signal_count": 5,
    "watchlist_count": 3,
    "warnings": [],
    "symbols": [
      {
        "symbol": "00700.HK",
        "market": "HONGKONG",
        "bar_count": 240,
        "latest_bar_date": "2026-05-12",
        "scan_readiness": "ready",
        "readiness_reason": "ready"
      }
    ]
  }
}
```

## Data Readiness Rules

Use explicit readiness labels:

- `no_data`: zero daily bars.
- `insufficient_20`: fewer than 20 bars.
- `insufficient_60`: 20-59 bars.
- `partial`: 60-119 bars.
- `ready`: 120 or more bars.

The first release should not block scanning on `partial`, because some detectors can still run. It should explain which rules may be unavailable.

## Error Handling

The pipeline must not fail the whole request because one symbol fails to sync.

For each failed symbol:

- Log to `data_quality_log`.
- Return a warning in the API response.
- Keep processing other symbols.

If all symbols fail or there is no watchlist, return `success=true` with zero counts and a user-readable warning. Reserve `success=false` for request validation errors or unexpected server failures.

## Testing Strategy

Backend tests:

- Pipeline route returns a structured result.
- Status route returns readiness for watchlist symbols.
- Sync failures become warnings, not full request failures.
- Pipeline persists generated signals.

Frontend tests are not currently configured. Use build verification and manual browser checks:

- `npm run build`
- Open the Vite app.
- Add a symbol.
- Run 同步并扫描.
- Confirm summary and empty-state messaging render.

## Definition of Done

- A user can run the full research pipeline from the UI with one click.
- Empty results explain why they are empty.
- Daily review can be generated after a pipeline run.
- Existing route tests still pass.
- Frontend production build succeeds.
