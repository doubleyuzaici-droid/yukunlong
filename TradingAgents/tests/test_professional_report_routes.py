import json

from fastapi.testclient import TestClient


def test_professional_daily_report_returns_markdown_html_and_downloads(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_signals, upsert_watchlist_symbols

    init_db()
    upsert_watchlist_symbols(["600519.SH"], industry="白酒")
    upsert_signals(
        [
            {
                "signal_id": "sig-report-1",
                "date": "2026-05-12",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": json.dumps(["趋势确认"], ensure_ascii=False),
                "risk_json": json.dumps(["成交确认不足"], ensure_ascii=False),
                "invalid_json": "[]",
                "score": 88,
                "strategy_version": "resonance_v2",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO data_quality_log (
                date, check_name, severity, symbol, message, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("2026-05-12", "news_sync", "warning", "600519.SH", "新闻证据缺失", "now"),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/reports/professional/daily?date=2026-05-12")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert "专业投研日报" in payload["data"]["markdown"]
    assert "<html" in payload["data"]["html"]
    assert payload["data"]["sections"]["signals"]["count"] == 1
    assert payload["data"]["sections"]["data_quality"]["open_issue_count"] == 1

    html_download = client.get("/api/reports/professional/daily/download?date=2026-05-12&format=html")
    assert html_download.status_code == 200
    assert html_download.headers["content-type"].startswith("text/html")
    assert "专业投研日报" in html_download.text
