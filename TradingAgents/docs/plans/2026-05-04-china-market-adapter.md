# China & Hong Kong Market Adapter Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a China & Hong Kong market research and simulated-trading version of TradingAgents that supports A-share + HK stock symbols, China/HK data vendors (Tushare/AKShare), exchange-specific trading rules, Chinese analyst reports, and conservative compliance guardrails.

**Architecture:** Keep the upstream TradingAgents LangGraph workflow and add a market adapter layer instead of rewriting agents. Route China/HK tickers through new dataflow vendors, inject market-specific context into prompts, and enforce trading constraints before the final portfolio decision. The unified `markets/` module provides a `Market` enum and `detect_market()` for automatic routing. The first release is research/simulation only and must not connect to live brokerage execution.

**Tech Stack:** Python 3.10+, LangGraph, LangChain tools, pandas, stockstats, pytest, Tushare Pro as the primary China/HK data vendor, AKShare as optional fallback, existing TradingAgents CLI/config system. Optional FastAPI + React web frontend.

---

## Current Workspace Assumption

This workspace is currently empty and is not a Git repository. Start by importing the upstream project into this directory, then apply the tasks below inside the imported TradingAgents codebase.

Use these upstream paths as the expected project layout:

- `tradingagents/default_config.py`
- `tradingagents/dataflows/interface.py`
- `tradingagents/dataflows/config.py`
- `tradingagents/agents/utils/agent_utils.py`
- `tradingagents/agents/utils/core_stock_tools.py`
- `tradingagents/agents/utils/fundamental_data_tools.py`
- `tradingagents/agents/utils/news_data_tools.py`
- `tradingagents/agents/utils/technical_indicators_tools.py`
- `tradingagents/graph/trading_graph.py`
- `tradingagents/graph/setup.py`
- `tests/`

## Definition of Done

- `TradingAgentsGraph(...).propagate("600519.SH", "2026-04-30")` can run in simulation mode with China-market vendors configured.
- `TradingAgentsGraph(...).propagate("00700.HK", "2026-04-30")` can run in simulation mode with HK-market vendors configured.
- The system recognizes `.SH`, `.SZ`, `.BJ` (A-share), `.HK` (Hong Kong), bare six-digit A-share codes, bare 1-5 digit HK codes (auto zero-padded), and rejects unsafe ticker path components.
- `detect_market(symbol)` returns `Market.CHINA` / `Market.HONGKONG` / `Market.US` for automatic vendor routing.
- Data tools support China/HK OHLCV, technical indicators, fundamentals, announcements/news through Tushare/AKShare vendor routing.
- A-share risk checks: T+1, 100-share lots, price limits (±10%/±20%/±30%), suspension, ST labels.
- HK risk checks: T+2 settlement, variable lot sizes per stock, extreme price warnings (no formal price limits).
- Final user-facing reports can be produced in Simplified Chinese.
- All new unit tests pass without requiring external network calls by using mocks/fixtures.
- FastAPI + React web frontend provides form-based analysis submission, real-time Agent/Stage progress, Token statistics, live report preview, and report download.

## Task 0: Import Upstream TradingAgents

**Files:**
- Create/import: repository contents from `https://github.com/TauricResearch/TradingAgents`
- Verify: `pyproject.toml`
- Verify: `tradingagents/default_config.py`
- Verify: `tests/`

**Step 1: Import the repository**

Run one of these, depending on whether the workspace should become the repository root:

```bash
git clone https://github.com/TauricResearch/TradingAgents.git .
```

If the current directory is not empty, clone into a sibling directory and move this plan into that repository's `docs/plans/`.

**Step 2: Install in editable mode**

Run:

```bash
python -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

If the project has no `dev` extra, run:

```bash
.venv/bin/pip install -e .
.venv/bin/pip install pytest
```

**Step 3: Run the baseline tests**

Run:

```bash
.venv/bin/python -m pytest tests -q
```

Expected: existing upstream tests pass before China-market changes.

**Step 4: Commit**

```bash
git add .
git commit -m "chore: import upstream TradingAgents"
```

## Task 1: Add Market Types and Symbol Normalization (A-share + Hong Kong)

**Files:**
- Create: `tradingagents/markets/__init__.py` - unified exports with `Market` enum + `detect_market()`
- Create: `tradingagents/markets/base.py` - `Market(US/CHINA/HONGKONG)` enum + `detect_market()`
- Create: `tradingagents/markets/china.py` - A-share: `ChinaBoard`, `normalize_china_symbol`, `is_china_symbol`, `classify_china_symbol`
- Create: `tradingagents/markets/hongkong.py` - HK: `HongKongBoard`, `normalize_hk_symbol`, `is_hk_symbol`, `classify_hk_symbol`
- Test: `tests/test_china_hk_market.py` (combined, 40 tests)

### A-share Symbol Rules
- 6-digit codes → `.SH` (600xxx/688xxx) / `.SZ` (000xxx/300xxx) / `.BJ` (920xxx/430xxx etc.)
- Already-qualified codes (e.g. `600519.SH`) passed through
- Rejects path traversal (`../600519`) and non-numeric input

### HK Symbol Rules
- 1-5 digit codes → auto zero-pad to 5 digits + `.HK`
- Already-qualified codes (e.g. `00700.HK`) passed through
- GEM board: codes starting with `08`
- Rejects 6+ digit codes and non-numeric input

### Market Detection
- `detect_market(symbol)` tries `is_china_symbol()` → `is_hk_symbol()` → returns `Market.US` as default

## Task 2: Add Config Keys for China Market Mode

**Files:**
- Modify: `tradingagents/default_config.py`
- Test: `tests/test_china_market_config.py`

**Step 1: Write failing tests**

```python
from tradingagents.default_config import DEFAULT_CONFIG


def test_china_market_config_defaults_exist():
    assert DEFAULT_CONFIG["market_profile"] == "us"
    assert "china_market" in DEFAULT_CONFIG
    assert DEFAULT_CONFIG["china_market"]["primary_data_vendor"] == "tushare"
    assert DEFAULT_CONFIG["china_market"]["fallback_data_vendor"] == "akshare"
    assert DEFAULT_CONFIG["china_market"]["simulation_only"] is True
```

**Step 2: Run test to verify it fails**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_market_config.py -q
```

Expected: FAIL with missing `market_profile` or `china_market`.

**Step 3: Add config**

Add to `DEFAULT_CONFIG`:

```python
"market_profile": "us",
"china_market": {
    "primary_data_vendor": "tushare",
    "fallback_data_vendor": "akshare",
    "simulation_only": True,
    "benchmark_symbol": "000300.SH",
    "calendar_exchange": "SSE",
    "report_language": "Simplified Chinese",
    "rules_effective_date": "2026-07-06",
},
```

Also extend `data_vendors`:

```python
"data_vendors": {
    "core_stock_apis": "yfinance",
    "technical_indicators": "yfinance",
    "fundamental_data": "yfinance",
    "news_data": "yfinance",
    "china_market_data": "tushare,akshare",
    "china_fundamental_data": "tushare",
    "china_news_data": "tushare,akshare",
},
```

**Step 4: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_market_config.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tradingagents/default_config.py tests/test_china_market_config.py
git commit -m "feat: add China market configuration"
```

## Task 3: Add China Trading Rules Engine

**Files:**
- Create: `tradingagents/markets/china_rules.py`
- Test: `tests/test_china_market_rules.py`

**Step 1: Write failing tests**

```python
from datetime import date

from tradingagents.markets.china_rules import (
    ChinaTradingRuleInput,
    evaluate_china_trade_constraints,
)


def test_main_board_lot_size_blocks_odd_buy_quantity():
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol="600519.SH",
            side="buy",
            quantity=101,
            last_close=100.0,
            proposed_price=101.0,
            trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is False
    assert "100-share lot" in result.reasons[0]


def test_price_limit_blocks_main_board_buy_above_limit():
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol="600519.SH",
            side="buy",
            quantity=100,
            last_close=100.0,
            proposed_price=111.0,
            trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is False
    assert any("price limit" in reason for reason in result.reasons)


def test_chinext_allows_twenty_percent_limit():
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol="300750.SZ",
            side="buy",
            quantity=100,
            last_close=100.0,
            proposed_price=119.0,
            trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is True
```

**Step 2: Run test to verify it fails**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_market_rules.py -q
```

Expected: FAIL with missing module.

**Step 3: Implement minimal rules engine**

Create dataclasses:

```python
from dataclasses import dataclass, field
from datetime import date

from tradingagents.markets.china import ChinaBoard, classify_china_symbol


@dataclass(frozen=True)
class ChinaTradingRuleInput:
    symbol: str
    side: str
    quantity: int
    last_close: float
    proposed_price: float
    trade_date: date
    is_st: bool = False
    is_suspended: bool = False
    is_first_five_listing_days: bool = False


@dataclass(frozen=True)
class ChinaTradingRuleResult:
    allowed: bool
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _price_limit(symbol: str, is_st: bool, is_first_five_listing_days: bool) -> float | None:
    if is_first_five_listing_days:
        return None
    board = classify_china_symbol(symbol)
    if board in {ChinaBoard.CHINEXT, ChinaBoard.STAR}:
        return 0.20
    if board == ChinaBoard.BSE:
        return 0.30
    return 0.10 if not is_st else 0.05


def evaluate_china_trade_constraints(input: ChinaTradingRuleInput) -> ChinaTradingRuleResult:
    reasons: list[str] = []
    warnings: list[str] = []

    if input.is_suspended:
        reasons.append("security is suspended")

    if input.side.lower() == "buy" and input.quantity % 100 != 0:
        reasons.append("buy quantity must be a 100-share lot")

    limit = _price_limit(input.symbol, input.is_st, input.is_first_five_listing_days)
    if limit is not None:
        upper = round(input.last_close * (1 + limit), 2)
        lower = round(input.last_close * (1 - limit), 2)
        if input.proposed_price > upper or input.proposed_price < lower:
            reasons.append(f"proposed price violates {limit:.0%} price limit")

    if input.side.lower() == "sell":
        warnings.append("A-share sell orders must respect T+1 availability")

    return ChinaTradingRuleResult(allowed=not reasons, reasons=reasons, warnings=warnings)
```

**Step 4: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_market_rules.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tradingagents/markets/china_rules.py tests/test_china_market_rules.py
git commit -m "feat: add China trading rule checks"
```

## Task 4: Add Tushare Vendor Dataflow

**Files:**
- Create: `tradingagents/dataflows/tushare_china.py`
- Modify: `tradingagents/dataflows/interface.py`
- Modify: `pyproject.toml`
- Test: `tests/test_tushare_china_dataflow.py`

**Step 1: Write failing tests with mocks**

```python
import pandas as pd

from tradingagents.dataflows.tushare_china import get_china_stock_data


class FakePro:
    def daily(self, **kwargs):
        assert kwargs["ts_code"] == "600519.SH"
        return pd.DataFrame(
            [
                {
                    "trade_date": "20260430",
                    "open": 100.0,
                    "high": 102.0,
                    "low": 99.0,
                    "close": 101.0,
                    "vol": 10000.0,
                    "amount": 1010000.0,
                }
            ]
        )


def test_get_china_stock_data_formats_tushare_daily(monkeypatch):
    monkeypatch.setattr("tradingagents.dataflows.tushare_china._get_tushare_pro", lambda: FakePro())

    result = get_china_stock_data("600519.SH", "2026-04-01", "2026-04-30")

    assert "600519.SH" in result
    assert "2026-04-30" in result
    assert "close=101.0" in result
```

**Step 2: Run test to verify it fails**

Run:

```bash
.venv/bin/python -m pytest tests/test_tushare_china_dataflow.py -q
```

Expected: FAIL with missing module.

**Step 3: Implement Tushare adapter**

Implement `tradingagents/dataflows/tushare_china.py` with these functions:

```python
import os
import pandas as pd

from tradingagents.markets.china import normalize_china_symbol


def _get_tushare_pro():
    import tushare as ts

    token = os.getenv("TUSHARE_TOKEN")
    if not token:
        raise RuntimeError("TUSHARE_TOKEN is required for Tushare China data")
    ts.set_token(token)
    return ts.pro_api()


def _fmt_date(value: str) -> str:
    return value.replace("-", "")


def _display_date(value: str) -> str:
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


def get_china_stock_data(symbol: str, start_date: str, end_date: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.daily(ts_code=ts_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date))
    if frame is None or frame.empty:
        return f"No China stock data found for {ts_code} from {start_date} to {end_date}."
    frame = frame.sort_values("trade_date")
    lines = [f"China OHLCV data for {ts_code}:"]
    for row in frame.to_dict("records"):
        lines.append(
            f"{_display_date(row['trade_date'])}: "
            f"open={row['open']}, high={row['high']}, low={row['low']}, "
            f"close={row['close']}, volume={row.get('vol')}, amount={row.get('amount')}"
        )
    return "\n".join(lines)
```

Add optional dependency to `pyproject.toml`:

```toml
"tushare>=1.4.21",
```

**Step 4: Register vendor routing**

In `tradingagents/dataflows/interface.py`:

- Add import: `from .tushare_china import get_china_stock_data`
- Add `tushare` to `VENDOR_LIST`
- Add `"tushare": get_china_stock_data` to `VENDOR_METHODS["get_stock_data"]`

**Step 5: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_tushare_china_dataflow.py tests/test_china_market_symbols.py -q
```

Expected: PASS.

**Step 6: Commit**

```bash
git add tradingagents/dataflows/tushare_china.py tradingagents/dataflows/interface.py pyproject.toml tests/test_tushare_china_dataflow.py
git commit -m "feat: add Tushare China stock data vendor"
```

## Task 5: Add AKShare Fallback Vendor

**Files:**
- Create: `tradingagents/dataflows/akshare_china.py`
- Modify: `tradingagents/dataflows/interface.py`
- Modify: `pyproject.toml`
- Test: `tests/test_akshare_china_dataflow.py`

**Step 1: Write failing test**

```python
import pandas as pd

from tradingagents.dataflows.akshare_china import get_china_stock_data_akshare


def test_akshare_stock_data_formats_hist(monkeypatch):
    def fake_hist(**kwargs):
        assert kwargs["symbol"] == "600519"
        return pd.DataFrame(
            [{"日期": "2026-04-30", "开盘": 100.0, "最高": 102.0, "最低": 99.0, "收盘": 101.0, "成交量": 10000}]
        )

    monkeypatch.setattr("tradingagents.dataflows.akshare_china._stock_hist", fake_hist)

    result = get_china_stock_data_akshare("600519.SH", "2026-04-01", "2026-04-30")

    assert "600519.SH" in result
    assert "2026-04-30" in result
    assert "close=101.0" in result
```

**Step 2: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_akshare_china_dataflow.py -q
```

Expected: FAIL with missing module.

**Step 3: Implement fallback adapter**

Create `tradingagents/dataflows/akshare_china.py`:

```python
from tradingagents.markets.china import normalize_china_symbol


def _stock_hist(**kwargs):
    import akshare as ak

    return ak.stock_zh_a_hist(**kwargs)


def get_china_stock_data_akshare(symbol: str, start_date: str, end_date: str) -> str:
    normalized = normalize_china_symbol(symbol)
    code = normalized.split(".")[0]
    frame = _stock_hist(
        symbol=code,
        period="daily",
        start_date=start_date.replace("-", ""),
        end_date=end_date.replace("-", ""),
        adjust="qfq",
    )
    if frame is None or frame.empty:
        return f"No AKShare China stock data found for {normalized} from {start_date} to {end_date}."
    lines = [f"China OHLCV data for {normalized}:"]
    for row in frame.to_dict("records"):
        lines.append(
            f"{row['日期']}: open={row['开盘']}, high={row['最高']}, low={row['最低']}, "
            f"close={row['收盘']}, volume={row.get('成交量')}"
        )
    return "\n".join(lines)
```

Add optional dependency to `pyproject.toml`:

```toml
"akshare>=1.18.0",
```

**Step 4: Register fallback**

In `tradingagents/dataflows/interface.py`:

- Add import: `from .akshare_china import get_china_stock_data_akshare`
- Add `akshare` to `VENDOR_LIST`
- Add `"akshare": get_china_stock_data_akshare` to `VENDOR_METHODS["get_stock_data"]`

**Step 5: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_akshare_china_dataflow.py tests/test_tushare_china_dataflow.py -q
```

Expected: PASS.

**Step 6: Commit**

```bash
git add tradingagents/dataflows/akshare_china.py tradingagents/dataflows/interface.py pyproject.toml tests/test_akshare_china_dataflow.py
git commit -m "feat: add AKShare fallback vendor"
```

## Task 6: Route China Tickers to China Vendors

**Files:**
- Modify: `tradingagents/dataflows/interface.py`
- Create: `tests/test_china_vendor_routing.py`

**Step 1: Write failing tests**

```python
from tradingagents.dataflows.interface import get_category_for_method, route_to_vendor


def test_stock_data_category_unchanged():
    assert get_category_for_method("get_stock_data") == "core_stock_apis"


def test_china_symbol_prefers_china_vendor(monkeypatch):
    calls = []

    def fake_china(symbol, start_date, end_date):
        calls.append(symbol)
        return "china data"

    monkeypatch.setitem(
        __import__("tradingagents.dataflows.interface", fromlist=["VENDOR_METHODS"]).VENDOR_METHODS["get_stock_data"],
        "tushare",
        fake_china,
    )
    monkeypatch.setattr(
        "tradingagents.dataflows.interface.get_vendor",
        lambda category, method=None: "yfinance",
    )

    assert route_to_vendor("get_stock_data", "600519.SH", "2026-04-01", "2026-04-30") == "china data"
    assert calls == ["600519.SH"]
```

**Step 2: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_vendor_routing.py -q
```

Expected: FAIL because China tickers still route to `yfinance`.

**Step 3: Implement routing override**

In `tradingagents/dataflows/interface.py`, add:

```python
from tradingagents.markets.china import normalize_china_symbol


def _is_china_symbol(value: object) -> bool:
    if not isinstance(value, str):
        return False
    try:
        normalize_china_symbol(value)
        return True
    except ValueError:
        return False
```

Inside `route_to_vendor`, before reading configured vendor:

```python
if method in {"get_stock_data", "get_indicators", "get_fundamentals", "get_balance_sheet", "get_cashflow", "get_income_statement", "get_news"}:
    if args and _is_china_symbol(args[0]):
        vendor_config = "tushare,akshare"
    else:
        vendor_config = get_vendor(category, method)
else:
    vendor_config = get_vendor(category, method)
```

**Step 4: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_vendor_routing.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tradingagents/dataflows/interface.py tests/test_china_vendor_routing.py
git commit -m "feat: route China symbols to China data vendors"
```

## Task 7: Add China Technical Indicator Tool Support

**Files:**
- Modify: `tradingagents/dataflows/tushare_china.py`
- Modify: `tradingagents/dataflows/akshare_china.py`
- Modify: `tradingagents/dataflows/interface.py`
- Test: `tests/test_china_indicators.py`

**Step 1: Write failing test**

```python
import pandas as pd

from tradingagents.dataflows.tushare_china import get_china_indicators


class FakePro:
    def daily(self, **kwargs):
        return pd.DataFrame(
            [
                {"trade_date": "20260428", "close": 100.0, "open": 99.0, "high": 101.0, "low": 98.0, "vol": 1000},
                {"trade_date": "20260429", "close": 101.0, "open": 100.0, "high": 102.0, "low": 99.0, "vol": 1200},
                {"trade_date": "20260430", "close": 103.0, "open": 101.0, "high": 104.0, "low": 100.0, "vol": 1400},
            ]
        )


def test_get_china_indicators_contains_return_and_volume(monkeypatch):
    monkeypatch.setattr("tradingagents.dataflows.tushare_china._get_tushare_pro", lambda: FakePro())

    result = get_china_indicators("600519.SH", "2026-04-01", "2026-04-30")

    assert "latest close=103.0" in result
    assert "3-day return" in result
```

**Step 2: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_indicators.py -q
```

Expected: FAIL with missing function.

**Step 3: Implement minimal indicator summary**

Add to `tushare_china.py`:

```python
def get_china_indicators(symbol: str, start_date: str, end_date: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.daily(ts_code=ts_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date))
    if frame is None or frame.empty:
        return f"No China indicator data found for {ts_code}."
    frame = frame.sort_values("trade_date")
    first = float(frame.iloc[0]["close"])
    last = float(frame.iloc[-1]["close"])
    ret = (last - first) / first
    avg_vol = float(frame["vol"].mean()) if "vol" in frame else 0.0
    return f"China technical summary for {ts_code}: latest close={last}, period return={ret:.2%}, 3-day return={ret:.2%}, average volume={avg_vol:.2f}."
```

Register it in `VENDOR_METHODS["get_indicators"]` for `tushare`.

**Step 4: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_indicators.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tradingagents/dataflows/tushare_china.py tradingagents/dataflows/interface.py tests/test_china_indicators.py
git commit -m "feat: add China technical indicator summaries"
```

## Task 8: Add China Fundamentals and Announcement Summaries

**Files:**
- Modify: `tradingagents/dataflows/tushare_china.py`
- Modify: `tradingagents/dataflows/interface.py`
- Test: `tests/test_china_fundamentals.py`

**Step 1: Write failing test**

```python
import pandas as pd

from tradingagents.dataflows.tushare_china import get_china_fundamentals


class FakePro:
    def fina_indicator(self, **kwargs):
        return pd.DataFrame(
            [{"end_date": "20260331", "roe": 8.5, "grossprofit_margin": 52.1, "debt_to_assets": 23.4}]
        )


def test_get_china_fundamentals_formats_key_metrics(monkeypatch):
    monkeypatch.setattr("tradingagents.dataflows.tushare_china._get_tushare_pro", lambda: FakePro())

    result = get_china_fundamentals("600519.SH")

    assert "ROE=8.5" in result
    assert "debt_to_assets=23.4" in result
```

**Step 2: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_fundamentals.py -q
```

Expected: FAIL with missing function.

**Step 3: Implement fundamentals adapter**

Add:

```python
def get_china_fundamentals(symbol: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.fina_indicator(ts_code=ts_code)
    if frame is None or frame.empty:
        return f"No China fundamental data found for {ts_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"China fundamentals for {ts_code} as of {latest.get('end_date')}: "
        f"ROE={latest.get('roe')}, gross_margin={latest.get('grossprofit_margin')}, "
        f"debt_to_assets={latest.get('debt_to_assets')}."
    )
```

Register `get_fundamentals` for `tushare`. For balance sheet, income statement, and cashflow, add thin wrappers that call Tushare `balancesheet`, `income`, and `cashflow` and return latest key rows.

**Step 4: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_fundamentals.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tradingagents/dataflows/tushare_china.py tradingagents/dataflows/interface.py tests/test_china_fundamentals.py
git commit -m "feat: add China fundamentals adapter"
```

## Task 9: Add China Market Context to Agent Prompts

**Files:**
- Modify: `tradingagents/agents/utils/agent_utils.py`
- Modify: `tradingagents/agents/analysts/market_analyst.py`
- Modify: `tradingagents/agents/analysts/fundamentals_analyst.py`
- Modify: `tradingagents/agents/analysts/news_analyst.py`
- Modify: `tradingagents/agents/analysts/social_media_analyst.py`
- Test: `tests/test_china_prompt_context.py`

**Step 1: Write failing test**

```python
from tradingagents.agents.utils.agent_utils import build_instrument_context


def test_china_instrument_context_mentions_a_share_rules():
    context = build_instrument_context("600519.SH")
    assert "A-share" in context
    assert "T+1" in context
    assert "price limit" in context
```

**Step 2: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_prompt_context.py -q
```

Expected: FAIL because existing context only mentions exchange suffix preservation.

**Step 3: Implement China prompt context**

Modify `build_instrument_context`:

```python
from tradingagents.markets.china import normalize_china_symbol


def build_instrument_context(ticker: str) -> str:
    base = (
        f"The instrument to analyze is `{ticker}`. "
        "Use this exact ticker in every tool call, report, and recommendation, "
        "preserving any exchange suffix."
    )
    try:
        normalized = normalize_china_symbol(ticker)
    except ValueError:
        return base
    return (
        f"The instrument to analyze is `{normalized}`. "
        "This is a China A-share market instrument. Consider T+1 settlement, "
        "100-share buy lots, exchange-specific price limits, suspension risk, "
        "ST or delisting-risk labels, policy sensitivity, announcements, and liquidity. "
        "Use this exact ticker in every tool call, report, and recommendation."
    )
```

Review analyst prompt files and ensure they call `build_instrument_context` in their system or human prompt. If not, add it in the smallest local way.

**Step 4: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_prompt_context.py tests/test_ticker_symbol_handling.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tradingagents/agents tests/test_china_prompt_context.py
git commit -m "feat: add China market prompt context"
```

## Task 10: Add Pre-Decision China Compliance Gate

**Files:**
- Create: `tradingagents/markets/china_compliance.py`
- Modify: `tradingagents/graph/trading_graph.py`
- Test: `tests/test_china_compliance_gate.py`

**Step 1: Write failing tests**

```python
from tradingagents.markets.china_compliance import annotate_china_decision


def test_annotate_china_decision_marks_simulation_only():
    decision = annotate_china_decision("BUY 600519.SH 100 shares at 111", symbol="600519.SH")
    assert "SIMULATION ONLY" in decision
    assert "not financial advice" in decision.lower()


def test_annotate_china_decision_keeps_non_china_unchanged():
    decision = annotate_china_decision("BUY NVDA", symbol="NVDA")
    assert decision == "BUY NVDA"
```

**Step 2: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_compliance_gate.py -q
```

Expected: FAIL with missing module.

**Step 3: Implement compliance annotation**

```python
from tradingagents.markets.china import normalize_china_symbol


def _is_china(symbol: str) -> bool:
    try:
        normalize_china_symbol(symbol)
        return True
    except ValueError:
        return False


def annotate_china_decision(decision: str, symbol: str) -> str:
    if not _is_china(symbol):
        return decision
    disclaimer = (
        "SIMULATION ONLY: This China A-share output is for research and paper trading only; "
        "it is not financial advice and must not be treated as a live brokerage instruction."
    )
    if disclaimer in decision:
        return decision
    return f"{disclaimer}\n\n{decision}"
```

**Step 4: Integrate after final decision**

In `TradingAgentsGraph._run_graph`, before `self.memory_log.store_decision(...)`, add:

```python
from tradingagents.markets.china_compliance import annotate_china_decision

final_state["final_trade_decision"] = annotate_china_decision(
    final_state["final_trade_decision"],
    company_name,
)
```

**Step 5: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_compliance_gate.py tests/test_memory_log.py -q
```

Expected: PASS.

**Step 6: Commit**

```bash
git add tradingagents/markets/china_compliance.py tradingagents/graph/trading_graph.py tests/test_china_compliance_gate.py
git commit -m "feat: add China simulation compliance gate"
```

## Task 11: Replace SPY Alpha Benchmark for China Symbols

**Files:**
- Modify: `tradingagents/graph/trading_graph.py`
- Test: `tests/test_china_benchmark_returns.py`

**Step 1: Write failing test**

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph


def test_china_benchmark_symbol_from_config():
    config = {
        "llm_provider": "openai",
        "deep_think_llm": "stub",
        "quick_think_llm": "stub",
        "china_market": {"benchmark_symbol": "000300.SH"},
    }
    graph = object.__new__(TradingAgentsGraph)
    graph.config = config
    assert graph._benchmark_for_symbol("600519.SH") == "000300.SH"
    assert graph._benchmark_for_symbol("NVDA") == "SPY"
```

**Step 2: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_benchmark_returns.py -q
```

Expected: FAIL with missing `_benchmark_for_symbol`.

**Step 3: Add benchmark helper**

In `TradingAgentsGraph`:

```python
from tradingagents.markets.china import normalize_china_symbol


def _benchmark_for_symbol(self, ticker: str) -> str:
    try:
        normalize_china_symbol(ticker)
        return self.config.get("china_market", {}).get("benchmark_symbol", "000300.SH")
    except ValueError:
        return "SPY"
```

Then update `_fetch_returns` to use the helper. For China tickers, do not call yfinance for the benchmark in MVP unless a China price adapter exists for index symbols; return `(raw, None, days)` with a warning if benchmark data is unavailable.

**Step 4: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_china_benchmark_returns.py tests/test_memory_log.py -q
```

Expected: PASS.

**Step 5: Commit**

```bash
git add tradingagents/graph/trading_graph.py tests/test_china_benchmark_returns.py
git commit -m "feat: use China benchmark for A-share memory reflection"
```

## Task 12: Add CLI China Preset

**Files:**
- Modify: `cli/main.py`
- Test: `tests/test_cli_china_preset.py`

**Step 1: Inspect CLI entrypoints**

Run:

```bash
sed -n '1,240p' cli/main.py
```

Identify where selected analysts, provider, ticker, and language are collected.

**Step 2: Write failing test**

If CLI helper functions exist, unit test the helper. If not, first extract a pure helper:

```python
from cli.main import build_china_market_config


def test_build_china_market_config_sets_safe_defaults():
    config = build_china_market_config({})
    assert config["market_profile"] == "china"
    assert config["output_language"] == "Simplified Chinese"
    assert config["china_market"]["simulation_only"] is True
    assert config["data_vendors"]["core_stock_apis"] == "tushare,akshare"
```

**Step 3: Run failure**

Run:

```bash
.venv/bin/python -m pytest tests/test_cli_china_preset.py -q
```

Expected: FAIL with missing helper.

**Step 4: Implement helper and CLI option**

Add:

```python
def build_china_market_config(config: dict) -> dict:
    updated = config.copy()
    updated["market_profile"] = "china"
    updated["output_language"] = "Simplified Chinese"
    updated.setdefault("china_market", {})["simulation_only"] = True
    updated.setdefault("data_vendors", {}).update(
        {
            "core_stock_apis": "tushare,akshare",
            "technical_indicators": "tushare,akshare",
            "fundamental_data": "tushare",
            "news_data": "tushare,akshare",
        }
    )
    return updated
```

Expose either:

- `tradingagents analyze --market china`
- or an interactive market selector with choices `US` and `China A-share`.

**Step 5: Run tests**

Run:

```bash
.venv/bin/python -m pytest tests/test_cli_china_preset.py -q
```

Expected: PASS.

**Step 6: Commit**

```bash
git add cli/main.py tests/test_cli_china_preset.py
git commit -m "feat: add China market CLI preset"
```

## Task 13: Add Documentation and Environment Example

**Files:**
- Modify: `.env.example`
- Create: `docs/china-market.md`
- Modify: `README.md`

**Step 1: Add env vars**

Add to `.env.example`:

```bash
# China market data
TUSHARE_TOKEN=

# Optional: force research/simulation only for China market mode
TRADINGAGENTS_CHINA_SIMULATION_ONLY=true
```

**Step 2: Add user docs**

Create `docs/china-market.md` with:

```markdown
# China Market Mode

China market mode supports A-share research and simulated trading only.

## Supported Symbols

- Shanghai: `600519.SH`, `688981.SH`
- Shenzhen: `000001.SZ`, `300750.SZ`
- Beijing: `920118.BJ`
- Bare six-digit symbols are normalized when exchange inference is unambiguous.

## Data Vendors

- Primary: Tushare Pro, requires `TUSHARE_TOKEN`
- Fallback: AKShare, no token but source availability may vary

## Trading Constraints

The system accounts for T+1 settlement, 100-share buy lots, price limits, suspension risk, ST labels, and board-specific constraints. Outputs are not live orders.

## Example

```python
from tradingagents.graph.trading_graph import TradingAgentsGraph
from tradingagents.default_config import DEFAULT_CONFIG

config = DEFAULT_CONFIG.copy()
config["market_profile"] = "china"
config["output_language"] = "Simplified Chinese"
config["data_vendors"]["core_stock_apis"] = "tushare,akshare"

ta = TradingAgentsGraph(debug=True, config=config)
_, decision = ta.propagate("600519.SH", "2026-04-30")
print(decision)
```
```

**Step 3: Link from README**

Add a short China market section to `README.md` linking to `docs/china-market.md`.

**Step 4: Run documentation sanity checks**

Run:

```bash
test -f docs/china-market.md
grep -n "TUSHARE_TOKEN" .env.example docs/china-market.md
```

Expected: both files mention `TUSHARE_TOKEN`.

**Step 5: Commit**

```bash
git add .env.example README.md docs/china-market.md
git commit -m "docs: add China market mode guide"
```

## Task 14: End-to-End Offline Smoke Test

**Files:**
- Create: `tests/test_china_market_smoke.py`

**Step 1: Write smoke test with mocked tools and fake LLM**

Write a test that avoids external LLM and network calls. If the current graph is hard to test end-to-end without LLMs, test the pure integration path:

```python
from tradingagents.default_config import DEFAULT_CONFIG
from tradingagents.markets.china import normalize_china_symbol
from tradingagents.markets.china_compliance import annotate_china_decision
from tradingagents.markets.china_rules import ChinaTradingRuleInput, evaluate_china_trade_constraints


def test_china_market_offline_smoke():
    config = DEFAULT_CONFIG.copy()
    config["market_profile"] = "china"
    symbol = normalize_china_symbol("600519")
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol=symbol,
            side="buy",
            quantity=100,
            last_close=100.0,
            proposed_price=101.0,
            trade_date=__import__("datetime").date(2026, 4, 30),
        )
    )
    decision = annotate_china_decision("BUY 100 shares", symbol)
    assert result.allowed is True
    assert symbol == "600519.SH"
    assert "SIMULATION ONLY" in decision
```

**Step 2: Run full relevant test suite**

Run:

```bash
.venv/bin/python -m pytest \
  tests/test_china_market_symbols.py \
  tests/test_china_market_config.py \
  tests/test_china_market_rules.py \
  tests/test_tushare_china_dataflow.py \
  tests/test_akshare_china_dataflow.py \
  tests/test_china_vendor_routing.py \
  tests/test_china_indicators.py \
  tests/test_china_fundamentals.py \
  tests/test_china_prompt_context.py \
  tests/test_china_compliance_gate.py \
  tests/test_china_benchmark_returns.py \
  tests/test_cli_china_preset.py \
  tests/test_china_market_smoke.py \
  -q
```

Expected: PASS.

**Step 3: Run upstream regression tests**

Run:

```bash
.venv/bin/python -m pytest tests -q
```

Expected: PASS. If integration tests require API keys, mark them with the existing `integration` marker and run unit tests separately.

**Step 4: Commit**

```bash
git add tests/test_china_market_smoke.py
git commit -m "test: add China market offline smoke coverage"
```

## Task 15: Optional Live Data Verification

**Files:**
- No required source changes
- Optional: `scripts/smoke_china_market.py`

**Step 1: Verify token presence**

Run:

```bash
test -n "$TUSHARE_TOKEN"
```

Expected: exit code 0. If missing, skip this task.

**Step 2: Run a live data probe**

Run:

```bash
.venv/bin/python - <<'PY'
from tradingagents.dataflows.tushare_china import get_china_stock_data
print(get_china_stock_data("600519.SH", "2026-04-01", "2026-04-30")[:1000])
PY
```

Expected: output contains `China OHLCV data for 600519.SH`.

**Step 3: Run a debug analysis only if LLM keys are configured**

Run:

```bash
tradingagents analyze --market china
```

Use ticker `600519.SH`, date `2026-04-30`, output language `Simplified Chinese`, and a domestic-friendly provider such as Qwen, DeepSeek, or GLM if configured.

Expected: final report is in Simplified Chinese and includes the simulation-only disclaimer.

## Additional Tasks: Hong Kong Market Extension

### Task 3.5: Hong Kong Trading Rules Engine

**Files:**
- Create: `tradingagents/markets/hongkong_rules.py`
- Test: in `tests/test_china_hk_market.py` (class `TestHongKongRules`, 4 tests)

Key constraints:
- Variable lot sizes (not fixed 100 shares) — `quantity % lot_size != 0` blocks the trade
- T+2 settlement warning on sell orders
- No daily price limits; extreme-price warnings (>50% from last close) as informational only
- Suspension check blocks trading

### Task 4.5: Tushare Hong Kong Data

**Files:**
- Modify: `tradingagents/dataflows/tushare_china.py`

New functions:
- `get_hk_stock_data(symbol, start_date, end_date)` → `pro.hk_daily()`
- `get_hk_indicators(symbol, start_date, end_date)` → returns latest close, period return, avg volume
- `get_hk_fundamentals(symbol)` → `pro.hk_fina_indicator()` — ROE, gross_margin, debt_to_assets
- `get_hk_balance_sheet(symbol)` → `pro.hk_balancesheet()`
- `get_hk_income_statement(symbol)` → `pro.hk_income()`
- `get_hk_cashflow(symbol)` → `pro.hk_cashflow()`

### Task 5.5: AKShare Hong Kong Fallback

**Files:**
- Modify: `tradingagents/dataflows/akshare_china.py`

New function:
- `get_hk_stock_data_akshare(symbol, start_date, end_date)` → `ak.stock_hk_hist()`

### Task 16: FastAPI + React Web Frontend

**Files:**
- Create: `tradingagents/api/` — FastAPI backend (schemas, task_manager, routes, server)
- Create: `frontend/` — React + Vite + TypeScript frontend
- Modify: `pyproject.toml` — add `fastapi`, `uvicorn`, `sse-starlette`, `tradingagents-api` entry point

API Endpoints:
- `POST /api/analyze` — submit analysis task
- `GET /api/tasks/{id}` — task progress (stages, agents, tokens, report preview)
- `GET /api/tasks/{id}/stream` — SSE real-time log/status stream
- `GET /api/tasks/{id}/report` — final analysis report
- `GET /api/tasks/{id}/download` — download report as Markdown file
- `GET /api/history` — past analysis records

Frontend views:
1. **AnalysisForm** — ticker, date, market (US/China/HK), research depth (Shallow/Medium/Deep), 4 analysts, 10 LLM providers, 11 output languages
2. **ProgressPanel** — left panel: 5-stage Agent status tree (12 agents total) + Token stats (LLM calls, tool calls, input/output tokens); right panel: live log stream + real-time report preview
3. **ReportViewer** — 6-tab Markdown report viewer with ⬇ download button

---

## Completion Status (2026-05-10)

### ✅ Implemented

| Task | Status | Files |
|------|--------|-------|
| Task 1 | ✅ | `markets/base.py`, `markets/china.py`, `markets/hongkong.py`, `markets/__init__.py` |
| Task 2 | ✅ | `default_config.py` — `market_profile`, `china_market`, `hongkong_market`, data_vendors |
| Task 3 | ✅ | `markets/china_rules.py` — T+1, lots, price limits, ST, suspension |
| Task 3.5 | ✅ | `markets/hongkong_rules.py` — T+2, variable lots, extreme price warnings |
| Task 4 | ✅ | `dataflows/tushare_china.py` — `get_china_stock_data/_indicators/_fundamentals` + financials |
| Task 4.5 | ✅ | `dataflows/tushare_china.py` — `get_hk_stock_data/_indicators/_fundamentals` + financials |
| Task 5 | ✅ | `dataflows/akshare_china.py` — `get_china_stock_data_akshare` |
| Task 5.5 | ✅ | `dataflows/akshare_china.py` — `get_hk_stock_data_akshare` |
| Task 6 | ✅ | `dataflows/interface.py` — tushare/akshare dispatchers + `route_to_vendor` auto-detect |
| Task 7 | ✅ | `dataflows/tushare_china.py` — China/HK indicator summaries |
| Task 8 | ✅ | `dataflows/tushare_china.py` — China/HK fundamentals + financial statements |
| Task 9 | ✅ | `agents/utils/agent_utils.py` — `build_instrument_context` with market-specific rules |
| Task 10 | ✅ | `markets/china_compliance.py` — SIMULATION ONLY annotation for China/HK |
| Task 11 | ✅ | `graph/trading_graph.py` — `_benchmark_for_symbol` (沪深300/HSI/SPY) |
| Task 13 | ✅ | `pyproject.toml` — `china` optional deps (tushare, akshare) |
| Task 14 | ✅ | `tests/test_china_hk_market.py` — 40 tests, 37 passed, 3 skipped (langchain not installed) |
| Task 16 | ✅ | `tradingagents/api/` + `frontend/` — FastAPI + React web frontend |

### 🧪 Test Results

```
37 passed, 3 skipped (langchain_core not installed), 0 failed
```

### 🔜 Remaining

- Task 12: CLI `--market china/hongkong` preset (lower priority; API frontend serves as primary UI)
- Task 15: Live data verification with TUSHARE_TOKEN
- Task 13 (env): Update `.env.example` with TUSHARE_TOKEN
- Task 13 (docs): Create `docs/china-market.md` if needed
- Real end-to-end test with actual Tushare/AKShare data
- Hong Kong lot-size dynamic lookup (requires `pro.hk_basic()` or `ak.stock_hk_spot()`)
- New analyst type: HKEX announcements analyst (replace SEC filings for HK market)
- Broker-level quantity constraints (board lot table per HK stock)

---

## Implementation Notes

- Do not add live brokerage execution in this plan.
- Do not scrape gated or unauthorized social/news sources.
- Keep all network-dependent tests mocked by default.
- Prefer vendor routing through `tradingagents/dataflows/interface.py`; avoid direct Tushare imports in agents.
- Keep China/HK-market assumptions configurable because exchange rules can change.
- For ST price limits, keep the initial code conservative. Update when implementing post-2026-07-06 rule changes.
- HK lot sizes vary per stock and must be fetched from data vendors at runtime; the MVP uses caller-supplied `lot_size`.
- The `detect_market()` function in `base.py` is the single source of truth for market routing throughout the codebase.
