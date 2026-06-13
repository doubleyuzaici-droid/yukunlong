from datetime import date, timedelta


def _daily_rows(symbol: str = "600519.SH", market: str = "CHINA"):
    start = date(2026, 1, 1)
    rows = []
    for index in range(130):
        current = start + timedelta(days=index)
        close = 100.0 + index
        rows.append(
            {
                "date": current.isoformat(),
                "symbol": symbol,
                "market": market,
                "open": close - 0.5,
                "high": close + 1.0,
                "low": close - 1.0,
                "close": close,
                "volume": 1_000_000 + index,
                "amount": 100_000_000 + index,
                "source": "fixture",
            }
        )
    return rows


def test_compute_watchlist_factors_persists_technical_state(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.factor_pipeline import compute_watchlist_factors
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_watchlist_symbols,
    )

    init_db()
    upsert_watchlist_symbols(["600519.SH"])
    upsert_daily_bars(_daily_rows())

    count = compute_watchlist_factors("2026-01-01", "2026-05-15")

    assert count == 130
    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT ma20, ma60, ma120, rsi14, atr14, volume_ratio20,
                   amount_ratio20, ret20, ret60, weekly_state, monthly_state
            FROM factor_daily
            WHERE symbol = ? AND date = ?
            """,
            ("600519.SH", "2026-05-10"),
        ).fetchone()
    assert row is not None
    assert row["ma20"] > row["ma60"] > row["ma120"]
    assert row["rsi14"] == 100.0
    assert row["atr14"] > 0
    assert row["volume_ratio20"] > 0
    assert row["amount_ratio20"] > 0
    assert row["ret20"] > 0
    assert row["ret60"] > 0
    assert row["weekly_state"] in {"strong", "improving", "neutral", "weak"}
    assert row["monthly_state"] in {"strong", "improving", "neutral", "weak"}


def test_compute_watchlist_factors_persists_relative_strength(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.factor_pipeline import compute_watchlist_factors
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_watchlist_symbols,
    )

    init_db()
    upsert_watchlist_symbols(["600519.SH", "000858.SZ"], industry="白酒")
    upsert_daily_bars(_daily_rows("600519.SH"))
    peer_rows = _daily_rows("000858.SZ")
    for index, row in enumerate(peer_rows):
        row["close"] = 100.0 + index * 0.35
        row["open"] = row["close"] - 0.5
        row["high"] = row["close"] + 1.0
        row["low"] = row["close"] - 1.0
    upsert_daily_bars(peer_rows)

    with get_connection() as conn:
        conn.executemany(
            """
            INSERT INTO index_bars (
                date, index_symbol, market, open, high, low, close, volume, amount, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            [
                (
                    row["date"],
                    "000300.SH",
                    "CHINA",
                    100.0 + index * 0.1,
                    101.0 + index * 0.1,
                    99.0 + index * 0.1,
                    100.0 + index * 0.1,
                    1_000_000,
                    100_000_000,
                    "fixture",
                    "2026-05-16T00:00:00+00:00",
                )
                for index, row in enumerate(_daily_rows("000300.SH"))
            ],
        )
        conn.commit()

    compute_watchlist_factors("2026-01-01", "2026-05-15")

    with get_connection() as conn:
        row = conn.execute(
            """
            SELECT rel_strength_index20, rel_strength_industry20
            FROM factor_daily
            WHERE symbol = ? AND date = ?
            """,
            ("600519.SH", "2026-05-10"),
        ).fetchone()
    assert row["rel_strength_index20"] is not None
    assert row["rel_strength_index20"] > 0
    assert row["rel_strength_industry20"] is not None
    assert row["rel_strength_industry20"] > 0
