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


def test_research_watchlist_bootstrap_route_adds_core_symbols(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    response = client.post("/api/research/watchlist/bootstrap")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    symbols = {row["symbol"] for row in payload["data"]["watchlist_status"]}
    assert {"600519.SH", "601318.SH", "00700.HK", "01024.HK"} <= symbols
    core_symbols = {row["symbol"] for row in payload["data"]["core_universe"]}
    assert "601318.SH" in core_symbols


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
    assert payload["data"]["run_id"]

    history = client.get("/api/research/pipeline/history")
    assert history.status_code == 200
    history_payload = history.json()
    assert history_payload["success"] is True
    assert history_payload["data"]["runs"][0]["run_id"] == payload["data"]["run_id"]
    assert history_payload["data"]["runs"][0]["source"] == "akshare"


def test_data_quality_routes_resolve_and_resync(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    log_quality_issue(
        check_name="data_sync",
        severity="warning",
        symbol="600519.SH",
        date="2026-05-11",
        message="行情缺失",
    )

    issue = client.get("/api/research/data-quality").json()["data"][0]
    resolved = client.post(
        f"/api/research/data-quality/{issue['id']}/resolve",
        json={"resolution_status": "ignored", "resolution_note": "节假日无需补数"},
    )
    assert resolved.status_code == 200
    assert resolved.json()["data"]["resolution_status"] == "ignored"

    def fake_sync_watchlist_bars(start, end, source=None):
        return 7

    monkeypatch.setattr(
        "tradingagents.api.research_routes.sync_watchlist_bars",
        fake_sync_watchlist_bars,
        raising=False,
    )
    resync = client.post(
        "/api/research/data-quality/resync",
        json={"start": "2026-05-01", "end": "2026-05-11", "source": "akshare"},
    )
    assert resync.status_code == 200
    assert resync.json()["data"]["rows_synced"] == 7


def test_optimizer_candidate_routes_save_and_apply(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    created = client.post(
        "/api/research/optimizer/candidates",
        json={
            "name": "candidate_v1",
            "candidate_yaml": "strategy_name: candidate_v1\nreview_required: true\n",
        },
    )
    assert created.status_code == 200
    created_payload = created.json()
    assert created_payload["success"] is True
    candidate_id = created_payload["data"]["candidate_id"]
    assert created_payload["data"]["status"] == "draft"

    applied = client.post(f"/api/research/optimizer/candidates/{candidate_id}/apply")
    assert applied.status_code == 200
    assert applied.json()["data"]["status"] == "applied"

    listed = client.get("/api/research/optimizer/candidates")
    assert listed.status_code == 200
    assert listed.json()["data"]["candidates"][0]["candidate_id"] == candidate_id


def test_research_sources_and_direct_cli_job_routes(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    upsert_watchlist_symbols(["600519.SH"])
    client = TestClient(create_app())

    def fake_sync_watchlist_fund_flows(start, end):
        assert start == "2026-01-01"
        assert end == "2026-05-12"
        return 11

    def fake_compute_watchlist_factors(start, end):
        assert start == "2026-01-01"
        assert end == "2026-05-12"
        return 22

    monkeypatch.setattr(
        "tradingagents.api.research_routes.sync_watchlist_fund_flows",
        fake_sync_watchlist_fund_flows,
        raising=False,
    )
    monkeypatch.setattr(
        "tradingagents.api.research_routes.compute_watchlist_factors",
        fake_compute_watchlist_factors,
        raising=False,
    )

    sources = client.get("/api/research/sources")
    assert sources.status_code == 200
    source_payload = sources.json()
    assert source_payload["success"] is True
    assert "akshare" in source_payload["data"]["supported_sources"]
    assert "sync-fund-flow" in {
        row["cli_command"] for row in source_payload["data"]["operational_commands"]
    }
    assert source_payload["data"]["source_health"]
    assert source_payload["data"]["rate_limit_policies"]["akshare"]["quota_status"] == "not_measured"

    fund_flow = client.post(
        "/api/research/fund-flow/sync",
        json={"start": "2026-01-01", "end": "2026-05-12"},
    )
    assert fund_flow.status_code == 200
    assert fund_flow.json()["data"]["fund_flow_rows"] == 11

    factors = client.post(
        "/api/research/factors/compute",
        json={"start": "2026-01-01", "end": "2026-05-12"},
    )
    assert factors.status_code == 200
    assert factors.json()["data"]["factor_rows"] == 22


def test_optimizer_sweep_route_runs_real_parameter_grid(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    client = TestClient(create_app())

    def fake_portfolio_backtest(start, end, *, strategy_version, initial_cash, holding_days):
        return {
            "strategy_version": strategy_version,
            "metrics": {
                "initial_cash": initial_cash,
                "final_equity": initial_cash * (1 + holding_days / 1000),
                "total_return": holding_days / 1000,
                "max_drawdown": -0.01 * holding_days,
                "sharpe": holding_days / 10,
            },
            "equity_curve": [],
            "trades": [],
        }

    monkeypatch.setattr(
        "tradingagents.api.research_routes.run_portfolio_backtest",
        fake_portfolio_backtest,
        raising=False,
    )

    response = client.post(
        "/api/research/optimizer/sweep",
        json={
            "start": "2026-01-01",
            "end": "2026-03-31",
            "grid": {"holding_days": [5, 20]},
            "folds": 2,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert len(payload["data"]["sweep_results"]) == 2
    assert payload["data"]["best"]["params"]["holding_days"] == 20
    assert payload["data"]["walk_forward"]["fold_count"] == 2
    assert payload["data"]["overfit_diagnostics"]["fold_count"] == 2
    assert payload["data"]["overfit_diagnostics"]["verdict"] in {"robust", "watch", "overfit_risk", "insufficient_oos"}
