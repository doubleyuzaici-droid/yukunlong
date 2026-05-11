from datetime import date, timedelta

from fastapi.testclient import TestClient


def _daily_rows(symbol: str, market: str):
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
                "amount": 100_000_000.0,
                "source": "fixture",
            }
        )
    return rows


def test_signal_routes_scan_today_and_symbol_history(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_watchlist_symbols,
    )

    init_db()
    upsert_watchlist_symbols(["600519.SH"])
    upsert_daily_bars(_daily_rows("600519.SH", "CHINA"))

    client = TestClient(create_app())

    scan_response = client.post("/api/signals/scan", json={"date": "2026-03-21"})
    assert scan_response.status_code == 200
    assert scan_response.json()["success"] is True
    assert scan_response.json()["data"]["count"] >= 1

    today_response = client.get("/api/signals/today?date=2026-03-21")
    assert today_response.status_code == 200
    today_data = today_response.json()["data"]
    assert any(row["signal_name"] == "趋势增强" for row in today_data)

    history_response = client.get(
        "/api/signals/600519.SH?start=2026-03-01&end=2026-03-31"
    )
    assert history_response.status_code == 200
    assert any(row["symbol"] == "600519.SH" for row in history_response.json()["data"])
