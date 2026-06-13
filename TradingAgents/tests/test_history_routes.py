from fastapi.testclient import TestClient


def test_history_routes_list_open_and_download_saved_reports(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.default_config import DEFAULT_CONFIG

    results_dir = tmp_path / "logs"
    DEFAULT_CONFIG["results_dir"] = str(results_dir)
    logs_dir = results_dir / "600519_SH" / "TradingAgentsStrategy_logs"
    logs_dir.mkdir(parents=True)
    (logs_dir / "full_states_log_2026-05-15.json").write_text("{}", encoding="utf-8")
    (logs_dir / "report_2026-05-15.md").write_text(
        "# TradingAgents 分析报告\n\n## 最终决策\n\n保持观察",
        encoding="utf-8",
    )

    client = TestClient(create_app())

    history = client.get("/api/history")
    assert history.status_code == 200
    payload = history.json()
    assert payload["success"] is True
    assert payload["data"][0]["ticker"] == "600519.SH"
    assert payload["data"][0]["has_report"] is True

    report = client.get("/api/history/600519.SH/2026-05-15/report")
    assert report.status_code == 200
    report_payload = report.json()["data"]
    assert "最终决策" in report_payload["markdown"]
    assert report_payload["sections"]["final_trade_decision"] == "保持观察"
    assert report_payload["section_status"]["final_trade_decision"] == "parsed"

    download = client.get("/api/history/600519.SH/2026-05-15/download")
    assert download.status_code == 200
    assert "TradingAgents 分析报告" in download.text
