from __future__ import annotations

from datetime import date, timedelta


def _bar(symbol: str, trading_date: date) -> dict:
    return {
        "date": trading_date.isoformat(),
        "symbol": symbol,
        "market": "HONGKONG" if symbol.endswith(".HK") else "CHINA",
        "open": 10.0,
        "high": 10.5,
        "low": 9.5,
        "close": 10.2,
        "volume": 1000,
        "amount": 10200,
        "source": "test",
    }


def test_watchlist_status_marks_data_readiness(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.pipeline_status import get_watchlist_status
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_watchlist_symbols,
    )

    upsert_watchlist_symbols(["00700.HK", "01024.HK", "600519.SH"])
    start = date(2026, 1, 1)
    upsert_daily_bars([_bar("00700.HK", start + timedelta(days=offset)) for offset in range(31)])
    upsert_daily_bars([_bar("600519.SH", start + timedelta(days=offset)) for offset in range(125)])

    rows = get_watchlist_status()

    by_symbol = {row["symbol"]: row for row in rows}
    assert by_symbol["01024.HK"]["bar_count"] == 0
    assert by_symbol["01024.HK"]["scan_readiness"] == "no_data"
    assert by_symbol["00700.HK"]["bar_count"] == 31
    assert by_symbol["00700.HK"]["scan_readiness"] == "insufficient_60"
    assert by_symbol["600519.SH"]["bar_count"] == 125
    assert by_symbol["600519.SH"]["scan_readiness"] == "ready"
    assert by_symbol["600519.SH"]["latest_bar_date"] == "2026-05-05"
