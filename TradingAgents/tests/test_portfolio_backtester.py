import json
from datetime import date, timedelta


def _daily_rows(
    suspended_entry: bool = False,
    limit_up_entry: bool = False,
    symbol: str = "600519.SH",
    market: str = "CHINA",
    amount: float = 100_000_000,
    atr14: float = 2.0,
    force_stop_day: str | None = None,
):
    start = date(2026, 1, 1)
    rows = []
    for index in range(45):
        current = start + timedelta(days=index)
        close = 100.0 + index
        open_price = close - 0.5
        rows.append(
            {
                "date": current.isoformat(),
                "symbol": symbol,
                "market": market,
                "open": open_price,
                "high": close + 1,
                "low": close - 2,
                "close": close,
                "volume": 1_000_000,
                "amount": amount,
                "is_suspended": (
                    1 if suspended_entry and current.isoformat() == "2026-01-11" else 0
                ),
                "limit_up": (
                    open_price
                    if limit_up_entry and current.isoformat() == "2026-01-11"
                    else None
                ),
                "source": "fixture",
                "atr14": atr14,
            }
        )
        if force_stop_day and current.isoformat() == force_stop_day:
            rows[-1]["low"] = open_price - 10.0
    return rows


def _signal(symbol: str = "600519.SH", market: str = "CHINA"):
    return {
        "signal_id": "sig-1",
        "date": "2026-01-10",
        "symbol": symbol,
        "market": market,
        "signal_name": "趋势增强",
        "signal_level": "A",
        "direction": "opportunity",
        "timeframe": "daily",
        "evidence_json": json.dumps(["fixture"], ensure_ascii=False),
        "risk_json": json.dumps([], ensure_ascii=False),
        "invalid_json": json.dumps(["fixture invalid"], ensure_ascii=False),
        "score": 85.0,
        "strategy_version": "signal_v1",
    }


def test_portfolio_backtest_generates_trade_log_and_equity_curve(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_factors, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_signals([_signal()])

    result = run_portfolio_backtest("2026-01-01", "2026-02-28")

    assert result["metrics"]["trade_count"] == 2
    assert result["metrics"]["final_equity"] > 1_000_000
    assert result["metrics"]["max_drawdown"] <= 0
    assert result["metrics"]["win_rate"] == 1.0
    assert result["metrics"]["profit_loss_ratio"] > 0
    with get_connection() as conn:
        trade_count = conn.execute("SELECT COUNT(*) FROM trade_log").fetchone()[0]
        equity_count = conn.execute("SELECT COUNT(*) FROM equity_curve").fetchone()[0]
    assert trade_count == 2
    assert equity_count >= 1


def test_portfolio_backtest_skips_suspended_entry(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_factors,
        upsert_signals,
    )

    init_db()
    upsert_daily_bars(_daily_rows(suspended_entry=True))
    upsert_signals([_signal()])

    result = run_portfolio_backtest("2026-01-01", "2026-02-28")

    assert result["metrics"]["trade_count"] == 0
    assert result["metrics"]["final_equity"] == 1_000_000


def test_portfolio_backtest_skips_china_limit_up_entry(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_factors,
        upsert_signals,
    )

    init_db()
    upsert_daily_bars(_daily_rows(limit_up_entry=True))
    upsert_signals([_signal()])

    result = run_portfolio_backtest("2026-01-01", "2026-02-28")

    assert result["metrics"]["trade_count"] == 0
    assert result["metrics"]["final_equity"] == 1_000_000


def test_portfolio_backtest_filters_low_liquidity_hk_entry(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_factors, upsert_signals

    init_db()
    upsert_daily_bars(
        _daily_rows(symbol="00700.HK", market="HONGKONG", amount=10_000_000)
    )
    upsert_signals([_signal(symbol="00700.HK", market="HONGKONG")])

    result = run_portfolio_backtest("2026-01-01", "2026-02-28")

    assert result["metrics"]["trade_count"] == 0
    assert result["metrics"]["final_equity"] == 1_000_000


def test_portfolio_backtest_exits_on_atr_stop(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_factors, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows(atr14=2.0, force_stop_day="2026-01-13"))
    upsert_factors([{"date": "2026-01-11", "symbol": "600519.SH", "atr14": 2.0}])
    upsert_signals([_signal()])

    result = run_portfolio_backtest("2026-01-01", "2026-02-28")

    assert result["metrics"]["trade_count"] == 2
    with get_connection() as conn:
        row = conn.execute(
            "SELECT reason FROM trade_log WHERE side = 'exit' LIMIT 1"
        ).fetchone()
    assert row["reason"] == "atr_stop_loss"
