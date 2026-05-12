from __future__ import annotations

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


def run_portfolio_backtest(
    start: str,
    end: str,
    strategy_version: str = "portfolio_v1",
    initial_cash: float = 1_000_000,
    holding_days: int = 20,
) -> dict:
    init_db()
    cash = initial_cash
    trade_count = 0
    peak_equity = initial_cash
    drawdowns = [0.0]
    equity_rows = [{"date": start, "equity": cash, "drawdown": 0.0}]
    trade_returns: list[float] = []
    _insert_equity(strategy_version, start, cash, cash)

    for signal in _load_entry_signals(start, end):
        bars = _load_bars(signal["symbol"])
        signal_positions = bars.index[bars["date"] == signal["date"]]
        if len(signal_positions) == 0:
            continue
        entry_position = int(signal_positions[0]) + 1
        exit_position = entry_position + holding_days
        if exit_position >= len(bars):
            continue
        entry = bars.iloc[entry_position]
        exit_row = bars.iloc[exit_position]
        exit_reason = "holding_period_complete"
        if _is_low_liquidity_entry(bars, entry_position, signal["market"]):
            continue
        if not is_executable_entry(entry) or not is_executable_exit(exit_row):
            continue

        entry_price = float(entry["open"])
        atr = _load_atr14(signal["symbol"], entry["date"]) or 0.0
        stop_price = entry_price - 2 * atr if atr > 0 else None
        allocation = cash / 10
        quantity = allocation / entry_price
        entry_notional = quantity * entry_price
        entry_cost = estimate_cost(signal["market"], "entry", entry_notional)
        cash -= entry_notional + entry_cost
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
        exit_cost = estimate_cost(signal["market"], "exit", exit_notional)
        cash += exit_notional - exit_cost
        trade_returns.append((exit_notional - exit_cost) / (entry_notional + entry_cost) - 1)
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

    extra_metrics = summarize_equity_curve(equity_rows)
    return {
        "strategy_version": strategy_version,
        "metrics": {
            "initial_cash": initial_cash,
            "final_equity": cash,
            "trade_count": trade_count,
            "total_return": cash / initial_cash - 1,
            "max_drawdown": min(drawdowns),
            "win_rate": len(wins) / len(trade_returns) if trade_returns else 0.0,
            "profit_loss_ratio": profit_loss_ratio,
            "sharpe": extra_metrics["sharpe"],
            "sortino": extra_metrics["sortino"],
            "calmar": extra_metrics["calmar"],
            "information_ratio": extra_metrics["information_ratio"],
        },
    }
