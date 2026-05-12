import json
from datetime import date, timedelta


def _daily_rows(symbol: str = "600519.SH", suspended_entry: bool = False):
    start = date(2026, 1, 1)
    rows = []
    for index in range(75):
        current = start + timedelta(days=index)
        close = 100.0 + index
        rows.append(
            {
                "date": current.isoformat(),
                "symbol": symbol,
                "market": "CHINA",
                "open": close - 0.5,
                "high": close + 1.0,
                "low": close - 2.0,
                "close": close,
                "volume": 1_000_000.0,
                "amount": 100_000_000.0,
                "is_suspended": (
                    1 if suspended_entry and current.isoformat() == "2026-01-11" else 0
                ),
                "source": "fixture",
            }
        )
    return rows


def _signal(signal_id: str = "sig-1", signal_name: str = "趋势增强"):
    return {
        "signal_id": signal_id,
        "date": "2026-01-10",
        "symbol": "600519.SH",
        "market": "CHINA",
        "signal_name": signal_name,
        "signal_level": "A",
        "direction": "opportunity",
        "timeframe": "daily",
        "evidence_json": json.dumps(["fixture"], ensure_ascii=False),
        "risk_json": json.dumps([], ensure_ascii=False),
        "invalid_json": json.dumps(["fixture invalid"], ensure_ascii=False),
        "score": 85.0,
        "strategy_version": "signal_v1",
    }


def _index_rows(index_symbol: str = "000300.SH"):
    start = date(2026, 1, 1)
    rows = []
    for index in range(75):
        close = 200.0 + index * 0.5
        rows.append(
            {
                "date": (start + timedelta(days=index)).isoformat(),
                "index_symbol": index_symbol,
                "market": "CHINA",
                "open": close - 0.2,
                "high": close + 0.8,
                "low": close - 0.8,
                "close": close,
                "volume": 1_000_000.0,
                "amount": 100_000_000.0,
                "source": "fixture",
            }
        )
    return rows


def test_event_backtest_uses_t_plus_one_open_and_horizon_returns(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.event_backtester import run_event_backtest
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_signals([_signal()])

    result = run_event_backtest(["趋势增强"], "2026-01-01", "2026-03-31")

    event = result["events"][0]
    assert event["entry_date"] == "2026-01-11"
    assert event["entry_price"] == 109.5
    assert event["ret_5d"] == (115.0 / 109.5 - 1)
    assert event["ret_20d"] == (130.0 / 109.5 - 1)
    assert event["ret_60d"] == (170.0 / 109.5 - 1)
    assert result["summary"][0]["signal_name"] == "趋势增强"
    assert result["summary"][0]["sample_count"] == 1


def test_event_backtest_skips_suspended_t_plus_one_entry(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.event_backtester import run_event_backtest
    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows(suspended_entry=True))
    upsert_signals([_signal()])

    result = run_event_backtest(None, "2026-01-01", "2026-03-31")

    assert result["events"] == []
    assert result["failures"][0]["fail_reason"] == "no_executable_entry"
    with get_connection() as conn:
        row = conn.execute(
            "SELECT fail_reason FROM event_return WHERE signal_id = ?", ("sig-1",)
        ).fetchone()
    assert row["fail_reason"] == "no_executable_entry"


def test_event_backtest_computes_excess_index_return(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.backtest.event_backtester import run_event_backtest
    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_signals([_signal()])
    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO index_bars (
                date, index_symbol, market, open, high, low, close, volume, amount, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            """,
            [
                (
                    row["date"],
                    row["index_symbol"],
                    row["market"],
                    row["open"],
                    row["high"],
                    row["low"],
                    row["close"],
                    row["volume"],
                    row["amount"],
                    row["source"],
                )
                for row in _index_rows()
            ],
        )
        conn.commit()

    result = run_event_backtest(["趋势增强"], "2026-01-01", "2026-03-31")
    event = result["events"][0]
    assert event["ret_20d"] is not None
    assert event["excess_index_20d"] is not None
