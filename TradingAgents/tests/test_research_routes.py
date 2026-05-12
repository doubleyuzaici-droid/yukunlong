from fastapi.testclient import TestClient

from tradingagents.api.server import create_app
from tradingagents.research.quality import log_quality_issue
from tradingagents.research.repository import upsert_watchlist_symbols


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
    assert {
        "summary",
        "failures",
        "ablation_steps",
        "walk_forward_periods",
        "candidate_yaml",
        "markdown",
    } <= set(optimizer_payload["data"])


def test_research_status_route_returns_watchlist_readiness(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    upsert_watchlist_symbols(["00700.HK"])
    client = TestClient(create_app())

    response = client.get("/api/research/status")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["watchlist_count"] == 1
    assert payload["data"]["watchlist_status"][0]["symbol"] == "00700.HK"
    assert payload["data"]["watchlist_status"][0]["scan_readiness"] == "no_data"


def test_research_pipeline_route_runs_one_click_pipeline(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    upsert_watchlist_symbols(["00700.HK"])
    client = TestClient(create_app())

    def fake_run_pipeline(
        start,
        end,
        *,
        signal_date=None,
        source=None,
        include_fund_flow=True,
    ):
        return {
            "start": start,
            "end": end,
            "signal_date": signal_date,
            "rows_synced": 12,
            "fund_flow_rows": 3,
            "factor_rows": 10,
            "signal_count": 2,
            "warnings": [{"symbol": "01024.HK", "message": "sync failed"}],
        }

    monkeypatch.setattr(
        "tradingagents.api.research_routes.run_pipeline",
        fake_run_pipeline,
        raising=False,
    )

    response = client.post(
        "/api/research/pipeline/run",
        json={
            "start": "2026-01-01",
            "end": "2026-05-12",
            "signal_date": "2026-05-12",
            "source": "akshare",
            "include_fund_flow": False,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["rows_synced"] == 12
    assert payload["data"]["factor_rows"] == 10
    assert payload["data"]["signal_count"] == 2
    assert payload["data"]["watchlist_count"] == 1
    assert payload["data"]["watchlist_status"][0]["symbol"] == "00700.HK"
    assert payload["data"]["warnings"][0]["message"] == "sync failed"
