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


def test_init_db_migrates_legacy_event_return_market_regime(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import get_connection, init_db

    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE event_return (
                signal_id TEXT PRIMARY KEY,
                entry_date TEXT,
                entry_price REAL,
                ret_5d REAL,
                ret_20d REAL,
                ret_60d REAL,
                excess_index_20d REAL,
                excess_industry_20d REAL,
                max_adverse_20d REAL,
                max_favorable_20d REAL,
                success_flag INTEGER,
                fail_reason TEXT,
                updated_at TEXT
            )
            """
        )
        conn.commit()

    init_db()

    with get_connection() as conn:
        columns = [row["name"] for row in conn.execute("PRAGMA table_info(event_return)").fetchall()]
    assert "market_regime" in columns


def test_event_backtest_uses_index_bars_for_supported_index_signal(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_index_bars, upsert_signals

    init_db()
    upsert_index_bars(
        [
            {
                "date": (date(2026, 1, 1) + timedelta(days=index)).isoformat(),
                "index_symbol": "000852.SH",
                "market": "CHINA",
                "open": 8000 + index,
                "high": 8050 + index,
                "low": 7980 + index,
                "close": 8010 + index * 2,
                "volume": 200000000 + index,
                "amount": 400000000000 + index,
                "source": "fixture-index",
            }
            for index in range(75)
        ]
    )
    upsert_signals(
        [
            {
                "signal_id": "sig-index-event",
                "date": "2026-01-10",
                "symbol": "000852.SH",
                "market": "CHINA",
                "signal_name": "V2多指标共振",
                "signal_level": "C",
                "direction": "opportunity",
                "timeframe": "weekly+daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 33.0,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )

    client = TestClient(create_app())
    response = client.post(
        "/api/backtests/event",
        json={
            "start": "2026-01-01",
            "end": "2026-03-31",
            "signal_names": ["V2多指标共振"],
        },
    )

    assert response.status_code == 200
    result = response.json()["data"]["result"]
    assert result["events"][0]["symbol"] == "000852.SH"
    assert result["failures"] == []


def test_portfolio_backtest_route_returns_metrics(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_factors,
        upsert_signals,
    )

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_factors(
        [
            {
                "date": "2026-01-11",
                "symbol": "600519.SH",
                "atr14": 2.0,
            }
        ]
    )
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
        "/api/backtests/portfolio",
        json={
            "start": "2026-01-01",
            "end": "2026-03-31",
            "initial_cash": 1000000,
            "holding_days": 20,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["backtest_id"]
    assert payload["data"]["result"]["metrics"]["initial_cash"] == 1000000
    assert payload["data"]["result"]["equity_curve"][0]["date"] == "2026-01-01"
    backtest_id = payload["data"]["backtest_id"]

    report = client.get(f"/api/backtests/portfolio/{backtest_id}/report")
    assert report.status_code == 200
    assert "组合回测报告" in report.json()["data"]["markdown"]
    assert "回测完整性检查" in report.json()["data"]["markdown"]

    download = client.get(f"/api/backtests/portfolio/{backtest_id}/download")
    assert download.status_code == 200
    assert download.headers["content-type"].startswith("text/markdown")
    assert "组合回测报告" in download.text


def test_portfolio_backtest_returns_execution_audit_and_skips(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_signals(
        [
            {
                "signal_id": "sig-audit-1",
                "date": "2026-01-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 85.0,
                "strategy_version": "signal_v1",
            },
            {
                "signal_id": "sig-audit-2",
                "date": "2026-03-30",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 82.0,
                "strategy_version": "signal_v1",
            },
        ]
    )

    client = TestClient(create_app())
    response = client.post(
        "/api/backtests/portfolio",
        json={
            "start": "2026-01-01",
            "end": "2026-03-31",
            "initial_cash": 1000000,
            "holding_days": 20,
            "slippage_bps": 2.5,
            "max_position_pct": 0.08,
        },
    )

    assert response.status_code == 200
    result = response.json()["data"]["result"]
    assert result["execution_assumptions"]["slippage_bps"] == 2.5
    assert result["execution_assumptions"]["max_position_pct"] == 0.08
    assert result["audit_summary"]["skipped_count"] >= 1
    assert result["skipped_trades"][0]["reason"] in {"insufficient_future_bars", "missing_signal_bar"}
    assert "cost_breakdown" in result["trades"][0]


def test_backtest_history_route_returns_event_and_portfolio_runs(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_factors,
        upsert_signals,
    )

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_factors(
        [
            {
                "date": "2026-01-11",
                "symbol": "600519.SH",
                "atr14": 2.0,
            }
        ]
    )
    upsert_signals(
        [
            {
                "signal_id": "sig-history-backtest",
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
    event_response = client.post(
        "/api/backtests/event",
        json={
            "signal_names": ["趋势增强"],
            "start": "2026-01-01",
            "end": "2026-03-31",
        },
    )
    portfolio_response = client.post(
        "/api/backtests/portfolio",
        json={
            "start": "2026-01-01",
            "end": "2026-03-31",
            "initial_cash": 1000000,
            "holding_days": 20,
        },
    )
    assert event_response.status_code == 200
    assert portfolio_response.status_code == 200
    event_id = event_response.json()["data"]["backtest_id"]
    portfolio_id = portfolio_response.json()["data"]["backtest_id"]

    from tradingagents.api import backtest_routes

    backtest_routes._BACKTEST_RESULTS.clear()
    backtest_routes._PORTFOLIO_BACKTEST_RESULTS.clear()

    history = client.get("/api/backtests/history")
    assert history.status_code == 200
    payload = history.json()
    kinds = {item["kind"] for item in payload["data"]["runs"]}
    assert {"event", "portfolio"}.issubset(kinds)
    ids = {item["backtest_id"] for item in payload["data"]["runs"]}
    assert {event_id, portfolio_id}.issubset(ids)

    event_fetch = client.get(f"/api/backtests/event/{event_id}")
    portfolio_fetch = client.get(f"/api/backtests/portfolio/{portfolio_id}")
    assert event_fetch.status_code == 200
    assert portfolio_fetch.status_code == 200
