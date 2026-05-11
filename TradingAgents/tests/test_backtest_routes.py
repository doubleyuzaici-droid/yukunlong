import json
from datetime import date, timedelta

from fastapi.testclient import TestClient


def _daily_rows():
    start = date(2026, 1, 1)
    rows = []
    for index in range(75):
        close = 100.0 + index
        rows.append(
            {
                "date": (start + timedelta(days=index)).isoformat(),
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": close - 0.5,
                "high": close + 1,
                "low": close - 2,
                "close": close,
                "volume": 1_000_000,
                "amount": 100_000_000,
                "source": "fixture",
            }
        )
    return rows


def test_event_backtest_routes_run_fetch_and_report(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_signals(
        [
            {
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
        ]
    )

    client = TestClient(create_app())
    response = client.post(
        "/api/backtests/event",
        json={
            "start": "2026-01-01",
            "end": "2026-03-31",
            "signal_names": ["趋势增强"],
        },
    )

    assert response.status_code == 200
    backtest_id = response.json()["data"]["backtest_id"]
    assert response.json()["data"]["result"]["summary"][0]["sample_count"] == 1

    fetched = client.get(f"/api/backtests/event/{backtest_id}")
    assert fetched.status_code == 200
    assert fetched.json()["data"]["backtest_id"] == backtest_id

    report = client.get(f"/api/backtests/event/{backtest_id}/report")
    assert report.status_code == 200
    assert "事件回测报告" in report.json()["data"]["markdown"]
