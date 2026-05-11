from fastapi.testclient import TestClient

from tradingagents.api.server import create_app
from tradingagents.research.quality import log_quality_issue


def test_watchlist_routes_create_update_and_remove(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    created = client.post(
        "/api/research/watchlist",
        json={
            "symbols": ["00700.HK", "600519.SH"],
            "industry": "平台经济",
            "thesis": "观察确认后的复盘样本",
        },
    )

    assert created.status_code == 200
    payload = created.json()
    assert payload["success"] is True
    rows_by_symbol = {item["symbol"]: item for item in payload["data"]}
    assert set(rows_by_symbol) == {"600519.SH", "00700.HK"}
    assert rows_by_symbol["00700.HK"]["industry"] == "平台经济"
    assert rows_by_symbol["00700.HK"]["thesis"] == "观察确认后的复盘样本"

    removed = client.delete("/api/research/watchlist/00700.HK")

    assert removed.status_code == 200
    payload = removed.json()
    assert payload["success"] is True
    assert [item["symbol"] for item in payload["data"]] == ["600519.SH"]


def test_research_health_and_optimizer_routes(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    log_quality_issue(
        check_name="missing_daily_bar",
        severity="warning",
        symbol="600519.SH",
        date="2026-05-11",
        message="行情缺失",
    )

    quality = client.get("/api/research/data-quality")
    assert quality.status_code == 200
    quality_payload = quality.json()
    assert quality_payload["success"] is True
    assert quality_payload["data"][0]["check_name"] == "missing_daily_bar"

    optimizer = client.get("/api/research/optimizer")
    assert optimizer.status_code == 200
    optimizer_payload = optimizer.json()
    assert optimizer_payload["success"] is True
    assert {"summary", "candidate_yaml", "markdown"} <= set(
        optimizer_payload["data"]
    )
