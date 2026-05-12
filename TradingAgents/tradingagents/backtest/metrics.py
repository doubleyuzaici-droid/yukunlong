from __future__ import annotations

import pandas as pd


def summarize_events(events: list[dict]) -> list[dict]:
    if not events:
        return []
    frame = pd.DataFrame(events)
    summaries = []
    for signal_name, group in frame.groupby("signal_name", dropna=False):
        summaries.append(
            {
                "signal_name": signal_name,
                "sample_count": int(len(group)),
                "win_rate_5d": float((group["ret_5d"] > 0).mean()),
                "win_rate_20d": float((group["ret_20d"] > 0).mean()),
                "median_ret_20d": float(group["ret_20d"].median()),
                "mean_ret_20d": float(group["ret_20d"].mean()),
                "mean_max_adverse_20d": float(group["max_adverse_20d"].mean()),
            }
        )
    return summaries


def summarize_equity_curve(
    rows: list[dict], benchmark_returns: list[float] | None = None
) -> dict:
    if not rows:
        return {
            "total_return": 0.0,
            "max_drawdown": 0.0,
            "sharpe": 0.0,
            "sortino": 0.0,
            "calmar": 0.0,
            "information_ratio": 0.0,
        }

    frame = pd.DataFrame(rows).sort_values("date")
    returns = frame["equity"].pct_change().dropna()
    if returns.empty:
        return {
            "total_return": 0.0,
            "max_drawdown": float(frame["drawdown"].min() if "drawdown" in frame else 0.0),
            "sharpe": 0.0,
            "sortino": 0.0,
            "calmar": 0.0,
            "information_ratio": 0.0,
        }

    mean_return = float(returns.mean())
    std_return = float(returns.std(ddof=0))
    downside = returns[returns < 0]
    downside_std = float(downside.std(ddof=0)) if not downside.empty else 0.0
    annual = 252**0.5
    sharpe = mean_return / std_return * annual if std_return > 0 else 0.0
    sortino = mean_return / downside_std * annual if downside_std > 0 else 0.0
    total_return = float(frame["equity"].iloc[-1] / frame["equity"].iloc[0] - 1)
    max_drawdown = float(frame["drawdown"].min() if "drawdown" in frame else 0.0)
    calmar = total_return / abs(max_drawdown) if max_drawdown < 0 else 0.0

    information_ratio = 0.0
    if benchmark_returns and len(benchmark_returns) == len(returns):
        active = returns.reset_index(drop=True) - pd.Series(benchmark_returns)
        active_std = float(active.std(ddof=0))
        information_ratio = float(active.mean() / active_std * annual) if active_std > 0 else 0.0

    return {
        "total_return": total_return,
        "max_drawdown": max_drawdown,
        "sharpe": float(sharpe),
        "sortino": float(sortino),
        "calmar": float(calmar),
        "information_ratio": float(information_ratio),
    }
