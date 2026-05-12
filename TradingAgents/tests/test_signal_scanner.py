from datetime import date, timedelta


def _daily_rows(symbol: str, market: str, amount: float = 100_000_000.0):
    start = date(2026, 1, 1)
    rows = []
    for index in range(80):
        close = 100.0 + index
        rows.append(
            {
                "date": (start + timedelta(days=index)).isoformat(),
                "symbol": symbol,
                "market": market,
                "open": close - 1,
                "high": close + 1,
                "low": close - 2,
                "close": close,
                "volume": 1_000_000.0,
                "amount": amount,
                "source": "fixture",
            }
        )
    return rows


def test_scan_watchlist_generates_and_persists_rule_signals(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        list_today_signals,
        upsert_daily_bars,
        upsert_watchlist_symbols,
    )
    from tradingagents.research.signals.scanner import persist_signals, scan_watchlist

    init_db()
    upsert_watchlist_symbols(["600519.SH"])
    upsert_daily_bars(_daily_rows("600519.SH", "CHINA"))

    signals = scan_watchlist("2026-03-21")
    persist_signals(signals)

    assert signals
    assert all(signal.evidence for signal in signals)
    assert all(signal.invalid_conditions for signal in signals)
    persisted = list_today_signals("2026-03-21")
    assert {row["signal_name"] for row in persisted} >= {"趋势增强"}


def test_scan_watchlist_filters_low_liquidity_hk_opportunities(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_watchlist_symbols,
    )
    from tradingagents.research.signals.scanner import scan_watchlist

    init_db()
    upsert_watchlist_symbols(["00700.HK"])
    upsert_daily_bars(_daily_rows("00700.HK", "HONGKONG", amount=1_000_000.0))

    signals = scan_watchlist("2026-03-21")

    assert not [signal for signal in signals if signal.signal_level in ("S", "A")]


def test_scan_symbol_sets_market_regime_without_polluting_evidence(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars
    from tradingagents.research.signals.scanner import scan_symbol

    init_db()
    upsert_daily_bars(_daily_rows("600519.SH", "CHINA"))
    signals = scan_symbol("600519.SH", "2026-03-21")

    assert signals
    assert all(signal.market_regime in {"bull_trend", "bear_trend", "range_bound", "high_volatility", "low_volatility"} for signal in signals)
    assert all(not any(item.startswith("market_regime=") for item in signal.evidence) for signal in signals)
