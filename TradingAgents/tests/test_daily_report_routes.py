import json

from fastapi.testclient import TestClient


def test_daily_report_routes_return_and_download_markdown(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_signals,
        upsert_watchlist_symbols,
    )

    init_db()
    upsert_watchlist_symbols(["600519.SH"])
    upsert_signals(
        [
            {
                "signal_id": "trend",
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
                "score": 85.0,
                "strategy_version": "signal_v1",
            }
        ]
    )

    client = TestClient(create_app())

    response = client.get("/api/reports/daily?date=2026-05-11")
    assert response.status_code == 200
    assert response.json()["success"] is True
    assert "趋势增强" in response.json()["data"]["markdown"]

    download = client.get("/api/reports/daily/download?date=2026-05-11")
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("text/markdown")
    assert "A/H 股自选股复盘" in download.text
