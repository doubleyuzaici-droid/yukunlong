import json
from datetime import date, timedelta


def _daily_rows(suspended_entry: bool = False):
    start = date(2026, 1, 1)
    rows = []
    for index in range(45):
        current = start + timedelta(days=index)
        close = 100.0 + index
        rows.append(
            {
                "date": current.isoformat(),
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": close - 0.5,
                "high": close + 1,
                "low": close - 2,
                "close": close,
                "volume": 1_000_000,
                "amount": 100_000_000,
                "is_suspended": (
                    1 if suspended_entry and current.isoformat() == "2026-01-11" else 0
                ),
                "source": "fixture",
            }
        )
    return rows


def _signal():
    return {
        "signal_id": "sig-1",
        "date": "2026-01-10",
        "symbol": "600519.SH",
        "market": "CHINA",
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
    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_signals([_signal()])

    result = run_portfolio_backtest("2026-01-01", "2026-02-28")

    assert result["metrics"]["trade_count"] == 2
    assert result["metrics"]["final_equity"] > 1_000_000
    with get_connection() as conn:
        trade_count = conn.execute("SELECT COUNT(*) FROM trade_log").fetchone()[0]
        equity_count = conn.execute("SELECT COUNT(*) FROM equity_curve").fetchone()[0]
    assert trade_count == 2
    assert equity_count >= 1


def test_portfolio_backtest_skips_suspended_entry(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.portfolio_backtester import run_portfolio_backtest
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows(suspended_entry=True))
    upsert_signals([_signal()])

    result = run_portfolio_backtest("2026-01-01", "2026-02-28")

    assert result["metrics"]["trade_count"] == 0
    assert result["metrics"]["final_equity"] == 1_000_000
