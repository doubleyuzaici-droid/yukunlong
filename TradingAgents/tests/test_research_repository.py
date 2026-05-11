import json

import pytest


@pytest.fixture()
def research_repo(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    from tradingagents.research import repository
    from tradingagents.research.db import init_db

    init_db()
    return repository


def test_watchlist_upsert_deduplicates_and_lists_active_symbols(research_repo):
    research_repo.upsert_watchlist_symbols(["00700.HK", "1024.HK", "00700.HK"])

    rows = research_repo.list_watchlist()

    assert [row["symbol"] for row in rows] == ["00700.HK", "01024.HK"]
    assert all(row["status"] == "active" for row in rows)
    assert rows[0]["market"] == "HONGKONG"


def test_daily_bars_upsert_is_idempotent_and_loads_ordered_frame(research_repo):
    rows = [
        {
            "date": "2026-05-10",
            "symbol": "600519.SH",
            "market": "CHINA",
            "open": 101.0,
            "high": 105.0,
            "low": 100.0,
            "close": 104.0,
            "volume": 1000,
            "amount": 100000,
            "source": "fixture",
        },
        {
            "date": "2026-05-09",
            "symbol": "600519.SH",
            "market": "CHINA",
            "open": 99.0,
            "high": 102.0,
            "low": 98.0,
            "close": 101.0,
            "volume": 900,
            "amount": 90000,
            "source": "fixture",
        },
    ]

    research_repo.upsert_daily_bars(rows)
    research_repo.upsert_daily_bars([{**rows[0], "close": 106.0}])

    frame = research_repo.load_daily_bars("600519.SH", "2026-05-01", "2026-05-31")

    assert list(frame["date"]) == ["2026-05-09", "2026-05-10"]
    assert frame.loc[frame["date"] == "2026-05-10", "close"].item() == 106.0


def test_factors_and_signals_can_be_persisted_and_queried(research_repo):
    research_repo.upsert_factors(
        [
            {
                "date": "2026-05-11",
                "symbol": "600519.SH",
                "ma20": 100.0,
                "ma60": 95.0,
                "weekly_state": "strong",
            }
        ]
    )
    research_repo.upsert_signals(
        [
            {
                "signal_id": "20260511-600519-trend",
                "date": "2026-05-11",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": json.dumps(["close > ma60"], ensure_ascii=False),
                "risk_json": json.dumps([], ensure_ascii=False),
                "invalid_json": json.dumps(["跌破 ma60"], ensure_ascii=False),
                "score": 82.0,
                "strategy_version": "signal_v1",
            }
        ]
    )

    rows = research_repo.list_today_signals("2026-05-11")

    assert len(rows) == 1
    assert rows[0]["signal_name"] == "趋势增强"
    assert rows[0]["score"] == 82.0
