from __future__ import annotations

import math
from datetime import datetime, timezone

import pandas as pd

from tradingagents.backtest.cost_model import estimate_cost
from tradingagents.backtest.metrics import summarize_equity_curve
from tradingagents.backtest.execution_model import (
    is_executable_entry,
    is_executable_exit,
)
from tradingagents.research.features.liquidity import avg_amount, is_low_liquidity
from tradingagents.research.db import get_connection, init_db


def _now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _load_entry_signals(start: str, end: str) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT *
            FROM signal_log
            WHERE date >= ? AND date <= ?
              AND direction = 'opportunity'
              AND signal_level IN ('S', 'A')
            ORDER BY date, score DESC
            """,
            (start, end),
        ).fetchall()
    return [dict(row) for row in rows]


def _load_bars(symbol: str) -> pd.DataFrame:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT * FROM daily_bars WHERE symbol = ? ORDER BY date",
            (symbol,),
        ).fetchall()
    return pd.DataFrame([dict(row) for row in rows])


def _benchmark_symbol_for_market(market: str | None) -> str:
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


def _load_atr14(symbol: str, trade_date: str) -> float | None:
    with get_connection() as conn:
        row = conn.execute(
            "SELECT atr14 FROM factor_daily WHERE symbol = ? AND date = ?",
            (symbol, trade_date),
        ).fetchone()
    if not row:
        return None
    value = row["atr14"]
    if value is None or pd.isna(value):
        return None
    return float(value)


def _is_low_liquidity_entry(bars: pd.DataFrame, entry_position: int, market: str) -> bool:
    history = bars.iloc[max(0, entry_position - 20) : entry_position]
    return is_low_liquidity(market, avg_amount(history))


def _insert_trade(
    trade_id: str,
    strategy_version: str,
    symbol: str,
    market: str,
    side: str,
    date: str,
    price: float,
    quantity: float,
    cost: float,
    reason: str,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO trade_log (
                trade_id, strategy_version, symbol, market, side, date,
                price, quantity, cost, reason, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                trade_id,
                strategy_version,
                symbol,
                market,
                side,
                date,
                price,
                quantity,
                cost,
                reason,
                _now(),
            ),
        )
        conn.commit()


def _insert_equity(
    strategy_version: str,
    date: str,
    equity: float,
    cash: float,
    positions_value: float = 0.0,
    drawdown: float = 0.0,
) -> None:
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO equity_curve (
                strategy_version, date, equity, cash, positions_value, drawdown
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (strategy_version, date, equity, cash, positions_value, drawdown),
        )
        conn.commit()


def _summarize_lifecycle(lifecycle: list[dict]) -> tuple[list[dict], list[dict]]:
    by_symbol: dict[str, dict] = {}
    by_market: dict[str, dict] = {}
    for row in lifecycle:
        symbol_bucket = by_symbol.setdefault(
            row["symbol"],
            {
                "symbol": row["symbol"],
                "market": row["market"],
                "trade_count": 0,
                "win_count": 0,
                "net_pnl": 0.0,
                "total_cost": 0.0,
                "capital_used": 0.0,
                "return_sum": 0.0,
            },
        )
        symbol_bucket["trade_count"] += 1
        symbol_bucket["win_count"] += 1 if row["net_return"] > 0 else 0
        symbol_bucket["net_pnl"] += row["net_pnl"]
        symbol_bucket["total_cost"] += row["entry_cost"] + row["exit_cost"]
        symbol_bucket["capital_used"] += row["entry_notional"]
        symbol_bucket["return_sum"] += row["net_return"]

        market_bucket = by_market.setdefault(
            row["market"],
            {"market": row["market"], "position_count": 0, "capital_used": 0.0, "net_pnl": 0.0},
        )
        market_bucket["position_count"] += 1
        market_bucket["capital_used"] += row["entry_notional"]
        market_bucket["net_pnl"] += row["net_pnl"]

    attribution = []
    for bucket in by_symbol.values():
        trade_count = bucket["trade_count"]
        attribution.append(
            {
                **bucket,
                "win_rate": bucket["win_count"] / trade_count if trade_count else 0.0,
                "avg_return": bucket["return_sum"] / trade_count if trade_count else 0.0,
            }
        )
    total_capital = sum(bucket["capital_used"] for bucket in by_market.values())
    exposures = [
        {
            **bucket,
            "capital_share": bucket["capital_used"] / total_capital if total_capital else 0.0,
        }
        for bucket in by_market.values()
    ]
    attribution.sort(key=lambda item: item["net_pnl"], reverse=True)
    exposures.sort(key=lambda item: item["capital_used"], reverse=True)
    return attribution, exposures


def _dominant_market(lifecycle: list[dict], requested_markets: list[str]) -> str | None:
    counts: dict[str, int] = {}
    for row in lifecycle:
        market = row.get("market")
        if market:
            counts[market] = counts.get(market, 0) + 1
    if counts:
        return sorted(counts.items(), key=lambda item: item[1], reverse=True)[0][0]
    return requested_markets[0] if requested_markets else None


def _build_benchmark_curve(
    equity_rows: list[dict], market: str | None, initial_cash: float
) -> dict:
    benchmark_symbol = _benchmark_symbol_for_market(market)
    if not equity_rows:
        return {
            "symbol": benchmark_symbol,
            "status": "missing",
            "coverage": 0.0,
            "curve": [],
        }

    bars = _load_index_bars(benchmark_symbol)
    if bars.empty:
        return {
            "symbol": benchmark_symbol,
            "status": "missing",
            "coverage": 0.0,
            "curve": [],
        }

    bars = bars.dropna(subset=["close"]).sort_values("date")
    curve = []
    first_close: float | None = None
    first_equity = float(equity_rows[0].get("equity") or initial_cash)
    for equity_row in equity_rows:
        matched = bars[bars["date"] <= equity_row["date"]]
        if matched.empty:
            continue
        close = float(matched.iloc[-1]["close"])
        if close <= 0 or not math.isfinite(close):
            continue
        if first_close is None:
            first_close = close
        benchmark_return = close / first_close - 1
        strategy_return = (
            float(equity_row.get("equity") or 0.0) / first_equity - 1
            if first_equity
            else 0.0
        )
        curve.append(
            {
                "date": equity_row["date"],
                "benchmark_symbol": benchmark_symbol,
                "benchmark_equity": initial_cash * (1 + benchmark_return),
                "benchmark_return": benchmark_return,
                "strategy_return": strategy_return,
                "excess_return": strategy_return - benchmark_return,
            }
        )

    coverage = len(curve) / len(equity_rows) if equity_rows else 0.0
    if not curve:
        status = "missing"
    elif coverage >= 0.8:
        status = "matched"
    else:
        status = "partial"
    return {
        "symbol": benchmark_symbol,
        "status": status,
        "coverage": coverage,
        "curve": curve,
    }


def _benchmark_returns(curve: list[dict], equity_rows: list[dict]) -> list[float] | None:
    if len(curve) != len(equity_rows) or len(curve) < 2:
        return None
    values = [float(row["benchmark_equity"]) for row in curve]
    return [
        values[index] / values[index - 1] - 1 if values[index - 1] else 0.0
        for index in range(1, len(values))
    ]


def _return_distribution(trade_returns: list[float]) -> dict:
    buckets = [
        {"label": "<=-10%", "min": -math.inf, "max": -0.10, "count": 0},
        {"label": "-10%~-5%", "min": -0.10, "max": -0.05, "count": 0},
        {"label": "-5%~0%", "min": -0.05, "max": 0.0, "count": 0},
        {"label": "0~5%", "min": 0.0, "max": 0.05, "count": 0},
        {"label": "5%~10%", "min": 0.05, "max": 0.10, "count": 0},
        {"label": ">10%", "min": 0.10, "max": math.inf, "count": 0},
    ]
    for value in trade_returns:
        for bucket in buckets:
            if bucket["min"] <= value < bucket["max"] or (
                math.isinf(bucket["max"]) and value >= bucket["min"]
            ):
                bucket["count"] += 1
                break

    wins = [value for value in trade_returns if value > 0]
    losses = [value for value in trade_returns if value < 0]
    average_win = float(pd.Series(wins).mean()) if wins else 0.0
    average_loss = float(pd.Series(losses).mean()) if losses else 0.0
    payoff_ratio = (
        average_win / abs(average_loss)
        if average_loss < 0
        else (None if average_win > 0 else 0.0)
    )
    clean_buckets = [
        {"label": bucket["label"], "count": bucket["count"]} for bucket in buckets
    ]
    series = pd.Series(trade_returns, dtype="float64")
    return {
        "total_count": len(trade_returns),
        "win_count": len(wins),
        "loss_count": len(losses),
        "average_return": float(series.mean()) if not series.empty else 0.0,
        "median_return": float(series.median()) if not series.empty else 0.0,
        "best_return": float(series.max()) if not series.empty else 0.0,
        "worst_return": float(series.min()) if not series.empty else 0.0,
        "average_win": average_win,
        "average_loss": average_loss,
        "payoff_ratio": payoff_ratio,
        "buckets": clean_buckets,
    }


def _monthly_returns(equity_rows: list[dict]) -> list[dict]:
    by_month: dict[str, dict] = {}
    for row in equity_rows:
        month = row["date"][:7]
        bucket = by_month.setdefault(month, {"first": row["equity"], "last": row["equity"]})
        bucket["last"] = row["equity"]
    return [
        {
            "month": month,
            "return": value["last"] / value["first"] - 1 if value["first"] else 0.0,
        }
        for month, value in sorted(by_month.items())
    ]


def _longest_drawdown_points(equity_rows: list[dict]) -> int:
    longest = 0
    current = 0
    for row in equity_rows:
        if (row.get("drawdown") or 0.0) < 0:
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest


def _risk_diagnostics(
    equity_rows: list[dict],
    trade_rows: list[dict],
    trade_returns: list[float],
    capital_usage_rows: list[dict],
    benchmark_status: str,
) -> dict:
    total_cost = sum(float(row.get("cost") or 0.0) for row in trade_rows)
    final_equity = float(equity_rows[-1]["equity"]) if equity_rows else 0.0
    trade_return_std = (
        float(pd.Series(trade_returns, dtype="float64").std(ddof=0))
        if len(trade_returns) > 1
        else 0.0
    )
    return {
        "monthly_returns": _monthly_returns(equity_rows),
        "longest_drawdown_points": _longest_drawdown_points(equity_rows),
        "exposure_peak_pct": max(
            (float(row.get("capital_used_pct") or 0.0) for row in capital_usage_rows),
            default=0.0,
        ),
        "cost_to_equity_pct": total_cost / final_equity if final_equity else 0.0,
        "trade_return_stdev": trade_return_std,
        "benchmark_status": benchmark_status,
    }


def run_portfolio_backtest(
    start: str,
    end: str,
    strategy_version: str = "portfolio_v1",
    initial_cash: float = 1_000_000,
    holding_days: int = 20,
    slippage_bps: float = 2.0,
    max_position_pct: float = 0.10,
) -> dict:
    init_db()
    cash = initial_cash
    trade_count = 0
    peak_equity = initial_cash
    drawdowns = [0.0]
    equity_rows = [{"date": start, "equity": cash, "drawdown": 0.0}]
    trade_rows = []
    lifecycle_rows = []
    skipped_trades = []
    capital_usage_rows = [{"date": start, "cash": cash, "positions_value": 0.0, "capital_used_pct": 0.0}]
    trade_returns: list[float] = []
    _insert_equity(strategy_version, start, cash, cash)

    signals = _load_entry_signals(start, end)
    requested_markets = [signal["market"] for signal in signals if signal.get("market")]
    for signal in signals:
        bars = _load_bars(signal["symbol"])
        signal_positions = bars.index[bars["date"] == signal["date"]]
        if len(signal_positions) == 0:
            skipped_trades.append(
                {
                    "signal_id": signal["signal_id"],
                    "symbol": signal["symbol"],
                    "date": signal["date"],
                    "reason": "missing_signal_bar",
                }
            )
            continue
        entry_position = int(signal_positions[0]) + 1
        exit_position = entry_position + holding_days
        if exit_position >= len(bars):
            skipped_trades.append(
                {
                    "signal_id": signal["signal_id"],
                    "symbol": signal["symbol"],
                    "date": signal["date"],
                    "reason": "insufficient_future_bars",
                }
            )
            continue
        entry = bars.iloc[entry_position]
        exit_row = bars.iloc[exit_position]
        exit_reason = "holding_period_complete"
        if _is_low_liquidity_entry(bars, entry_position, signal["market"]):
            skipped_trades.append(
                {
                    "signal_id": signal["signal_id"],
                    "symbol": signal["symbol"],
                    "date": entry["date"],
                    "reason": "low_liquidity",
                }
            )
            continue
        if not is_executable_entry(entry) or not is_executable_exit(exit_row):
            skipped_trades.append(
                {
                    "signal_id": signal["signal_id"],
                    "symbol": signal["symbol"],
                    "date": entry["date"],
                    "reason": "execution_blocked_limit_or_suspend",
                }
            )
            continue

        entry_price = float(entry["open"])
        atr = _load_atr14(signal["symbol"], entry["date"]) or 0.0
        stop_price = entry_price - 2 * atr if atr > 0 else None
        allocation = min(cash, initial_cash * max_position_pct)
        if allocation <= 0:
            skipped_trades.append(
                {
                    "signal_id": signal["signal_id"],
                    "symbol": signal["symbol"],
                    "date": entry["date"],
                    "reason": "insufficient_cash",
                }
            )
            continue
        quantity = allocation / entry_price
        entry_notional = quantity * entry_price
        entry_fee = estimate_cost(signal["market"], "entry", entry_notional)
        entry_slippage = entry_notional * slippage_bps / 10_000
        entry_cost = entry_fee + entry_slippage
        cash -= entry_notional + entry_cost
        capital_usage_rows.append(
            {
                "date": entry["date"],
                "cash": cash,
                "positions_value": entry_notional,
                "capital_used_pct": entry_notional / initial_cash if initial_cash else 0.0,
                "symbol": signal["symbol"],
                "event": "entry",
            }
        )
        _insert_trade(
            f"{signal['signal_id']}-entry",
            strategy_version,
            signal["symbol"],
            signal["market"],
            "entry",
            entry["date"],
            entry_price,
            quantity,
            entry_cost,
            signal["signal_name"],
        )
        trade_rows.append(
            {
                "trade_id": f"{signal['signal_id']}-entry",
                "strategy_version": strategy_version,
                "symbol": signal["symbol"],
                "market": signal["market"],
                "side": "entry",
                "date": entry["date"],
                "price": entry_price,
                "quantity": quantity,
                "cost": entry_cost,
                "cost_breakdown": {
                    "commission_tax": entry_fee,
                    "slippage": entry_slippage,
                    "total": entry_cost,
                },
                "reason": signal["signal_name"],
            }
        )
        trade_count += 1

        if stop_price is not None:
            for _, candidate in bars.iloc[entry_position + 1 : exit_position + 1].iterrows():
                if float(candidate["low"]) <= stop_price and is_executable_exit(candidate):
                    exit_row = candidate
                    exit_reason = "atr_stop_loss"
                    break

        if exit_reason == "atr_stop_loss" and stop_price is not None:
            candidate_open = float(exit_row["open"])
            exit_price = min(stop_price, candidate_open)
        else:
            exit_price = float(exit_row["open"])
        exit_notional = quantity * exit_price
        exit_fee = estimate_cost(signal["market"], "exit", exit_notional)
        exit_slippage = exit_notional * slippage_bps / 10_000
        exit_cost = exit_fee + exit_slippage
        cash += exit_notional - exit_cost
        net_pnl = exit_notional - exit_cost - entry_notional - entry_cost
        net_return = net_pnl / (entry_notional + entry_cost)
        trade_returns.append(net_return)
        _insert_trade(
            f"{signal['signal_id']}-exit",
            strategy_version,
            signal["symbol"],
            signal["market"],
            "exit",
            exit_row["date"],
            exit_price,
            quantity,
            exit_cost,
            exit_reason,
        )
        trade_rows.append(
            {
                "trade_id": f"{signal['signal_id']}-exit",
                "strategy_version": strategy_version,
                "symbol": signal["symbol"],
                "market": signal["market"],
                "side": "exit",
                "date": exit_row["date"],
                "price": exit_price,
                "quantity": quantity,
                "cost": exit_cost,
                "cost_breakdown": {
                    "commission_tax": exit_fee,
                    "slippage": exit_slippage,
                    "total": exit_cost,
                },
                "reason": exit_reason,
            }
        )
        lifecycle_rows.append(
            {
                "signal_id": signal["signal_id"],
                "symbol": signal["symbol"],
                "market": signal["market"],
                "signal_name": signal["signal_name"],
                "entry_date": entry["date"],
                "exit_date": exit_row["date"],
                "entry_price": entry_price,
                "exit_price": exit_price,
                "quantity": quantity,
                "entry_notional": entry_notional,
                "exit_notional": exit_notional,
                "entry_cost": entry_cost,
                "exit_cost": exit_cost,
                "net_pnl": net_pnl,
                "net_return": net_return,
                "holding_days": int((pd.to_datetime(exit_row["date"]) - pd.to_datetime(entry["date"])).days),
                "exit_reason": exit_reason,
            }
        )
        capital_usage_rows.append(
            {
                "date": exit_row["date"],
                "cash": cash,
                "positions_value": 0.0,
                "capital_used_pct": 0.0,
                "symbol": signal["symbol"],
                "event": "exit",
            }
        )
        trade_count += 1
        peak_equity = max(peak_equity, cash)
        drawdown = cash / peak_equity - 1
        drawdowns.append(drawdown)
        equity_rows.append({"date": exit_row["date"], "equity": cash, "drawdown": drawdown})
        _insert_equity(strategy_version, exit_row["date"], cash, cash, 0.0, drawdown)

    wins = [value for value in trade_returns if value > 0]
    losses = [value for value in trade_returns if value < 0]
    gross_profit = sum(wins)
    gross_loss = abs(sum(losses))
    profit_loss_ratio = (
        gross_profit / gross_loss
        if gross_loss > 0
        else (float("inf") if gross_profit > 0 else 0.0)
    )

    benchmark = _build_benchmark_curve(
        equity_rows,
        _dominant_market(lifecycle_rows, requested_markets),
        initial_cash,
    )
    extra_metrics = summarize_equity_curve(
        equity_rows, _benchmark_returns(benchmark["curve"], equity_rows)
    )
    trade_attribution, exposures = _summarize_lifecycle(lifecycle_rows)
    benchmark_total_return = (
        benchmark["curve"][-1]["benchmark_return"] if benchmark["curve"] else 0.0
    )
    total_return = cash / initial_cash - 1
    return {
        "strategy_version": strategy_version,
        "metrics": {
            "initial_cash": initial_cash,
            "final_equity": cash,
            "trade_count": trade_count,
            "total_return": total_return,
            "max_drawdown": min(drawdowns),
            "win_rate": len(wins) / len(trade_returns) if trade_returns else 0.0,
            "profit_loss_ratio": profit_loss_ratio,
            "sharpe": extra_metrics["sharpe"],
            "sortino": extra_metrics["sortino"],
            "calmar": extra_metrics["calmar"],
            "information_ratio": extra_metrics["information_ratio"],
            "benchmark_symbol": benchmark["symbol"],
            "benchmark_total_return": benchmark_total_return,
            "excess_return": total_return - benchmark_total_return,
            "benchmark_coverage": benchmark["coverage"],
        },
        "equity_curve": equity_rows,
        "benchmark_curve": benchmark["curve"],
        "trades": trade_rows,
        "position_lifecycle": lifecycle_rows,
        "trade_attribution": trade_attribution,
        "capital_usage": capital_usage_rows,
        "exposures": exposures,
        "return_distribution": _return_distribution(trade_returns),
        "risk_diagnostics": _risk_diagnostics(
            equity_rows,
            trade_rows,
            trade_returns,
            capital_usage_rows,
            benchmark["status"],
        ),
        "skipped_trades": skipped_trades,
        "execution_assumptions": {
            "execution_price": "next_open",
            "holding_days": holding_days,
            "slippage_bps": slippage_bps,
            "max_position_pct": max_position_pct,
            "t_plus_1": True,
            "filters": ["suspension", "limit_up_down", "low_liquidity", "insufficient_future_bars"],
        },
        "audit_summary": {
            "signal_count": len(signals),
            "executed_lifecycle_count": len(lifecycle_rows),
            "trade_log_count": len(trade_rows),
            "skipped_count": len(skipped_trades),
            "cost_total": sum(float(row.get("cost") or 0.0) for row in trade_rows),
        },
    }
