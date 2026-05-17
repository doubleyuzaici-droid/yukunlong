from __future__ import annotations

import math

import pandas as pd

from tradingagents.backtest.cost_model import estimate_cost
from tradingagents.backtest.execution_model import is_executable_entry, is_executable_exit
from tradingagents.backtest.metrics import summarize_equity_curve
from tradingagents.markets import Market, detect_market
from tradingagents.research.db import get_connection, init_db
from tradingagents.research.index_catalog import is_supported_index_symbol, resolve_index_profile
from tradingagents.research.market_data import normalize_market_symbol
from tradingagents.research.repository import load_daily_bars, load_index_bars
from tradingagents.strategies.resonance_v2 import analyze_resonance_v2, resolve_benchmark_symbol


def _market_name(symbol: str) -> str:
    index_profile = resolve_index_profile(symbol)
    if index_profile:
        return index_profile.market
    market = detect_market(symbol)
    if market == Market.CHINA:
        return "CHINA"
    if market == Market.HONGKONG:
        return "HONGKONG"
    return "US"


def _lot_size(symbol: str) -> int:
    index_profile = resolve_index_profile(symbol)
    if index_profile and index_profile.market != "CHINA":
        return 1
    return 100 if detect_market(symbol) == Market.CHINA else 1


def _round_lot(quantity: float, lot_size: int) -> int:
    if not math.isfinite(quantity) or quantity <= 0:
        return 0
    return int(quantity // lot_size * lot_size)


def _load_index_bars(index_symbol: str, start: str, end: str) -> pd.DataFrame:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM index_bars
            WHERE index_symbol = ? AND date >= ? AND date <= ?
            ORDER BY date
            """,
            (index_symbol, start, end),
        ).fetchall()
    return pd.DataFrame([dict(row) for row in rows])


def _build_benchmark_curve(
    equity_curve: list[dict],
    benchmark_symbol: str,
    start: str,
    end: str,
    initial_cash: float,
) -> dict:
    bars = _load_index_bars(benchmark_symbol, start, end)
    if bars.empty or not equity_curve:
        return {"symbol": benchmark_symbol, "status": "missing", "coverage": 0.0, "curve": []}

    bars = bars.dropna(subset=["close"]).sort_values("date")
    first_close: float | None = None
    curve = []
    first_equity = float(equity_curve[0].get("equity") or initial_cash)
    for row in equity_curve:
        matched = bars[bars["date"] <= row["date"]]
        if matched.empty:
            continue
        close = float(matched.iloc[-1]["close"])
        if close <= 0 or not math.isfinite(close):
            continue
        if first_close is None:
            first_close = close
        benchmark_return = close / first_close - 1
        strategy_return = float(row["equity"]) / first_equity - 1 if first_equity else 0.0
        curve.append(
            {
                "date": row["date"],
                "benchmark_symbol": benchmark_symbol,
                "benchmark_equity": initial_cash * (1 + benchmark_return),
                "benchmark_return": benchmark_return,
                "strategy_return": strategy_return,
                "excess_return": strategy_return - benchmark_return,
            }
        )
    coverage = len(curve) / len(equity_curve) if equity_curve else 0.0
    status = "matched" if coverage >= 0.8 else ("partial" if curve else "missing")
    return {"symbol": benchmark_symbol, "status": status, "coverage": coverage, "curve": curve}


def _benchmark_returns(curve: list[dict], equity_curve: list[dict]) -> list[float] | None:
    if len(curve) != len(equity_curve) or len(curve) < 2:
        return None
    values = [float(row["benchmark_equity"]) for row in curve]
    return [
        values[index] / values[index - 1] - 1 if values[index - 1] else 0.0
        for index in range(1, len(values))
    ]


def _action_counts(signals: list[dict]) -> dict[str, int]:
    counts: dict[str, int] = {}
    for signal in signals:
        action = str(signal.get("action") or "unknown")
        counts[action] = counts.get(action, 0) + 1
    return counts


def _no_trade_reasons(signals: list[dict], trades: list[dict], mode: str) -> list[str]:
    if trades:
        return []
    if not signals:
        return ["样本不足或预热窗口内无可评估信号，未生成交易。"]
    counts = _action_counts(signals)
    reasons: list[str] = []
    buy_allowed_count = counts.get("buy_allowed", 0)
    if buy_allowed_count == 0:
        reasons.append(f"{mode} 模式回测区间未出现 buy_allowed 入场信号。")
    else:
        reasons.append(f"出现 {buy_allowed_count} 次 buy_allowed，但后续可执行检查或仓位取整未形成成交。")
    risk_count = counts.get("reduce", 0) + counts.get("exit", 0)
    if risk_count:
        reasons.append(f"区间内出现 {risk_count} 次风险/减仓信号，策略保持防守。")
    if counts.get("buy_watch", 0):
        reasons.append("存在观察型机会，但未满足正式入场和可执行仓位约束。")
    return reasons or ["未成交原因需要结合信号明细进一步复核。"]


def run_resonance_v2_backtest(
    symbol: str,
    start: str,
    end: str,
    *,
    mode: str = "aggressive",
    initial_cash: float = 1_000_000,
    risk_pct: float = 0.01,
) -> dict:
    init_db()
    normalized = normalize_market_symbol(symbol)
    asset_type = "index" if is_supported_index_symbol(normalized) else "equity"
    market = _market_name(normalized)
    bars = (
        load_index_bars(normalized, start, end)
        if asset_type == "index"
        else load_daily_bars(normalized, start, end)
    )
    if bars.empty:
        zero_trade_reasons = [
            "缺少指数日线数据，无法生成回测交易。"
            if asset_type == "index"
            else "缺少个股日线数据，无法生成回测交易。"
        ]
        return {
            "strategy_version": f"resonance_v2_{mode}",
            "symbol": normalized,
            "asset_type": asset_type,
            "start": start,
            "end": end,
            "zero_trade_reasons": zero_trade_reasons,
            "metrics": {
                "initial_cash": initial_cash,
                "final_equity": initial_cash,
                "total_return": 0.0,
                "max_drawdown": 0.0,
                "trade_count": 0,
                "round_trip_count": 0,
                "order_count": 0,
                "win_rate": 0.0,
                "signal_count": 0,
            },
            "signals": [],
            "equity_curve": [],
            "benchmark_curve": [],
            "trades": [],
            "position_lifecycle": [],
            "data_quality": {
                "blocking_reasons": [
                    "缺少指数日线数据" if asset_type == "index" else "缺少个股日线数据"
                ],
                "no_trade_reasons": zero_trade_reasons,
            },
        }

    bars = bars.sort_values("date").reset_index(drop=True).copy()
    for column in ["open", "high", "low", "close", "volume", "amount"]:
        bars[column] = pd.to_numeric(bars[column], errors="coerce")
    bars = bars.dropna(subset=["open", "high", "low", "close"]).reset_index(drop=True)

    cash = float(initial_cash)
    quantity = 0
    entry_price = 0.0
    entry_date: str | None = None
    peak_equity = float(initial_cash)
    pending_order: dict | None = None
    equity_curve: list[dict] = []
    trades: list[dict] = []
    lifecycle: list[dict] = []
    signals: list[dict] = []
    trade_returns: list[float] = []
    lot_size = _lot_size(normalized)

    for index, row in bars.iterrows():
        trade_date = row["date"]
        open_price = float(row["open"])
        close_price = float(row["close"])

        if pending_order and pending_order["side"] == "entry" and is_executable_entry(row):
            suggested = _round_lot(float(pending_order.get("quantity") or 0), lot_size)
            affordable = _round_lot(cash / max(open_price * 1.01, 0.01), lot_size)
            entry_quantity = min(suggested, affordable)
            if entry_quantity > 0:
                notional = entry_quantity * open_price
                cost = estimate_cost(market, "entry", notional)
                if cash >= notional + cost:
                    cash -= notional + cost
                    quantity += entry_quantity
                    entry_price = open_price
                    entry_date = trade_date
                    trades.append(
                        {
                            "side": "entry",
                            "date": trade_date,
                            "price": open_price,
                            "quantity": entry_quantity,
                            "cost": cost,
                            "reason": pending_order.get("reason", "buy_allowed"),
                        }
                    )
        elif pending_order and pending_order["side"] == "exit" and quantity > 0 and is_executable_exit(row):
            exit_quantity = quantity
            if pending_order.get("action") == "reduce":
                exit_quantity = _round_lot(max(lot_size, quantity / 2), lot_size)
                exit_quantity = min(exit_quantity, quantity)
            notional = exit_quantity * open_price
            cost = estimate_cost(market, "exit", notional)
            cash += notional - cost
            trades.append(
                {
                    "side": "exit",
                    "date": trade_date,
                    "price": open_price,
                    "quantity": exit_quantity,
                    "cost": cost,
                    "reason": pending_order.get("reason", "exit"),
                }
            )
            if entry_date and entry_price > 0:
                net_return = (open_price - entry_price) / entry_price
                trade_returns.append(net_return)
                lifecycle.append(
                    {
                        "symbol": normalized,
                        "market": market,
                        "entry_date": entry_date,
                        "exit_date": trade_date,
                        "entry_price": entry_price,
                        "exit_price": open_price,
                        "quantity": exit_quantity,
                        "net_return": net_return,
                        "exit_reason": pending_order.get("reason", "exit"),
                    }
                )
            quantity -= exit_quantity
            if quantity <= 0:
                quantity = 0
                entry_price = 0.0
                entry_date = None
        pending_order = None

        positions_value = quantity * close_price
        equity = cash + positions_value
        peak_equity = max(peak_equity, equity)
        drawdown = equity / peak_equity - 1 if peak_equity else 0.0
        equity_curve.append(
            {
                "date": trade_date,
                "equity": equity,
                "cash": cash,
                "positions_value": positions_value,
                "drawdown": drawdown,
                "position_shares": quantity,
            }
        )

        if index < 89 or index >= len(bars) - 1:
            continue

        analysis = analyze_resonance_v2(
            normalized,
            start,
            trade_date,
            mode=mode,
            capital=max(equity, 0.0),
            risk_pct=risk_pct,
        )
        decision = analysis.get("decision") or {}
        action = decision.get("action", "observe")
        signals.append(
            {
                "date": trade_date,
                "action": action,
                "label": decision.get("label"),
                "buy_score": (analysis.get("buy_signal") or {}).get("score"),
                "sell_score": (analysis.get("sell_signal") or {}).get("score"),
                "position_shares": quantity,
            }
        )
        stop_price = (analysis.get("price_channels") or {}).get("stop_price")
        stop_triggered = bool(quantity > 0 and stop_price is not None and close_price <= float(stop_price))
        if quantity <= 0 and action == "buy_allowed":
            suggested_quantity = (analysis.get("position_plan") or {}).get("suggested_shares") or 0
            if suggested_quantity <= 0:
                suggested_quantity = _round_lot(equity * 0.25 / close_price, lot_size)
            pending_order = {
                "side": "entry",
                "quantity": suggested_quantity,
                "reason": decision.get("label", "buy_allowed"),
            }
        elif quantity > 0 and (action in {"reduce", "exit"} or stop_triggered):
            pending_order = {
                "side": "exit",
                "action": "exit" if stop_triggered else action,
                "reason": "stop_price" if stop_triggered else decision.get("label", action),
            }

    final_equity = equity_curve[-1]["equity"] if equity_curve else initial_cash
    benchmark_symbol, benchmark_reason = resolve_benchmark_symbol(normalized)
    benchmark = _build_benchmark_curve(equity_curve, benchmark_symbol, start, end, initial_cash)
    extra_metrics = summarize_equity_curve(equity_curve, _benchmark_returns(benchmark["curve"], equity_curve))
    benchmark_total_return = benchmark["curve"][-1]["benchmark_return"] if benchmark["curve"] else 0.0
    wins = [value for value in trade_returns if value > 0]
    zero_trade_reasons = _no_trade_reasons(signals, trades, mode)
    return {
        "strategy_version": f"resonance_v2_{mode}",
        "symbol": normalized,
        "asset_type": asset_type,
        "start": start,
        "end": end,
        "mode": mode,
        "zero_trade_reasons": zero_trade_reasons,
        "metrics": {
            "initial_cash": initial_cash,
            "final_equity": final_equity,
            "total_return": final_equity / initial_cash - 1 if initial_cash else 0.0,
            "max_drawdown": min((row["drawdown"] for row in equity_curve), default=0.0),
            "trade_count": len(lifecycle),
            "round_trip_count": len(lifecycle),
            "order_count": len(trades),
            "win_rate": len(wins) / len(trade_returns) if trade_returns else 0.0,
            "signal_count": len(signals),
            "sharpe": extra_metrics["sharpe"],
            "sortino": extra_metrics["sortino"],
            "calmar": extra_metrics["calmar"],
            "information_ratio": extra_metrics["information_ratio"],
            "benchmark_symbol": benchmark_symbol,
            "benchmark_reason": benchmark_reason,
            "benchmark_total_return": benchmark_total_return,
            "benchmark_coverage": benchmark["coverage"],
            "excess_return": final_equity / initial_cash - 1 - benchmark_total_return
            if initial_cash
            else 0.0,
        },
        "signals": signals,
        "equity_curve": equity_curve,
        "benchmark_curve": benchmark["curve"],
        "trades": trades,
        "position_lifecycle": lifecycle,
        "data_quality": {
            "bar_count": len(bars),
            "benchmark_status": benchmark["status"],
            "action_counts": _action_counts(signals),
            "no_trade_reasons": zero_trade_reasons,
        },
    }
