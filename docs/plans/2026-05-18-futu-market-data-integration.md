# Futu Market Data Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Futu OpenAPI as an optional full market data source for historical daily bars and realtime quotes while preserving existing fallbacks.

**Architecture:** Add a dedicated Futu adapter under `tradingagents.dataflows` to isolate SDK import, OpenD connection settings, symbol mapping, and DataFrame/quote mapping. Extend `research.data_sync` with `source=futu` for historical K-line sync, and extend `research.realtime_market` to use Futu snapshots when `TRADINGAGENTS_QUOTE_PROVIDER=futu`, falling back to local daily bars on failure.

**Tech Stack:** Python 3.12, FastAPI, pandas, optional `futu-api` SDK, existing SQLite-backed research repository, pytest, React/Vite frontend unchanged except existing source display.

---

### Task 1: Add Futu Adapter Tests

**Files:**
- Create: `TradingAgents/tests/test_futu_market_data.py`
- Create: `TradingAgents/tradingagents/dataflows/futu_market.py`

**Step 1: Write failing symbol conversion test**

Create `TradingAgents/tests/test_futu_market_data.py`:

```python
def test_to_futu_code_maps_project_symbols():
    from tradingagents.dataflows.futu_market import to_futu_code

    assert to_futu_code("01024.HK") == "HK.01024"
    assert to_futu_code("1024.hk") == "HK.01024"
    assert to_futu_code("600519.SH") == "SH.600519"
    assert to_futu_code("000001.SZ") == "SZ.000001"
    assert to_futu_code("AAPL") == "US.AAPL"
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_futu_market_data.py -q
```

Expected: fails because `tradingagents.dataflows.futu_market` does not exist.

**Step 3: Implement minimal adapter shell**

Create `TradingAgents/tradingagents/dataflows/futu_market.py` with:

```python
from __future__ import annotations

from tradingagents.markets import Market, detect_market, normalize_china_symbol, normalize_hk_symbol


class FutuMarketDataError(RuntimeError):
    pass


def to_futu_code(symbol: str) -> str:
    market = detect_market(symbol)
    if market == Market.HONGKONG:
        code = normalize_hk_symbol(symbol).split(".")[0]
        return f"HK.{code}"
    if market == Market.CHINA:
        code, exchange = normalize_china_symbol(symbol).split(".")
        return f"{exchange}.{code}"
    return f"US.{symbol.strip().upper()}"
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_futu_market_data.py -q
```

Expected: pass.

### Task 2: Map Futu Historical K-Line Data

**Files:**
- Modify: `TradingAgents/tests/test_futu_market_data.py`
- Modify: `TradingAgents/tradingagents/dataflows/futu_market.py`

**Step 1: Write failing historical mapping test**

Append:

```python
import pandas as pd


def test_fetch_daily_bars_maps_history_kline(monkeypatch):
    from tradingagents.dataflows import futu_market

    class FakeQuoteContext:
        def __init__(self, host, port):
            self.host = host
            self.port = port

        def request_history_kline(self, code, start=None, end=None, **kwargs):
            assert code == "HK.01024"
            assert start == "2026-05-01"
            assert end == "2026-05-12"
            return (
                futu_market.RET_OK,
                pd.DataFrame([{
                    "code": "HK.01024",
                    "time_key": "2026-05-12 00:00:00",
                    "open": 56.7,
                    "high": 57.4,
                    "low": 52.6,
                    "close": 52.6,
                    "volume": 151743764,
                    "turnover": 8288691208.0,
                }]),
                None,
            )

        def close(self):
            self.closed = True

    monkeypatch.setattr(futu_market, "_open_quote_context", lambda: FakeQuoteContext("127.0.0.1", 11111))

    frame = futu_market.get_stock_data_frame_futu("1024.hk", "2026-05-01", "2026-05-12")

    row = frame.iloc[0]
    assert row["date"] == "2026-05-12"
    assert row["symbol"] == "01024.HK"
    assert row["market"] == "HONGKONG"
    assert row["amount"] == 8288691208.0
    assert row["source"] == "futu_history_kline"
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_futu_market_data.py -q
```

Expected: fails because `get_stock_data_frame_futu` is missing.

**Step 3: Implement historical fetch and mapping**

In `futu_market.py`:

- Add optional SDK loader:

```python
def _load_futu_sdk():
    try:
        import futu
    except ImportError as exc:
        raise FutuMarketDataError("futu-api SDK is not installed; install with .[futu]") from exc
    return futu
```

- Add config and context:

```python
import os

RET_OK = 0


def _futu_host() -> str:
    return os.getenv("TRADINGAGENTS_FUTU_HOST", "127.0.0.1")


def _futu_port() -> int:
    return int(os.getenv("TRADINGAGENTS_FUTU_PORT", "11111"))


def _open_quote_context():
    futu = _load_futu_sdk()
    return futu.OpenQuoteContext(host=_futu_host(), port=_futu_port())
```

- Add `get_stock_data_frame_futu` that calls `request_history_kline`, checks `RET_OK`, maps rows to project columns, and always closes context in `finally`.

**Step 4: Run test to verify it passes**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_futu_market_data.py -q
```

Expected: pass.

### Task 3: Add `source=futu` To Research Sync

**Files:**
- Modify: `TradingAgents/tests/test_research_data_sync.py`
- Modify: `TradingAgents/tradingagents/research/data_sync.py`
- Modify: `TradingAgents/tradingagents/api/research_routes.py`
- Modify: `TradingAgents/pyproject.toml`

**Step 1: Write failing data source test**

Add to `TradingAgents/tests/test_research_data_sync.py`:

```python
def test_fetch_daily_bars_can_force_futu(monkeypatch):
    from tradingagents.research import data_sync

    calls = []

    def fake_futu(symbol, start, end):
        calls.append((symbol, start, end))
        return _frame("futu_history_kline")

    monkeypatch.setattr(data_sync, "get_stock_data_frame_futu", fake_futu)

    frame = data_sync.fetch_daily_bars(
        "01024.HK", "2026-05-01", "2026-05-12", source="futu"
    )

    assert calls == [("01024.HK", "2026-05-01", "2026-05-12")]
    assert frame.iloc[0]["source"] == "futu_history_kline"
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_research_data_sync.py::test_fetch_daily_bars_can_force_futu -q
```

Expected: fails because `futu` is unsupported.

**Step 3: Implement data sync support**

- Import `get_stock_data_frame_futu`.
- Extend `DATA_SOURCES` to `("akshare", "tushare", "futu", "auto")`.
- In `_fetch_daily_bars_from_source`, route `source == "futu"` to `get_stock_data_frame_futu`.
- Extend `SyncBarsRequest.source` regex to `^(akshare|tushare|futu|auto)$`.
- Add optional dependency:

```toml
futu = ["futu-api>=9.4.0"]
```

**Step 4: Run focused tests**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_research_data_sync.py tests/test_research_routes.py -q
```

Expected: pass.

### Task 4: Use Futu For Realtime Quotes When Configured

**Files:**
- Modify: `TradingAgents/tests/test_market_realtime_routes.py`
- Modify: `TradingAgents/tradingagents/research/realtime_market.py`
- Modify: `TradingAgents/tradingagents/dataflows/futu_market.py`

**Step 1: Write failing realtime provider test**

Add to `TradingAgents/tests/test_market_realtime_routes.py`:

```python
def test_realtime_quotes_use_futu_provider_when_configured(monkeypatch):
    from tradingagents.research import realtime_market
    from tradingagents.api.server import create_app

    realtime_market.clear_realtime_cache()
    monkeypatch.setenv("TRADINGAGENTS_QUOTE_PROVIDER", "futu")
    monkeypatch.setattr(
        realtime_market,
        "fetch_futu_snapshot",
        lambda symbol: {
            "symbol": "01024.HK",
            "market": "HONGKONG",
            "name": "快手-W",
            "trade_date": "2026-05-12",
            "trade_time": "16:00:00",
            "timestamp": "2026-05-12T16:00:00+08:00",
            "price": 52.6,
            "prev_close": 51.6,
            "change": 1.0,
            "change_pct": 0.0194,
            "open": 56.7,
            "high": 57.4,
            "low": 52.6,
            "volume": 151743764,
            "amount": 8288691208.0,
            "source": "futu_snapshot",
            "provider": "futu",
            "provider_status": "ok",
            "status": "live",
            "status_text": "富途实时行情快照",
            "is_realtime": True,
            "delay_policy": "富途 OpenAPI 行情，权限和延迟以 OpenD 登录账号为准",
            "refresh_interval_seconds": 12,
            "sparkline": [],
            "error": None,
        },
    )

    client = TestClient(create_app())
    response = client.get("/api/market/realtime/quotes?symbols=1024.hk")

    quote = response.json()["data"]["quotes"][0]
    assert quote["provider"] == "futu"
    assert quote["source"] == "futu_snapshot"
    assert quote["symbol"] == "01024.HK"
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_market_realtime_routes.py::test_realtime_quotes_use_futu_provider_when_configured -q
```

Expected: fails because realtime layer ignores `TRADINGAGENTS_QUOTE_PROVIDER`.

**Step 3: Implement realtime routing**

- In `futu_market.py`, add `fetch_futu_snapshot(symbol: str) -> dict`.
- In `realtime_market.py`, import `fetch_futu_snapshot`.
- Add provider resolver:

```python
def _quote_provider() -> str:
    return os.getenv("TRADINGAGENTS_QUOTE_PROVIDER", "tencent").strip().lower()
```

- In `fetch_realtime_quote`, if provider is `futu`, call `fetch_futu_snapshot`.
- Preserve existing cache and fallback behavior.

**Step 4: Run realtime tests**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_market_realtime_routes.py -q
```

Expected: pass.

### Task 5: Documentation And Source Health

**Files:**
- Modify: `TradingAgents/README.md`
- Modify: `TradingAgents/tradingagents/api/research_routes.py`
- Modify: `TradingAgents/tests/test_research_routes.py`

**Step 1: Add source metadata test**

Update `test_research_sources_and_direct_cli_job_routes` to assert:

```python
assert "futu" in source_payload["data"]["supported_sources"]
assert source_payload["data"]["source_catalog"]["futu"]["requires"] == "Futu OpenD"
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_research_routes.py::test_research_sources_and_direct_cli_job_routes -q
```

Expected: fails because metadata lacks `futu`.

**Step 3: Update metadata and README**

- Add `futu` to `DATA_SOURCES`.
- Add `source_catalog.futu` in `_research_sources_payload`.
- Document:
  - Start/login Futu OpenD first.
  - Install `uv pip install -e ".[futu]"`.
  - Use `TRADINGAGENTS_DATA_SOURCE=futu` for historical sync.
  - Use `TRADINGAGENTS_QUOTE_PROVIDER=futu` for realtime quote panel.

**Step 4: Run focused tests**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_research_routes.py tests/test_research_data_sync.py tests/test_market_realtime_routes.py -q
```

Expected: pass.

### Task 6: Final Verification

**Files:**
- All modified files from previous tasks.

**Step 1: Run Python tests**

Run:

```bash
cd TradingAgents && .venv/bin/python -m pytest tests/test_futu_market_data.py tests/test_research_data_sync.py tests/test_research_routes.py tests/test_market_realtime_routes.py -q
```

Expected: pass.

**Step 2: Run frontend tests**

Run:

```bash
cd TradingAgents/frontend && npm test
```

Expected: pass.

**Step 3: Run frontend build**

Run:

```bash
cd TradingAgents/frontend && npm run build
```

Expected: pass.

**Step 4: Inspect diff**

Run:

```bash
git status --short
git diff --stat
git diff -- TradingAgents/tradingagents/dataflows/futu_market.py TradingAgents/tradingagents/research/data_sync.py TradingAgents/tradingagents/research/realtime_market.py TradingAgents/tradingagents/api/research_routes.py TradingAgents/pyproject.toml TradingAgents/README.md TradingAgents/tests/test_futu_market_data.py TradingAgents/tests/test_research_data_sync.py TradingAgents/tests/test_research_routes.py TradingAgents/tests/test_market_realtime_routes.py docs/plans/2026-05-18-futu-market-data-integration-design.md docs/plans/2026-05-18-futu-market-data-integration.md
```

Expected: diff limited to Futu adapter, source routing, tests, docs, and existing uncommitted frontend fix.
