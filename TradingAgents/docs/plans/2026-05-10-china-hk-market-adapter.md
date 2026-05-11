# China A-Share + Hong Kong Market Adapter Implementation Plan

> **基于原始计划 `2026-05-04-china-market-adapter.md` 扩展，新增港股（Hong Kong Stock Market）完整支持。**

**Goal:** Build a dual-market research and simulated-trading version of TradingAgents that supports:
- **China A-shares** (SSE 上海, SZSE 深圳, BSE 北京)
- **Hong Kong stocks** (HKEX 香港主板, GEM 创业板)

Both markets share the same architecture with market-specific routing, rules, and compliance.

**Architecture:** Keep the upstream TradingAgents LangGraph workflow and add a market adapter layer instead of rewriting agents. Route Chinese/HK tickers through new dataflow vendors, inject market-specific context into prompts, and enforce respective trading constraints before the final portfolio decision. The first release is research/simulation only and must not connect to live brokerage execution.

**Tech Stack:** Python 3.10+, LangGraph, LangChain tools, pandas, stockstats, pytest, Tushare Pro as the primary China/HK data vendor, AKShare as optional fallback, existing TradingAgents CLI/config system.

---

## Market Comparison: A-Share vs Hong Kong

| Feature | A-Share (A股) | Hong Kong (港股) |
|---------|---------------|------------------|
| **Symbol format** | `600519.SH`, `000001.SZ`, `920118.BJ`, bare 6-digit | `00700.HK`, `09988.HK`, bare 1-5 digit (zero-padded to 5) |
| **Exchanges** | SSE (.SH), SZSE (.SZ), BSE (.BJ) | HKEX (.HK) |
| **Boards** | Main Board, STAR (科创板), ChiNext (创业板), BSE (北交所) | Main Board (主板), GEM (创业板) |
| **Settlement** | T+1 (buy today, sell tomorrow) | T+0 (buy and sell same day) |
| **Price limits** | ±10% main, ±20% STAR/ChiNext, ±30% BSE | No price limits (无涨跌停) |
| **Lot size** | 100 shares (fixed) | Varies by stock (e.g., 100, 200, 500, 1000) |
| **Trading currency** | CNY (人民币) | HKD (港币) |
| **Trading hours** | 9:30-11:30, 13:00-15:00 | 9:30-12:00, 13:00-16:00 |
| **Short selling** | Restricted | Allowed (with conditions) |
| **Stamp duty** | 0.05% (sell only) | 0.13% (both sides) |
| **Benchmark index** | CSI 300 (沪深300) `000300.SH` | Hang Seng Index (恒生指数) `HSI` |
| **Data vendor** | Tushare, AKShare | Tushare (hk_daily), AKShare (stock_hk_hist) |
| **ST/Delisting risk** | ST/*ST labels, delisting warnings | Different warning system (e.g., 停牌/除牌) |

---

## Current Workspace Assumption

The upstream TradingAgents project is already available in this workspace. The `tradingagents/` package structure is in place, with:
- Existing `market_profile` config key (default: `"us"`)
- Existing dataflow vendor routing through `interface.py`
- LLM clients supporting DeepSeek, Qwen, GLM (Chinese-friendly models)

Apply the tasks below inside the existing TradingAgents codebase.

---

## Definition of Done

- `TradingAgentsGraph(...).propagate("600519.SH", "2026-04-30")` can run in **A-share simulation mode** with China-market vendors configured.
- `TradingAgentsGraph(...).propagate("00700.HK", "2026-04-30")` can run in **HK stock simulation mode** with HK-market vendors configured.
- The system recognizes `.SH`, `.SZ`, `.BJ`, `.HK` suffixes, bare A-share 6-digit codes, and bare/padded HK 1-5 digit codes. Rejects unsafe ticker path components.
- Data tools support OHLCV, technical indicators, fundamentals, announcements/news, and market calendar access through vendor routing for both markets.
- A-share risk checks: T+1, 100-share lots, price limits, suspension, ST labels.
- HK risk checks: T+0 (no restriction), no price limits, variable lot sizes, suspension, warning labels.
- Final user-facing reports can be produced in Simplified Chinese or Traditional Chinese.
- All new unit tests pass without requiring external network calls by using mocks/fixtures.

---

## Task 0: Verify Project Baseline

**Files:**
- Verify: `tradingagents/default_config.py`
- Verify: `tradingagents/dataflows/interface.py`
- Verify: `pyproject.toml`
- Verify: `tests/`

**Step 1: Confirm project structure**

Ensure the existing TradingAgents codebase is functional:

```bash
ls tradingagents/default_config.py tradingagents/dataflows/interface.py pyproject.toml
```

**Step 2: Install in editable mode (if not already done)**

```bash
python -m venv .venv
.venv/bin/pip install -e ".[dev]"
```

**Step 3: Run baseline tests**

```bash
.venv/bin/python -m pytest tests -q
```

Expected: existing upstream tests pass before market changes.

**Step 4: Commit baseline**

```bash
git add .
git commit -m "chore: verify project baseline before China-HK market adaptation"
```

---

## Task 1: Add Dual-Market Types and Symbol Normalization

**Files:**
- Create: `tradingagents/markets/__init__.py`
- Create: `tradingagents/markets/china.py` (A-share symbols)
- Create: `tradingagents/markets/hongkong.py` (HK stock symbols)
- Create: `tradingagents/markets/symbol.py` (unified market detection)
- Test: `tests/test_china_market_symbols.py`
- Test: `tests/test_hk_market_symbols.py`

### Step 1: Write failing tests for A-share symbols

```python
# tests/test_china_market_symbols.py
import pytest

from tradingagents.markets.china import (
    ChinaBoard,
    normalize_china_symbol,
    classify_china_symbol,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("600519", "600519.SH"),
        ("000001", "000001.SZ"),
        ("300750", "300750.SZ"),
        ("688981", "688981.SH"),
        ("920118", "920118.BJ"),
        ("600519.SH", "600519.SH"),
        ("000001.SZ", "000001.SZ"),
    ],
)
def test_normalize_china_symbol(raw, expected):
    assert normalize_china_symbol(raw) == expected


def test_classify_board():
    assert classify_china_symbol("600519.SH") == ChinaBoard.SSE_MAIN
    assert classify_china_symbol("688981.SH") == ChinaBoard.STAR
    assert classify_china_symbol("300750.SZ") == ChinaBoard.CHINEXT
    assert classify_china_symbol("920118.BJ") == ChinaBoard.BSE


def test_reject_invalid_symbol():
    with pytest.raises(ValueError):
        normalize_china_symbol("../600519")
    with pytest.raises(ValueError):
        normalize_china_symbol("AAPL")
```

### Step 2: Write failing tests for HK symbols

```python
# tests/test_hk_market_symbols.py
import pytest

from tradingagents.markets.hongkong import (
    HKBoard,
    normalize_hk_symbol,
    classify_hk_symbol,
)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ("00700", "00700.HK"),
        ("700", "00700.HK"),
        ("9988", "09988.HK"),
        ("09988", "09988.HK"),
        ("5", "00005.HK"),
        ("00005", "00005.HK"),
        ("00700.HK", "00700.HK"),
        ("09988.HK", "09988.HK"),
        ("00005.HK", "00005.HK"),
    ],
)
def test_normalize_hk_symbol(raw, expected):
    assert normalize_hk_symbol(raw) == expected


def test_classify_hk_board():
    assert classify_hk_symbol("00700.HK") == HKBoard.MAIN
    assert classify_hk_symbol("08083.HK") == HKBoard.GEM


def test_reject_invalid_hk_symbol():
    with pytest.raises(ValueError):
        normalize_hk_symbol("../00700")
    with pytest.raises(ValueError):
        normalize_hk_symbol("999999")  # too long for HK
    with pytest.raises(ValueError):
        normalize_hk_symbol("AAPL")
```

### Step 3: Write failing tests for unified market detection

```python
# tests/test_market_detection.py
import pytest

from tradingagents.markets.symbol import (
    MarketType,
    detect_market,
    normalize_symbol,
    classify_board,
)


@pytest.mark.parametrize(
    ("symbol", "expected_market"),
    [
        ("600519.SH", MarketType.CHINA_A),
        ("000001.SZ", MarketType.CHINA_A),
        ("688981", MarketType.CHINA_A),
        ("00700.HK", MarketType.HONGKONG),
        ("09988", MarketType.HONGKONG),
        ("700", MarketType.HONGKONG),
        ("NVDA", MarketType.US),
        ("AAPL", MarketType.US),
    ],
)
def test_detect_market(symbol, expected_market):
    assert detect_market(symbol) == expected_market


def test_normalize_symbol_dispatches():
    assert normalize_symbol("600519") == "600519.SH"
    assert normalize_symbol("700") == "00700.HK"
    assert normalize_symbol("NVDA") == "NVDA"


def test_reject_unsafe():
    with pytest.raises(ValueError):
        normalize_symbol("../../../etc")
```

Run all three test files to confirm failures:

```bash
.venv/bin/python -m pytest tests/test_china_market_symbols.py tests/test_hk_market_symbols.py tests/test_market_detection.py -q
```

Expected: ALL FAIL with `ModuleNotFoundError: No module named 'tradingagents.markets'`.

### Step 4: Implement A-share symbol module

Create `tradingagents/markets/china.py`:

```python
from enum import Enum
import re


class ChinaBoard(str, Enum):
    SSE_MAIN = "sse_main"
    SZSE_MAIN = "szse_main"
    CHINEXT = "chinext"
    STAR = "star"
    BSE = "bse"


_SYMBOL_RE = re.compile(r"^\d{6}(\.(SH|SZ|BJ))?$")

# Exchange inference: Shanghai prefixes
_SH_PREFIXES = ("600", "601", "603", "605", "688")
# Shenzhen prefixes
_SZ_PREFIXES = ("000", "001", "002", "003", "300")
# Beijing prefixes (includes new 920 series)
_BJ_PREFIXES = ("430", "830", "831", "832", "833", "834", "835", "836", "837", "838", "839", "870", "871", "872", "873", "920")


def normalize_china_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if not _SYMBOL_RE.match(value):
        raise ValueError(f"Invalid China A-share symbol: {symbol}")
    if "." in value:
        return value
    if value.startswith(_SH_PREFIXES):
        return f"{value}.SH"
    if value.startswith(_SZ_PREFIXES):
        return f"{value}.SZ"
    if value.startswith(_BJ_PREFIXES):
        return f"{value}.BJ"
    raise ValueError(f"Cannot infer exchange for China A-share symbol: {symbol}")


def classify_china_symbol(symbol: str) -> ChinaBoard:
    normalized = normalize_china_symbol(symbol)
    code, exchange = normalized.split(".")
    if exchange == "BJ":
        return ChinaBoard.BSE
    if exchange == "SH" and code.startswith("688"):
        return ChinaBoard.STAR
    if exchange == "SH":
        return ChinaBoard.SSE_MAIN
    if exchange == "SZ" and code.startswith("300"):
        return ChinaBoard.CHINEXT
    return ChinaBoard.SZSE_MAIN


def is_china_symbol(value: str) -> bool:
    try:
        normalize_china_symbol(value)
        return True
    except ValueError:
        return False
```

### Step 5: Implement HK symbol module

Create `tradingagents/markets/hongkong.py`:

```python
from enum import Enum
import re


class HKBoard(str, Enum):
    MAIN = "main"
    GEM = "gem"


# HK stock codes: 1-5 digits, optional .HK suffix
_SYMBOL_RE = re.compile(r"^\d{1,5}(\.HK)?$", re.IGNORECASE)

# GEM board codes: typically start with 08xxx
_GEM_PREFIXES = ("08",)


def normalize_hk_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if "." in value:
        code, exchange = value.split(".")
        if exchange != "HK":
            raise ValueError(f"Invalid HK symbol exchange suffix: {symbol}")
        if not _SYMBOL_RE.match(f"{code}"):
            raise ValueError(f"Invalid HK symbol code: {symbol}")
        padded = code.zfill(5)
        return f"{padded}.HK"

    if not _SYMBOL_RE.match(value):
        raise ValueError(f"Invalid Hong Kong stock symbol: {symbol}")
    padded = value.zfill(5)
    return f"{padded}.HK"


def classify_hk_symbol(symbol: str) -> HKBoard:
    normalized = normalize_hk_symbol(symbol)
    code = normalized.split(".")[0]
    if code.startswith(_GEM_PREFIXES):
        return HKBoard.GEM
    return HKBoard.MAIN


def is_hk_symbol(value: str) -> bool:
    try:
        normalize_hk_symbol(value)
        return True
    except ValueError:
        return False
```

### Step 6: Implement unified market detection

Create `tradingagents/markets/symbol.py`:

```python
from enum import Enum

from .china import normalize_china_symbol, is_china_symbol, classify_china_symbol, ChinaBoard
from .hongkong import normalize_hk_symbol, is_hk_symbol, classify_hk_symbol, HKBoard


class MarketType(str, Enum):
    US = "us"
    CHINA_A = "china_a"
    HONGKONG = "hongkong"
    UNKNOWN = "unknown"


def detect_market(value: str) -> MarketType:
    if is_china_symbol(value):
        return MarketType.CHINA_A
    if is_hk_symbol(value):
        return MarketType.HONGKONG
    # For US and other markets, return US as default (backward compatible)
    # Basic sanity: reject path-traversal attempts
    if ".." in value or "/" in value or "\\" in value:
        raise ValueError(f"Unsafe symbol string: {value}")
    return MarketType.US


def normalize_symbol(value: str) -> str:
    if is_china_symbol(value):
        return normalize_china_symbol(value)
    if is_hk_symbol(value):
        return normalize_hk_symbol(value)
    if ".." in value or "/" in value or "\\" in value:
        raise ValueError(f"Unsafe symbol string: {value}")
    return value.upper()


def classify_board(value: str):
    market = detect_market(value)
    if market == MarketType.CHINA_A:
        return classify_china_symbol(value)
    if market == MarketType.HONGKONG:
        return classify_hk_symbol(value)
    return None
```

Create `tradingagents/markets/__init__.py`:

```python
from .symbol import MarketType, detect_market, normalize_symbol, classify_board
from .china import ChinaBoard, normalize_china_symbol, classify_china_symbol, is_china_symbol
from .hongkong import HKBoard, normalize_hk_symbol, classify_hk_symbol, is_hk_symbol

__all__ = [
    "MarketType",
    "detect_market",
    "normalize_symbol",
    "classify_board",
    "ChinaBoard",
    "normalize_china_symbol",
    "classify_china_symbol",
    "is_china_symbol",
    "HKBoard",
    "normalize_hk_symbol",
    "classify_hk_symbol",
    "is_hk_symbol",
]
```

### Step 7: Run tests

```bash
.venv/bin/python -m pytest tests/test_china_market_symbols.py tests/test_hk_market_symbols.py tests/test_market_detection.py -q
```

Expected: ALL PASS.

### Step 8: Commit

```bash
git add tradingagents/markets/ tests/test_china_market_symbols.py tests/test_hk_market_symbols.py tests/test_market_detection.py
git commit -m "feat: add dual-market symbol normalization (A-share + Hong Kong)"
```

---

## Task 2: Add Config Keys for Dual-Market Mode

**Files:**
- Modify: `tradingagents/default_config.py`
- Test: `tests/test_dual_market_config.py`

### Step 1: Write failing tests

```python
# tests/test_dual_market_config.py
from tradingagents.default_config import DEFAULT_CONFIG


def test_market_profile_default_us():
    assert DEFAULT_CONFIG["market_profile"] == "us"


def test_china_a_market_config_exists():
    assert "china_a_market" in DEFAULT_CONFIG
    assert DEFAULT_CONFIG["china_a_market"]["primary_data_vendor"] == "tushare"
    assert DEFAULT_CONFIG["china_a_market"]["fallback_data_vendor"] == "akshare"
    assert DEFAULT_CONFIG["china_a_market"]["simulation_only"] is True
    assert DEFAULT_CONFIG["china_a_market"]["benchmark_symbol"] == "000300.SH"
    assert DEFAULT_CONFIG["china_a_market"]["calendar_exchange"] == "SSE"


def test_hk_market_config_exists():
    assert "hongkong_market" in DEFAULT_CONFIG
    assert DEFAULT_CONFIG["hongkong_market"]["primary_data_vendor"] == "tushare"
    assert DEFAULT_CONFIG["hongkong_market"]["fallback_data_vendor"] == "akshare"
    assert DEFAULT_CONFIG["hongkong_market"]["simulation_only"] is True
    assert DEFAULT_CONFIG["hongkong_market"]["benchmark_symbol"] == "HSI"
    assert DEFAULT_CONFIG["hongkong_market"]["calendar_exchange"] == "HKEX"


def test_data_vendors_extended():
    assert "china_market_data" in DEFAULT_CONFIG["data_vendors"]
    assert "hongkong_market_data" in DEFAULT_CONFIG["data_vendors"]
```

### Step 2: Run test to verify it fails

```bash
.venv/bin/python -m pytest tests/test_dual_market_config.py -q
```

Expected: FAIL with missing config keys.

### Step 3: Add config

Add to `DEFAULT_CONFIG` in `tradingagents/default_config.py`:

```python
"market_profile": "us",

# China A-share market configuration
"china_a_market": {
    "primary_data_vendor": "tushare",
    "fallback_data_vendor": "akshare",
    "simulation_only": True,
    "benchmark_symbol": "000300.SH",
    "calendar_exchange": "SSE",
    "report_language": "Simplified Chinese",
    "rules_effective_date": "2026-07-06",
},

# Hong Kong market configuration
"hongkong_market": {
    "primary_data_vendor": "tushare",
    "fallback_data_vendor": "akshare",
    "simulation_only": True,
    "benchmark_symbol": "HSI",
    "calendar_exchange": "HKEX",
    "report_language": "Traditional Chinese",
},
```

Extend `data_vendors`:

```python
"data_vendors": {
    "core_stock_apis": "yfinance",
    "technical_indicators": "yfinance",
    "fundamental_data": "yfinance",
    "news_data": "yfinance",
    # China markets
    "china_market_data": "tushare,akshare",
    "china_fundamental_data": "tushare",
    "china_news_data": "tushare,akshare",
    # Hong Kong markets
    "hongkong_market_data": "tushare,akshare",
    "hongkong_fundamental_data": "tushare",
    "hongkong_news_data": "tushare,akshare",
},
```

### Step 4: Run tests

```bash
.venv/bin/python -m pytest tests/test_dual_market_config.py -q
```

Expected: PASS.

### Step 5: Commit

```bash
git add tradingagents/default_config.py tests/test_dual_market_config.py
git commit -m "feat: add dual-market configuration (A-share + Hong Kong)"
```

---

## Task 3: Add Dual-Market Trading Rules Engine

**Files:**
- Create: `tradingagents/markets/china_rules.py`
- Create: `tradingagents/markets/hongkong_rules.py`
- Test: `tests/test_china_market_rules.py`
- Test: `tests/test_hk_market_rules.py`

### Step 1: Write failing tests for A-share rules

```python
# tests/test_china_market_rules.py
from datetime import date
from tradingagents.markets.china_rules import (
    ChinaTradingRuleInput,
    evaluate_china_trade_constraints,
)


def test_main_board_lot_size_blocks_odd_buy_quantity():
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol="600519.SH", side="buy", quantity=101,
            last_close=100.0, proposed_price=101.0, trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is False
    assert "100-share lot" in result.reasons[0]


def test_price_limit_blocks_main_board_buy_above_limit():
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol="600519.SH", side="buy", quantity=100,
            last_close=100.0, proposed_price=111.0, trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is False
    assert any("price limit" in reason for reason in result.reasons)


def test_chinext_allows_twenty_percent_limit():
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol="300750.SZ", side="buy", quantity=100,
            last_close=100.0, proposed_price=119.0, trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is True


def test_t1_warning_on_sell():
    result = evaluate_china_trade_constraints(
        ChinaTradingRuleInput(
            symbol="600519.SH", side="sell", quantity=100,
            last_close=100.0, proposed_price=100.0, trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is True
    assert any("T+1" in warning for warning in result.warnings)
```

### Step 2: Write failing tests for HK rules

```python
# tests/test_hk_market_rules.py
from datetime import date
from tradingagents.markets.hongkong_rules import (
    HKTradingRuleInput,
    evaluate_hk_trade_constraints,
)


def test_hk_suspension_blocks_trade():
    result = evaluate_hk_trade_constraints(
        HKTradingRuleInput(
            symbol="00700.HK", side="buy", proposed_price=350.0,
            trade_date=date(2026, 4, 30), is_suspended=True,
        )
    )
    assert result.allowed is False
    assert "suspended" in result.reasons[0]


def test_hk_no_price_limit():
    result = evaluate_hk_trade_constraints(
        HKTradingRuleInput(
            symbol="00700.HK", side="buy", proposed_price=9999.0,
            trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is True


def test_hk_t0_no_settlement_restriction():
    result = evaluate_hk_trade_constraints(
        HKTradingRuleInput(
            symbol="00700.HK", side="sell", proposed_price=350.0,
            trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is True
    assert not any("T+" in w for w in result.warnings)


def test_hk_no_lot_size_check_in_mvp():
    result = evaluate_hk_trade_constraints(
        HKTradingRuleInput(
            symbol="00700.HK", side="buy", proposed_price=350.0,
            trade_date=date(2026, 4, 30),
        )
    )
    assert result.allowed is True
```

### Step 3: Run failures

```bash
.venv/bin/python -m pytest tests/test_china_market_rules.py tests/test_hk_market_rules.py -q
```

Expected: ALL FAIL with missing modules.

### Step 4: Implement A-share rules engine

Create `tradingagents/markets/china_rules.py`:

```python
from dataclasses import dataclass, field
from datetime import date

from tradingagents.markets.china import ChinaBoard, classify_china_symbol


@dataclass(frozen=True)
class ChinaTradingRuleInput:
    symbol: str
    side: str
    quantity: int = 100
    last_close: float = 0.0
    proposed_price: float = 0.0
    trade_date: date = None
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
    if limit is not None and input.last_close > 0 and input.proposed_price > 0:
        upper = round(input.last_close * (1 + limit), 2)
        lower = round(input.last_close * (1 - limit), 2)
        if input.proposed_price > upper or input.proposed_price < lower:
            reasons.append(f"proposed price violates {limit:.0%} price limit")

    if input.side.lower() == "sell":
        warnings.append("A-share sell orders must respect T+1 settlement availability")

    return ChinaTradingRuleResult(allowed=not reasons, reasons=reasons, warnings=warnings)
```

### Step 5: Implement HK rules engine

Create `tradingagents/markets/hongkong_rules.py`:

```python
from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class HKTradingRuleInput:
    symbol: str
    side: str = "buy"
    proposed_price: float = 0.0
    trade_date: date = None
    is_suspended: bool = False
    is_warning_stock: bool = False


@dataclass(frozen=True)
class HKTradingRuleResult:
    allowed: bool
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def evaluate_hk_trade_constraints(input: HKTradingRuleInput) -> HKTradingRuleResult:
    reasons: list[str] = []
    warnings: list[str] = []

    if input.is_suspended:
        reasons.append("Hong Kong security is suspended from trading")

    if input.is_warning_stock:
        warnings.append(
            "Hong Kong stock has active warning/delisting-risk indicators; "
            "consider additional due diligence"
        )

    # HK has T+0: no settlement restriction on sell
    # HK has no price limits: no price boundary checks
    # HK has variable lot sizes: lot size validation requires data vendor, skip in MVP

    warnings.append(
        "Hong Kong market has T+0 settlement (same-day trading allowed) and no price limits; "
        "exercise risk management accordingly"
    )

    return HKTradingRuleResult(allowed=not reasons, reasons=reasons, warnings=warnings)
```

### Step 6: Run tests

```bash
.venv/bin/python -m pytest tests/test_china_market_rules.py tests/test_hk_market_rules.py -q
```

Expected: ALL PASS.

### Step 7: Commit

```bash
git add tradingagents/markets/china_rules.py tradingagents/markets/hongkong_rules.py tests/test_china_market_rules.py tests/test_hk_market_rules.py
git commit -m "feat: add dual-market trading rule engines (A-share + Hong Kong)"
```

---

## Task 4: Add Tushare Vendor Dataflow (A-Share + HK)

**Files:**
- Create: `tradingagents/dataflows/tushare_china.py`
- Modify: `tradingagents/dataflows/interface.py`
- Modify: `pyproject.toml`
- Test: `tests/test_tushare_china_dataflow.py`
- Test: `tests/test_tushare_hk_dataflow.py`

### Step 1: Write failing tests for A-share data

```python
# tests/test_tushare_china_dataflow.py
import pandas as pd
from tradingagents.dataflows.tushare_china import get_china_stock_data


class FakePro:
    def daily(self, **kwargs):
        assert kwargs["ts_code"] == "600519.SH"
        return pd.DataFrame([
            {"trade_date": "20260430", "open": 100.0, "high": 102.0,
             "low": 99.0, "close": 101.0, "vol": 10000.0, "amount": 1010000.0}
        ])

    def fina_indicator(self, **kwargs):
        return pd.DataFrame([
            {"end_date": "20260331", "roe": 8.5, "grossprofit_margin": 52.1, "debt_to_assets": 23.4}
        ])


def test_get_china_stock_data(monkeypatch):
    monkeypatch.setattr("tradingagents.dataflows.tushare_china._get_tushare_pro", lambda: FakePro())
    result = get_china_stock_data("600519.SH", "2026-04-01", "2026-04-30")
    assert "600519.SH" in result
    assert "2026-04-30" in result
    assert "close=101.0" in result


def test_get_china_fundamentals(monkeypatch):
    monkeypatch.setattr("tradingagents.dataflows.tushare_china._get_tushare_pro", lambda: FakePro())
    result = __import__("tradingagents.dataflows.tushare_china", fromlist=["get_china_fundamentals"]).get_china_fundamentals("600519.SH")
    assert "ROE=8.5" in result
```

### Step 2: Write failing tests for HK data

```python
# tests/test_tushare_hk_dataflow.py
import pandas as pd
from tradingagents.dataflows.tushare_china import get_hk_stock_data


class FakePro:
    def hk_daily(self, **kwargs):
        assert kwargs["ts_code"] == "00700.HK"
        return pd.DataFrame([
            {"trade_date": "20260430", "open": 348.0, "high": 352.0,
             "low": 346.0, "close": 350.0, "vol": 5000000.0, "amount": 1750000000.0}
        ])


def test_get_hk_stock_data(monkeypatch):
    monkeypatch.setattr("tradingagents.dataflows.tushare_china._get_tushare_pro", lambda: FakePro())
    result = get_hk_stock_data("00700.HK", "2026-04-01", "2026-04-30")
    assert "00700.HK" in result
    assert "2026-04-30" in result
    assert "close=350.0" in result
```

### Step 3: Run failures

```bash
.venv/bin/python -m pytest tests/test_tushare_china_dataflow.py tests/test_tushare_hk_dataflow.py -q
```

Expected: ALL FAIL with missing modules.

### Step 4: Implement Tushare adapter with dual-market support

Create `tradingagents/dataflows/tushare_china.py`:

```python
import os
from tradingagents.markets.china import normalize_china_symbol
from tradingagents.markets.hongkong import normalize_hk_symbol


def _get_tushare_pro():
    import tushare as ts
    token = os.getenv("TUSHARE_TOKEN")
    if not token:
        raise RuntimeError("TUSHARE_TOKEN is required for Tushare data")
    ts.set_token(token)
    return ts.pro_api()


def _fmt_date(value: str) -> str:
    return value.replace("-", "")


def _display_date(value: str) -> str:
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


# ---- A-Share Data ----

def get_china_stock_data(symbol: str, start_date: str, end_date: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.daily(ts_code=ts_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date))
    if frame is None or frame.empty:
        return f"No China A-share data found for {ts_code} from {start_date} to {end_date}."
    frame = frame.sort_values("trade_date")
    lines = [f"China A-share OHLCV data for {ts_code}:"]
    for row in frame.to_dict("records"):
        lines.append(
            f"{_display_date(row['trade_date'])}: "
            f"open={row['open']}, high={row['high']}, low={row['low']}, "
            f"close={row['close']}, volume={row.get('vol')}, amount={row.get('amount')}"
        )
    return "\n".join(lines)


def get_china_indicators(symbol: str, start_date: str, end_date: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.daily(ts_code=ts_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date))
    if frame is None or frame.empty:
        return f"No China A-share indicator data found for {ts_code}."
    frame = frame.sort_values("trade_date")
    first = float(frame.iloc[0]["close"])
    last = float(frame.iloc[-1]["close"])
    ret = (last - first) / first if first != 0 else 0.0
    avg_vol = float(frame["vol"].mean()) if "vol" in frame else 0.0
    return (
        f"China A-share technical summary for {ts_code}: "
        f"latest close={last}, period return={ret:.2%}, "
        f"3-day return={ret:.2%}, average volume={avg_vol:.