# Trading Strategy Integration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn the existing parallel LLM analysis pipeline and pandas signal engine into one strategy research workflow where quantitative signals, risk controls, and backtest evidence inform the LLM decision chain.

**Architecture:** Keep the current `research/signals` rule engine as the source of structured quantitative evidence. Add a thin context-loading layer that injects `ResearchSignal` summaries into the LangGraph agent state, then require Research Manager, Trader, and Portfolio Manager to ground decisions in both LLM reports and quant evidence. Extend the backtest and optimizer modules after the integration path is stable.

**Tech Stack:** Python 3.12, pandas, SQLite, Pydantic, LangGraph, pytest, FastAPI, React/Vite.

---

## Scope And Order

Build in three phases:

1. **Phase 1: Connect the two systems.** Load `ResearchSignal` rows into the LLM graph and expose them in prompts and structured outputs.
2. **Phase 2: Make signals tradable.** Add ATR-based stop/risk fields, benchmark excess return, better portfolio risk controls, and richer metrics.
3. **Phase 3: Make strategy iteration repeatable.** Add parameter sweep execution, walk-forward orchestration, and an end-to-end pipeline command/API.

Do not add new indicators before Phase 1 passes. The current problem is integration, not indicator count.

---

## Phase 1: Quant Signal Context In LLM Pipeline

### Task 1: Add Signal Context Loader

**Files:**
- Create: `TradingAgents/tradingagents/research/signal_context.py`
- Test: `TradingAgents/tests/test_signal_context.py`

**Step 1: Write the failing tests**

Create tests that seed `signal_log` and assert rows are normalized into prompt-safe summaries.

```python
import json

from tradingagents.research.db import init_db
from tradingagents.research.repository import upsert_signals
from tradingagents.research.signal_context import (
    load_signal_context,
    render_signal_context,
)


def test_load_signal_context_returns_symbol_date_signals(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    init_db()
    upsert_signals([
        {
            "signal_id": "2026-05-12-600519_SH-放量突破-signal_v1",
            "date": "2026-05-12",
            "symbol": "600519.SH",
            "market": "CHINA",
            "signal_name": "放量突破",
            "signal_level": "A",
            "direction": "opportunity",
            "timeframe": "daily",
            "evidence_json": json.dumps(["close >= 60日新高"], ensure_ascii=False),
            "risk_json": json.dumps(["RSI 偏热"], ensure_ascii=False),
            "invalid_json": json.dumps(["跌破 MA60"], ensure_ascii=False),
            "score": 85.0,
            "strategy_version": "signal_v1",
        }
    ])

    signals = load_signal_context("600519.SH", "2026-05-12")

    assert len(signals) == 1
    assert signals[0]["signal_name"] == "放量突破"
    assert signals[0]["signal_level"] == "A"
    assert signals[0]["evidence"] == ["close >= 60日新高"]


def test_render_signal_context_is_stable_and_readable():
    text = render_signal_context([
        {
            "signal_name": "放量突破",
            "signal_level": "A",
            "direction": "opportunity",
            "score": 85.0,
            "evidence": ["close >= 60日新高"],
            "risk": ["RSI 偏热"],
            "invalid_conditions": ["跌破 MA60"],
        }
    ])

    assert "Quant Signals" in text
    assert "放量突破" in text
    assert "跌破 MA60" in text
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_signal_context.py -v
```

Expected: FAIL because `tradingagents.research.signal_context` does not exist.

**Step 3: Implement the loader**

Implement `signal_context.py`:

```python
from __future__ import annotations

import json
from typing import Any

from tradingagents.research.repository import _normalize_symbol
from tradingagents.research.db import get_connection, init_db


def _json_list(value: str | None) -> list[str]:
    if not value:
        return []
    parsed = json.loads(value)
    return [str(item) for item in parsed] if isinstance(parsed, list) else []


def load_signal_context(symbol: str, trade_date: str) -> list[dict[str, Any]]:
    init_db()
    normalized = _normalize_symbol(symbol)
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM signal_log
            WHERE symbol = ? AND date = ?
            ORDER BY score DESC, signal_level, signal_name
            """,
            (normalized, trade_date),
        ).fetchall()
    signals = []
    for row in rows:
        item = dict(row)
        signals.append(
            {
                "signal_id": item["signal_id"],
                "date": item["date"],
                "symbol": item["symbol"],
                "market": item.get("market"),
                "signal_name": item["signal_name"],
                "signal_level": item.get("signal_level"),
                "direction": item.get("direction"),
                "timeframe": item.get("timeframe"),
                "score": item.get("score"),
                "strategy_version": item.get("strategy_version"),
                "evidence": _json_list(item.get("evidence_json")),
                "risk": _json_list(item.get("risk_json")),
                "invalid_conditions": _json_list(item.get("invalid_json")),
            }
        )
    return signals


def render_signal_context(signals: list[dict[str, Any]]) -> str:
    if not signals:
        return "## Quant Signals\n\nNo rule-based research signals were found for this symbol and date."
    lines = ["## Quant Signals", ""]
    for signal in signals:
        lines.append(
            f"- {signal['signal_name']} [{signal.get('signal_level')}] "
            f"{signal.get('direction')} score={signal.get('score')}"
        )
        if signal["evidence"]:
            lines.append(f"  Evidence: {'; '.join(signal['evidence'])}")
        if signal["risk"]:
            lines.append(f"  Risks: {'; '.join(signal['risk'])}")
        if signal["invalid_conditions"]:
            lines.append(f"  Invalid if: {'; '.join(signal['invalid_conditions'])}")
    return "\n".join(lines)
```

**Step 4: Run test to verify it passes**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_signal_context.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add TradingAgents/tradingagents/research/signal_context.py TradingAgents/tests/test_signal_context.py
git commit -m "feat: add quant signal context loader"
```

---

### Task 2: Add Quant Signal State To LangGraph

**Files:**
- Modify: `TradingAgents/tradingagents/agents/utils/agent_states.py`
- Create: `TradingAgents/tradingagents/graph/quant_context.py`
- Modify: `TradingAgents/tradingagents/graph/setup.py`
- Test: `TradingAgents/tests/test_quant_context_node.py`

**Step 1: Write the failing test**

```python
from tradingagents.graph.quant_context import create_quant_signal_loader


def test_quant_signal_loader_adds_rendered_context(monkeypatch):
    def fake_load(symbol, trade_date):
        assert symbol == "600519.SH"
        assert trade_date == "2026-05-12"
        return [
            {
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "score": 85.0,
                "evidence": ["close > ma60"],
                "risk": [],
                "invalid_conditions": ["close 跌破 ma60"],
            }
        ]

    loader = create_quant_signal_loader(load_signal_context_fn=fake_load)
    result = loader({"company_of_interest": "600519.SH", "trade_date": "2026-05-12"})

    assert "quant_signals" in result
    assert result["quant_signals"][0]["signal_name"] == "趋势增强"
    assert "quant_signal_context" in result
    assert "趋势增强" in result["quant_signal_context"]
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_quant_context_node.py -v
```

Expected: FAIL because `graph.quant_context` does not exist.

**Step 3: Add state fields**

In `AgentState`, add:

```python
quant_signals: Annotated[
    list[dict],
    "Rule-based quant signals loaded from research/signals for this symbol/date",
]
quant_signal_context: Annotated[
    str,
    "Markdown summary of rule-based quant signals for prompt injection",
]
```

**Step 4: Create the node**

Create `TradingAgents/tradingagents/graph/quant_context.py`:

```python
from __future__ import annotations

from tradingagents.research.signal_context import (
    load_signal_context,
    render_signal_context,
)


def create_quant_signal_loader(load_signal_context_fn=load_signal_context):
    def quant_signal_loader_node(state) -> dict:
        signals = load_signal_context_fn(
            state["company_of_interest"],
            state["trade_date"],
        )
        return {
            "quant_signals": signals,
            "quant_signal_context": render_signal_context(signals),
        }

    return quant_signal_loader_node
```

**Step 5: Wire node into graph**

In `GraphSetup.setup_graph`:

```python
from .quant_context import create_quant_signal_loader
```

Add node:

```python
workflow.add_node("Quant Signal Loader", create_quant_signal_loader())
```

Change the last analyst edge:

```python
workflow.add_edge(current_clear, "Quant Signal Loader")
workflow.add_edge("Quant Signal Loader", "Bull Researcher")
```

Only apply this in the `else` block where the final analyst currently connects directly to `"Bull Researcher"`.

**Step 6: Run test to verify it passes**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_quant_context_node.py -v
```

Expected: PASS.

**Step 7: Commit**

```bash
git add TradingAgents/tradingagents/agents/utils/agent_states.py TradingAgents/tradingagents/graph/quant_context.py TradingAgents/tradingagents/graph/setup.py TradingAgents/tests/test_quant_context_node.py
git commit -m "feat: inject quant signal context into graph state"
```

---

### Task 3: Ground Bull/Bear/Manager/Trader/PM Prompts In Quant Signals

**Files:**
- Modify: `TradingAgents/tradingagents/agents/researchers/bull_researcher.py`
- Modify: `TradingAgents/tradingagents/agents/researchers/bear_researcher.py`
- Modify: `TradingAgents/tradingagents/agents/managers/research_manager.py`
- Modify: `TradingAgents/tradingagents/agents/trader/trader.py`
- Modify: `TradingAgents/tradingagents/agents/managers/portfolio_manager.py`
- Test: `TradingAgents/tests/test_quant_signal_prompt_injection.py`

**Step 1: Write the failing tests**

Use a fake LLM that records prompts:

```python
class FakeResponse:
    content = "ok"


class FakeLLM:
    def __init__(self):
        self.prompts = []

    def invoke(self, prompt):
        self.prompts.append(prompt)
        return FakeResponse()


def test_bull_researcher_prompt_includes_quant_signal_context():
    from tradingagents.agents.researchers.bull_researcher import create_bull_researcher

    llm = FakeLLM()
    node = create_bull_researcher(llm)
    node({
        "investment_debate_state": {"history": "", "bull_history": "", "bear_history": "", "current_response": "", "count": 0},
        "market_report": "market",
        "sentiment_report": "sentiment",
        "news_report": "news",
        "fundamentals_report": "fundamentals",
        "quant_signal_context": "## Quant Signals\n- 趋势增强 [A]",
    })

    assert "Quant Signals" in llm.prompts[0]
    assert "趋势增强" in llm.prompts[0]
```

Add equivalent tests for Bear and Research Manager. For Trader and Portfolio Manager, monkeypatch `invoke_structured_or_freetext` or assert the fake structured path receives text containing `Quant Signals`.

**Step 2: Run tests to verify they fail**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_quant_signal_prompt_injection.py -v
```

Expected: FAIL because prompts do not include quant context.

**Step 3: Update prompts**

In each node:

```python
quant_signal_context = state.get("quant_signal_context", "")
```

Add to prompt:

```text
Rule-based quantitative signal context:
{quant_signal_context}

Use these signals as hard evidence. If your recommendation conflicts with them,
explicitly explain why the LLM-side evidence should override the rule-based signal.
```

**Step 4: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_quant_signal_prompt_injection.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add TradingAgents/tradingagents/agents TradingAgents/tests/test_quant_signal_prompt_injection.py
git commit -m "feat: ground agent prompts in quant signals"
```

---

## Phase 2: Make Signals Tradable

### Task 4: Extend Structured Trade Decision Fields

**Files:**
- Modify: `TradingAgents/tradingagents/agents/schemas.py`
- Modify: `TradingAgents/tradingagents/agents/trader/trader.py`
- Modify: `TradingAgents/tradingagents/agents/managers/portfolio_manager.py`
- Test: `TradingAgents/tests/test_trade_plan_schema.py`

**Step 1: Write failing tests**

```python
from tradingagents.agents.schemas import PortfolioDecision, TraderProposal, render_pm_decision


def test_portfolio_decision_renders_risk_controls():
    decision = PortfolioDecision(
        rating="Buy",
        executive_summary="Constructive setup.",
        investment_thesis="Quant and LLM evidence align.",
        price_target=120.0,
        stop_loss=95.0,
        max_position_pct=0.12,
        holding_period_days=20,
        exit_conditions="Close below MA60.",
    )

    rendered = render_pm_decision(decision)

    assert "Stop Loss" in rendered
    assert "Max Position" in rendered
    assert "Exit Conditions" in rendered
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_trade_plan_schema.py -v
```

Expected: FAIL because fields do not exist.

**Step 3: Add schema fields**

Add to `TraderProposal` and `PortfolioDecision`:

```python
take_profit: Optional[float] = Field(default=None, description="Optional take-profit price.")
holding_period_days: Optional[int] = Field(default=None, ge=1, description="Expected holding period in trading days.")
exit_conditions: Optional[str] = Field(default=None, description="Specific conditions that invalidate the trade.")
max_position_pct: Optional[float] = Field(default=None, ge=0, le=1, description="Maximum portfolio allocation.")
```

Add to `PortfolioDecision`:

```python
stop_loss: Optional[float] = Field(default=None, description="Risk stop price.")
```

Update render helpers to include the fields when present.

**Step 4: Update prompts**

In Trader and Portfolio Manager prompts, add:

```text
When the final action is Buy, Overweight, Underweight, or Sell, provide concrete
risk controls: stop loss, take profit or target, maximum position percentage,
holding period in trading days, and exit conditions. If a field cannot be
computed from available evidence, explain the missing data in reasoning.
```

**Step 5: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_trade_plan_schema.py tests/test_structured_agents.py -v
```

Expected: PASS.

**Step 6: Commit**

```bash
git add TradingAgents/tradingagents/agents/schemas.py TradingAgents/tradingagents/agents/trader/trader.py TradingAgents/tradingagents/agents/managers/portfolio_manager.py TradingAgents/tests/test_trade_plan_schema.py
git commit -m "feat: add structured trade risk controls"
```

---

### Task 5: Compute Benchmark And Industry Excess Returns

**Files:**
- Modify: `TradingAgents/tradingagents/backtest/event_backtester.py`
- Test: `TradingAgents/tests/test_event_backtester.py`

**Step 1: Add failing tests**

Extend event backtester tests to seed `index_bars` and assert `excess_index_20d` is not `None`.

```python
def test_event_backtest_computes_excess_index_return(seed_signal_and_bars):
    result = run_event_backtest(["放量突破"], "2026-01-01", "2026-03-31")
    event = result["events"][0]
    assert event["ret_20d"] is not None
    assert event["excess_index_20d"] is not None
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_event_backtester.py::test_event_backtest_computes_excess_index_return -v
```

Expected: FAIL because excess fields are currently `None`.

**Step 3: Implement benchmark lookup**

Add helpers in `event_backtester.py`:

```python
def _benchmark_symbol_for_market(market: str | None) -> str | None:
    if market == "CHINA":
        return "000300.SH"
    if market == "HONGKONG":
        return "HSI"
    return "SPY"


def _load_index_bars(index_symbol: str) -> pd.DataFrame:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM index_bars WHERE index_symbol = ? ORDER BY date",
            (index_symbol,),
        ).fetchall()
    return pd.DataFrame([dict(row) for row in rows])
```

Compute index return over matching entry and exit dates. If data is missing, keep `None` and set no failure.

**Step 4: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_event_backtester.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add TradingAgents/tradingagents/backtest/event_backtester.py TradingAgents/tests/test_event_backtester.py
git commit -m "feat: compute benchmark excess returns"
```

---

### Task 6: Add ATR-Based Risk Controls To Portfolio Backtest

**Files:**
- Modify: `TradingAgents/tradingagents/backtest/portfolio_backtester.py`
- Test: `TradingAgents/tests/test_portfolio_backtester.py`

**Step 1: Write failing tests**

Add a case where price hits `entry - 2 * atr14` before fixed holding days and assert exit reason is `atr_stop_loss`.

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_portfolio_backtester.py::test_portfolio_backtest_exits_on_atr_stop -v
```

Expected: FAIL because fixed holding period is the only exit.

**Step 3: Implement stop logic**

Before choosing `exit_row = bars.iloc[exit_position]`, inspect the window from entry to fixed exit:

```python
atr = float(entry.get("atr14") or 0)
stop_price = entry_price - 2 * atr if atr > 0 else None
exit_reason = "holding_period_complete"
if stop_price:
    for _, candidate in bars.iloc[entry_position + 1 : exit_position + 1].iterrows():
        if float(candidate["low"]) <= stop_price and is_executable_exit(candidate):
            exit_row = candidate
            exit_price = stop_price
            exit_reason = "atr_stop_loss"
            break
```

Use `exit_reason` in `_insert_trade`.

**Step 4: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_portfolio_backtester.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add TradingAgents/tradingagents/backtest/portfolio_backtester.py TradingAgents/tests/test_portfolio_backtester.py
git commit -m "feat: add atr stop loss to portfolio backtest"
```

---

### Task 7: Add Sharpe, Sortino, Calmar, And Information Metrics

**Files:**
- Modify: `TradingAgents/tradingagents/backtest/metrics.py`
- Modify: `TradingAgents/tradingagents/backtest/portfolio_backtester.py`
- Test: `TradingAgents/tests/test_backtest_metrics.py`

**Step 1: Write failing tests**

```python
from tradingagents.backtest.metrics import summarize_equity_curve


def test_summarize_equity_curve_computes_risk_adjusted_metrics():
    rows = [
        {"date": "2026-01-01", "equity": 100.0, "drawdown": 0.0},
        {"date": "2026-01-02", "equity": 101.0, "drawdown": 0.0},
        {"date": "2026-01-03", "equity": 99.0, "drawdown": -0.02},
        {"date": "2026-01-04", "equity": 103.0, "drawdown": 0.0},
    ]
    metrics = summarize_equity_curve(rows)
    assert "sharpe" in metrics
    assert "sortino" in metrics
    assert "calmar" in metrics
    assert metrics["max_drawdown"] == -0.02
```

**Step 2: Run test to verify it fails**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_backtest_metrics.py -v
```

Expected: FAIL because `summarize_equity_curve` does not exist.

**Step 3: Implement metrics**

Add daily return based metrics with defensive zero-division handling. Keep risk-free rate at 0 for now.

**Step 4: Wire into portfolio backtest**

Return these metrics in `run_portfolio_backtest`.

**Step 5: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_backtest_metrics.py tests/test_portfolio_backtester.py -v
```

Expected: PASS.

**Step 6: Commit**

```bash
git add TradingAgents/tradingagents/backtest/metrics.py TradingAgents/tradingagents/backtest/portfolio_backtester.py TradingAgents/tests/test_backtest_metrics.py
git commit -m "feat: add risk adjusted backtest metrics"
```

---

## Phase 3: Strategy Iteration Loop

### Task 8: Add Parameter Sweep Executor

**Files:**
- Modify: `TradingAgents/tradingagents/optimizer/parameter_sweep.py`
- Test: `TradingAgents/tests/test_strategy_optimizer.py`

**Step 1: Write failing tests**

Assert a small grid calls a supplied backtest function for every parameter combination and returns ranked results.

**Step 2: Implement executor**

```python
from itertools import product


def iter_parameter_grid(grid=PARAMETER_GRID):
    keys = list(grid)
    for values in product(*(grid[key] for key in keys)):
        yield dict(zip(keys, values))


def run_parameter_sweep(start, end, backtest_fn, grid=PARAMETER_GRID, score_key="sharpe"):
    results = []
    for params in iter_parameter_grid(grid):
        result = backtest_fn(start=start, end=end, params=params)
        metrics = result.get("metrics", {})
        results.append({"params": params, "metrics": metrics, "score": metrics.get(score_key, 0.0)})
    return sorted(results, key=lambda item: item["score"], reverse=True)
```

**Step 3: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_strategy_optimizer.py -v
```

Expected: PASS.

**Step 4: Commit**

```bash
git add TradingAgents/tradingagents/optimizer/parameter_sweep.py TradingAgents/tests/test_strategy_optimizer.py
git commit -m "feat: add parameter sweep executor"
```

---

### Task 9: Add Walk-Forward Orchestrator

**Files:**
- Modify: `TradingAgents/tradingagents/optimizer/walk_forward.py`
- Test: `TradingAgents/tests/test_strategy_optimizer.py`

**Step 1: Write failing test**

Assert `run_walk_forward` loops over folds, passes train ranges to `sweep_fn`, test ranges to `backtest_fn`, and returns aggregate OOS metrics.

**Step 2: Implement orchestrator**

```python
def run_walk_forward(start: str, end: str, sweep_fn, backtest_fn, folds: int = 3) -> dict:
    periods = split_walk_forward_periods(start, end, folds)
    fold_results = []
    for period in periods:
        ranked = sweep_fn(period["train_start"], period["train_end"])
        best = ranked[0] if ranked else {"params": {}}
        oos = backtest_fn(period["test_start"], period["test_end"], best["params"])
        fold_results.append({"period": period, "best_params": best["params"], "oos": oos})
    return {"folds": fold_results, "fold_count": len(fold_results)}
```

**Step 3: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_strategy_optimizer.py -v
```

Expected: PASS.

**Step 4: Commit**

```bash
git add TradingAgents/tradingagents/optimizer/walk_forward.py TradingAgents/tests/test_strategy_optimizer.py
git commit -m "feat: add walk forward optimizer loop"
```

---

### Task 10: Add End-To-End Research Pipeline

**Files:**
- Create: `TradingAgents/tradingagents/research/pipeline.py`
- Modify: `TradingAgents/tradingagents/research/cli.py`
- Test: `TradingAgents/tests/test_research_pipeline.py`

**Step 1: Write failing test**

Use monkeypatched functions and assert the pipeline runs in the right order:

1. sync bars
2. compute factors
3. scan signals
4. persist signals
5. event backtest
6. portfolio backtest
7. diagnostics

**Step 2: Implement pipeline**

```python
def run_pipeline(start: str, end: str, signal_date: str | None = None) -> dict:
    signal_date = signal_date or end
    rows_synced = sync_watchlist_bars(start, end)
    factor_rows = compute_watchlist_factors(start, end)
    signals = scan_watchlist(signal_date)
    persist_signals(signals)
    event_result = run_event_backtest(None, start, end)
    portfolio_result = run_portfolio_backtest(start, end)
    summary = summarize_signal_effectiveness()
    return {
        "rows_synced": rows_synced,
        "factor_rows": factor_rows,
        "signal_count": len(signals),
        "event_backtest": event_result,
        "portfolio_backtest": portfolio_result,
        "summary": summary,
    }
```

**Step 3: Add CLI command**

In `research/cli.py`, add:

```bash
python -m tradingagents.research.cli run-pipeline --start 2026-01-01 --end 2026-05-12
```

**Step 4: Run tests**

Run:

```bash
cd TradingAgents
python -m pytest tests/test_research_pipeline.py tests/test_research_cli.py -v
```

Expected: PASS.

**Step 5: Commit**

```bash
git add TradingAgents/tradingagents/research/pipeline.py TradingAgents/tradingagents/research/cli.py TradingAgents/tests/test_research_pipeline.py TradingAgents/tests/test_research_cli.py
git commit -m "feat: add research strategy pipeline"
```

---

## Phase 4: A/H Market Edge

### Task 11: Add A-Share Fund Flow Data

**Files:**
- Create: `TradingAgents/tradingagents/dataflows/fund_flow.py`
- Modify: `TradingAgents/tradingagents/research/db.py`
- Modify: `TradingAgents/tradingagents/research/factor_pipeline.py`
- Test: `TradingAgents/tests/test_fund_flow_features.py`

**Implementation Notes:**
- Use AKShare/Tushare wrappers already present in `dataflows`.
- Add table `fund_flow_daily(date, symbol, main_net_inflow, large_net_inflow, northbound_net_inflow, updated_at)`.
- Add factor fields: `main_net_inflow_ratio20`, `northbound_inflow_5d`.
- Do not block the base pipeline if fund-flow data is unavailable; log a data quality issue and continue.

**Verification:**

```bash
cd TradingAgents
python -m pytest tests/test_fund_flow_features.py tests/test_research_data_sync.py -v
```

**Commit:**

```bash
git add TradingAgents/tradingagents/dataflows/fund_flow.py TradingAgents/tradingagents/research/db.py TradingAgents/tradingagents/research/factor_pipeline.py TradingAgents/tests/test_fund_flow_features.py
git commit -m "feat: add fund flow factors"
```

---

### Task 12: Upgrade Regime Detection

**Files:**
- Modify: `TradingAgents/tradingagents/research/features/market_state.py`
- Modify: `TradingAgents/tradingagents/research/signals/scanner.py`
- Test: `TradingAgents/tests/test_market_regime.py`

**Implementation Notes:**
- Replace `ret20`-only classification with multi-input state:
  - `bull_trend`
  - `bear_trend`
  - `range_bound`
  - `high_volatility`
  - `low_volatility`
- Inputs: MA alignment, MA60 slope, ATR percentile, ret20, market breadth when available.
- Store regime on each signal and later in performance tables.

**Verification:**

```bash
cd TradingAgents
python -m pytest tests/test_market_regime.py tests/test_signal_scanner.py -v
```

**Commit:**

```bash
git add TradingAgents/tradingagents/research/features/market_state.py TradingAgents/tradingagents/research/signals/scanner.py TradingAgents/tests/test_market_regime.py
git commit -m "feat: add market regime aware signals"
```

---

## Final Verification

Run after every phase:

```bash
cd TradingAgents
python -m compileall -q tradingagents cli main.py test.py
python -m pytest tests/test_signal_context.py tests/test_quant_context_node.py tests/test_quant_signal_prompt_injection.py tests/test_trade_plan_schema.py -v
```

Run after all phases:

```bash
cd TradingAgents
python -m pytest -q
cd frontend
npm ci
npm run build
```

If dependency installation is missing locally, first run:

```bash
cd TradingAgents
uv sync --extra china
cd frontend
npm ci
```

---

## Acceptance Criteria

The implementation is complete when:

1. Running the LLM analysis graph loads `quant_signals` and `quant_signal_context` into state.
2. Bull/Bear, Research Manager, Trader, and Portfolio Manager prompts include quant context.
3. Final Portfolio Manager output includes concrete risk controls when action is directional.
4. Event backtest computes benchmark excess return when index data exists.
5. Portfolio backtest supports ATR stop exits and reports risk-adjusted metrics.
6. Parameter sweep and walk-forward loops execute end to end with tests.
7. A single pipeline command can run sync, factors, scan, backtest, and diagnostics.

---

## Recommended Commit Sequence

1. `feat: add quant signal context loader`
2. `feat: inject quant signal context into graph state`
3. `feat: ground agent prompts in quant signals`
4. `feat: add structured trade risk controls`
5. `feat: compute benchmark excess returns`
6. `feat: add atr stop loss to portfolio backtest`
7. `feat: add risk adjusted backtest metrics`
8. `feat: add parameter sweep executor`
9. `feat: add walk forward optimizer loop`
10. `feat: add research strategy pipeline`
11. `feat: add fund flow factors`
12. `feat: add market regime aware signals`

