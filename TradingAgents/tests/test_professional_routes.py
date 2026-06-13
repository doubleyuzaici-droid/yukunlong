import json

from fastapi.testclient import TestClient

from tradingagents.api.server import create_app
from tradingagents.research.db import get_connection, init_db
from tradingagents.research.repository import upsert_daily_bars, upsert_factors, upsert_watchlist_symbols


def _seed_professional_data():
    init_db()
    upsert_watchlist_symbols(
        ["600519.SH", "000858.SZ", "000001.SZ"],
        industry="白酒",
        thesis="行业对比样本",
    )
    upsert_daily_bars(
        [
            {
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": 1500,
                "high": 1530,
                "low": 1490,
                "close": 1520,
                "volume": 10000,
                "amount": 15200000,
                "source": "akshare",
            },
            {
                "date": "2026-05-10",
                "symbol": "000858.SZ",
                "market": "CHINA",
                "open": 180,
                "high": 190,
                "low": 178,
                "close": 188,
                "volume": 12000,
                "amount": 2256000,
                "source": "akshare",
            },
            {
                "date": "2026-05-10",
                "symbol": "000001.SZ",
                "market": "CHINA",
                "open": 12,
                "high": 12.5,
                "low": 11.8,
                "close": 12.2,
                "volume": 30000,
                "amount": 366000,
                "source": "akshare",
            },
        ]
    )
    upsert_factors(
        [
            {
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "ret20": 0.08,
                "ret60": 0.12,
                "rsi14": 62,
                "atr14": 20,
                "rel_strength_index20": 0.05,
                "rel_strength_industry20": 0.02,
                "volume_ratio20": 1.4,
                "amount_ratio20": 1.3,
            },
            {
                "date": "2026-05-10",
                "symbol": "000858.SZ",
                "ret20": 0.03,
                "ret60": 0.07,
                "rsi14": 55,
                "atr14": 5,
                "rel_strength_index20": 0.01,
                "rel_strength_industry20": -0.02,
                "volume_ratio20": 1.1,
                "amount_ratio20": 1.0,
            },
            {
                "date": "2026-05-10",
                "symbol": "000001.SZ",
                "ret20": -0.02,
                "ret60": 0.01,
                "rsi14": 44,
                "atr14": 0.6,
                "rel_strength_index20": -0.04,
                "rel_strength_industry20": 0.00,
                "volume_ratio20": 0.8,
                "amount_ratio20": 0.7,
            },
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT OR REPLACE INTO security_master (
                symbol, raw_code, market, exchange, name, industry, currency, lot_size,
                list_date, is_st, is_active, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "600519.SH",
                "600519",
                "CHINA",
                "SH",
                "贵州茅台",
                "白酒",
                "CNY",
                100,
                "2001-08-27",
                0,
                1,
                "2026-05-10T00:00:00Z",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.execute(
            """
            INSERT INTO fundamental_snapshot (
                date, symbol, revenue, net_income, eps, roe, gross_margin,
                pe_ttm, pb, dividend_yield, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-05-10",
                "600519.SH",
                184000000000,
                86000000000,
                68.5,
                0.31,
                0.91,
                22.2,
                7.1,
                0.018,
                "fixture",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.execute(
            """
            INSERT INTO news_evidence (
                news_id, date, symbol, headline, source, url, sentiment,
                credibility, summary, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "n1",
                "2026-05-10",
                "600519.SH",
                "贵州茅台渠道价格保持稳定",
                "fixture-news",
                "https://example.test/news/1",
                "positive",
                0.82,
                "渠道库存和批价稳定。",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.execute(
            """
            INSERT INTO sync_trace (
                trace_id, symbol, job_type, start, end, primary_source,
                fallback_source, status, rows_written, elapsed_ms, error, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "trace-1",
                "600519.SH",
                "sync-bars",
                "2026-05-01",
                "2026-05-10",
                "akshare",
                "tushare",
                "success",
                10,
                1234,
                None,
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.execute(
            """
            INSERT INTO trade_log (
                trade_id, strategy_version, symbol, market, side, date,
                price, quantity, cost, reason, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "t1-entry",
                "portfolio_v1",
                "600519.SH",
                "CHINA",
                "entry",
                "2026-05-10",
                1520,
                100,
                45,
                "测试入场",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.execute(
            """
            INSERT INTO equity_curve (
                strategy_version, date, equity, cash, positions_value, drawdown
            )
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("portfolio_v1", "2026-05-10", 1010000, 858000, 152000, -0.01),
        )
        conn.commit()


def test_llm_config_routes_redact_secrets_and_validate_models(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OPENAI_API_KEY", "sk-from-env")
    client = TestClient(create_app())

    created = client.post(
        "/api/config/llm/providers",
        json={
            "provider": "openai",
            "display_name": "OpenAI Primary",
            "default_quick_model": "gpt-5.4-mini",
            "default_deep_model": "gpt-5.4",
            "base_url": "https://api.openai.com/v1",
            "api_key": "sk-secret-value",
            "enabled": True,
        },
    )
    assert created.status_code == 200
    assert created.json()["success"] is True

    response = client.get("/api/config/llm")
    assert response.status_code == 200
    payload = response.json()["data"]
    openai = next(item for item in payload["provider_configs"] if item["provider"] == "openai")
    assert openai["api_key_mask"] == "sk-***alue"
    assert "sk-secret-value" not in str(payload)
    assert payload["env_readiness"]["openai"]["configured"] is True

    validation = client.post(
        "/api/config/llm/validate",
        json={"provider": "openai", "model": "gpt-5.4"},
    )
    assert validation.status_code == 200
    assert validation.json()["data"]["model_known"] is True


def test_professional_fundamentals_news_factor_risk_and_sync_routes(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()
    client = TestClient(create_app())

    fundamentals = client.get("/api/professional/fundamentals?symbol=600519.SH&end=2026-05-10")
    assert fundamentals.status_code == 200
    fundamentals_payload = fundamentals.json()["data"]
    assert fundamentals_payload["security_profile"]["name"] == "贵州茅台"
    assert fundamentals_payload["valuation_snapshot"]["pe_ttm"] == 22.2
    assert fundamentals_payload["data_quality"]["fundamental_available"] is True

    news = client.get("/api/professional/news-evidence?symbol=600519.SH&end=2026-05-10")
    assert news.status_code == 200
    news_payload = news.json()["data"]
    assert news_payload["items"][0]["headline"] == "贵州茅台渠道价格保持稳定"
    assert news_payload["sentiment_distribution"]["positive"] == 1

    factors = client.get("/api/professional/factors?symbol=600519.SH&date=2026-05-10")
    assert factors.status_code == 200
    factors_payload = factors.json()["data"]
    assert factors_payload["rankings"]["rel_strength_index20"]["rank"] == 1
    assert factors_payload["industry_peer_count"] == 2

    risk = client.get("/api/professional/portfolio-risk?strategy_version=portfolio_v1&date=2026-05-10")
    assert risk.status_code == 200
    risk_payload = risk.json()["data"]
    assert risk_payload["exposure"]["gross_exposure"] == 152000
    assert risk_payload["concentration"]["top_symbol"] == "600519.SH"
    assert risk_payload["drawdown"]["current_drawdown"] == -0.01

    trace = client.get("/api/professional/sync-trace?symbol=600519.SH")
    assert trace.status_code == 200
    trace_payload = trace.json()["data"]
    assert trace_payload["traces"][0]["primary_source"] == "akshare"
    assert trace_payload["summary"]["success_count"] == 1


def test_professional_sync_lineage_factor_effectiveness_and_execution_queue(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()

    from tradingagents.research.repository import upsert_signals

    upsert_daily_bars(
        [
            {
                "date": "2026-05-31",
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": 1520,
                "high": 1580,
                "low": 1510,
                "close": 1570,
                "volume": 11000,
                "amount": 17270000,
                "source": "fixture",
            },
            {
                "date": "2026-05-31",
                "symbol": "000858.SZ",
                "market": "CHINA",
                "open": 188,
                "high": 190,
                "low": 180,
                "close": 181,
                "volume": 12000,
                "amount": 2172000,
                "source": "fixture",
            },
            {
                "date": "2026-05-31",
                "symbol": "000001.SZ",
                "market": "CHINA",
                "open": 12.2,
                "high": 12.4,
                "low": 11.8,
                "close": 11.9,
                "volume": 30000,
                "amount": 357000,
                "source": "fixture",
            },
        ]
    )
    upsert_signals(
        [
            {
                "signal_id": "sig-exec-1",
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 88,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO agent_decision_log (
                review_id, signal_id, date, symbol, action, confidence,
                bull_points_json, bear_points_json, risk_flags_json,
                missing_data_json, review_summary, model_name, prompt_version,
                created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "review-exec-1",
                "sig-exec-1",
                "2026-05-10",
                "600519.SH",
                "keep",
                "high",
                "[]",
                "[]",
                "[]",
                "[]",
                "保留观察",
                "fixture",
                "v1",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.commit()

    def fake_route_to_vendor(method, *args, **kwargs):
        if method == "get_fundamentals":
            return "China A-share fundamentals for 600519.SH as of 20260510: ROE=31.5, gross_margin=91.2, pe_ttm=22.8, pb=7.2."
        if method == "get_income_statement":
            return "China A-share income for 600519.SH as of 20260510: revenue=184000000000, n_income=86000000000."
        if method == "get_balance_sheet":
            return "China A-share balance sheet for 600519.SH as of 20260510: total_assets=220000000000, total_liab=40000000000, total_hldr_eqy=180000000000."
        if method == "get_cashflow":
            return "China A-share cashflow for 600519.SH as of 20260510: n_cashflow_act=92000000000, n_cashflow_inv_act=-12000000000, n_cash_flows_fin_act=-38000000000."
        if method == "get_news":
            return "# China A-share news for 600519.SH\n\n- **2026-05-10** 渠道价格稳定\n  批价和库存维持稳定。"
        return ""

    monkeypatch.setattr(
        "tradingagents.api.professional_routes.route_to_vendor",
        fake_route_to_vendor,
        raising=False,
    )

    client = TestClient(create_app())

    fundamentals_sync = client.post(
        "/api/professional/fundamentals/sync",
        json={"symbols": ["600519.SH"], "end": "2026-05-10", "source": "tushare"},
    )
    assert fundamentals_sync.status_code == 200
    assert fundamentals_sync.json()["data"]["rows_written"] == 1
    assert fundamentals_sync.json()["data"]["statement_rows_written"] == 3

    synced_fundamentals = client.get("/api/professional/fundamentals?symbol=600519.SH&end=2026-05-10")
    assert synced_fundamentals.status_code == 200
    financial_reports = synced_fundamentals.json()["data"]["financial_reports"]
    assert financial_reports["summary"]["available_count"] == 3
    assert financial_reports["latest_by_type"]["income"]["metrics"]["revenue"] == 184000000000
    assert financial_reports["latest_by_type"]["balance"]["metrics"]["total_assets"] == 220000000000
    assert financial_reports["latest_by_type"]["cashflow"]["metrics"]["operating_cashflow"] == 92000000000

    news_sync = client.post(
        "/api/professional/news-evidence/sync",
        json={"symbols": ["600519.SH"], "start": "2026-05-01", "end": "2026-05-10", "source": "akshare"},
    )
    assert news_sync.status_code == 200
    assert news_sync.json()["data"]["rows_written"] >= 1

    factors = client.get("/api/professional/factors?symbol=600519.SH&date=2026-05-10")
    assert factors.status_code == 200
    factor_payload = factors.json()["data"]
    assert factor_payload["factor_effectiveness"]["observations"] >= 1
    assert factor_payload["factor_effectiveness"]["method"] == "forward_20d_spearman"

    lineage = client.get("/api/professional/lineage?symbol=600519.SH&date=2026-05-10")
    assert lineage.status_code == 200
    lineage_payload = lineage.json()["data"]
    lineage_tables = {item["table"] for item in lineage_payload["items"]}
    assert {"daily_bars", "factor_daily", "fundamental_snapshot", "financial_statement", "news_evidence"}.issubset(lineage_tables)
    assert lineage_payload["summary"]["available_count"] >= 4

    decision = client.patch(
        "/api/agent-reviews/review-exec-1/decision",
        json={"decision_status": "adopted", "decision_note": "纳入模拟执行队列"},
    )
    assert decision.status_code == 200
    assert decision.json()["data"]["decision_status"] == "adopted"

    queue = client.get("/api/professional/execution-queue?date=2026-05-10")
    assert queue.status_code == 200
    queue_payload = queue.json()["data"]
    assert queue_payload["summary"]["candidate_count"] == 1
    assert queue_payload["items"][0]["execution_status"] == "approved"


def test_fundamentals_sync_yfinance_normalizes_hk_symbol_and_builds_quarterly_series(
    monkeypatch, tmp_path
):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    init_db()
    calls = []

    income_csv = """# Income Statement data for 1024.HK (quarterly)
,2026-03-31,2025-12-31,2025-09-30
Total Revenue,1000000000,900000000,800000000
Net Income,100000000,85000000,70000000
"""
    balance_csv = """# Balance Sheet data for 1024.HK (quarterly)
,2026-03-31,2025-12-31,2025-09-30
Stockholders Equity,500000000,480000000,460000000
"""
    cashflow_csv = """# Cash Flow data for 1024.HK (quarterly)
,2026-03-31,2025-12-31,2025-09-30
Operating Cash Flow,120000000,110000000,90000000
"""

    def fake_route_to_vendor(method, *args, **kwargs):
        calls.append((method, args, kwargs))
        assert args[0] == "1024.HK"
        assert kwargs.get("vendor") == "yfinance"
        if method == "get_income_statement":
            return income_csv
        if method == "get_balance_sheet":
            return balance_csv
        if method == "get_cashflow":
            return cashflow_csv
        return "# Company Fundamentals for 1024.HK"

    monkeypatch.setattr(
        "tradingagents.api.professional_routes.route_to_vendor",
        fake_route_to_vendor,
        raising=False,
    )

    client = TestClient(create_app())
    response = client.post(
        "/api/professional/fundamentals/sync",
        json={"symbols": ["01024.HK"], "end": "2026-05-18", "source": "yfinance"},
    )
    assert response.status_code == 200
    assert response.json()["data"]["statement_rows_written"] == 9
    assert {call[0] for call in calls} == {
        "get_fundamentals",
        "get_income_statement",
        "get_balance_sheet",
        "get_cashflow",
    }

    series_response = client.get(
        "/api/professional/fundamentals-quarterly?symbol=01024.HK&end=2026-05-18&quarters=3"
    )
    assert series_response.status_code == 200
    series = series_response.json()["data"]["quarterly_series"]
    assert series["quarters"] == ["25Q3", "25Q4", "26Q1"]
    assert series["revenue"] == [8.0, 9.0, 10.0]
    assert series["net_income"] == [0.7, 0.85, 1.0]


def test_quality_metrics_route_derives_cashflow_and_margin_ratios(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    init_db()
    with get_connection() as conn:
        for statement_type, metrics in (
            (
                "income",
                {
                    "revenue": 184_000_000_000,
                    "net_income": 86_000_000_000,
                    "gross_margin": 0.912,
                    "roe": 0.315,
                },
            ),
            (
                "balance",
                {
                    "total_assets": 220_000_000_000,
                    "total_liabilities": 40_000_000_000,
                    "total_equity": 180_000_000_000,
                },
            ),
            (
                "cashflow",
                {
                    "operating_cashflow": 92_000_000_000,
                    "capital_expenditure": -12_000_000_000,
                    "free_cashflow": 80_000_000_000,
                },
            ),
        ):
            conn.execute(
                """
                INSERT INTO financial_statement (
                    date, symbol, statement_type, period, metrics_json,
                    source, raw_text, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "2026-05-10",
                    "600519.SH",
                    statement_type,
                    "26Q1",
                    json.dumps(metrics),
                    "fixture",
                    "",
                    "2026-05-10T00:00:00Z",
                ),
            )
        conn.execute(
            """
            INSERT INTO fundamental_snapshot (
                date, symbol, revenue, net_income, eps, roe, gross_margin,
                pe_ttm, pb, dividend_yield, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-05-10",
                "600519.SH",
                184_000_000_000,
                86_000_000_000,
                68.5,
                0.315,
                0.912,
                22.2,
                7.1,
                0.018,
                "fixture",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get(
        "/api/professional/quality-metrics?symbol=600519.SH&date=2026-05-10"
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["symbol"] == "600519.SH"
    assert payload["available"] is True
    assert payload["gross_margin"] == 0.912
    assert round(payload["net_margin"], 4) == 0.4674
    assert round(payload["ocf_to_net_income"], 4) == 1.0698
    assert payload["free_cashflow"] == 80_000_000_000
    assert round(payload["debt_to_assets"], 4) == 0.1818
    assert payload["roe"] == 0.315
    assert 0 <= payload["quality_score"] <= 1
    assert any(item["key"] == "cashflow_quality" for item in payload["flags"])


def test_holding_concentration_route_returns_latest_structure(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    init_db()
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO holding_concentration (
                date, symbol, northbound_float_pct, northbound_total_pct,
                fund_float_pct, fund_count, shareholder_count,
                shareholder_count_delta_pct, top10_holder_pct, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-05-10",
                "600519.SH",
                0.124,
                0.118,
                0.087,
                132,
                125000,
                -0.08,
                0.642,
                "fixture",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get(
        "/api/professional/holding-concentration?symbol=600519.SH&date=2026-05-10"
    )

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["symbol"] == "600519.SH"
    assert payload["available"] is True
    assert payload["northbound_float_pct"] == 0.124
    assert payload["fund_float_pct"] == 0.087
    assert payload["shareholder_count"] == 125000
    assert payload["shareholder_count_delta_pct"] == -0.08
    assert 0 <= payload["concentration_score"] <= 1
    item_keys = {item["key"] for item in payload["items"]}
    assert {"northbound", "fund", "shareholders", "top10"}.issubset(item_keys)


def test_professional_decision_brief_layers_trust_signal_risk_and_audit(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()

    from tradingagents.research.repository import upsert_signals

    upsert_signals(
        [
            {
                "signal_id": "sig-brief-1",
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": '["趋势强于行业", "量能确认"]',
                "risk_json": '["止损距离 3%"]',
                "invalid_json": "[]",
                "score": 91,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO agent_decision_log (
                review_id, signal_id, date, symbol, action, confidence,
                bull_points_json, bear_points_json, risk_flags_json,
                missing_data_json, review_summary, model_name, prompt_version,
                decision_status, decision_note, resolved_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "review-brief-1",
                "sig-brief-1",
                "2026-05-10",
                "600519.SH",
                "keep",
                "high",
                '["趋势和估值均可解释"]',
                "[]",
                '["关注高端白酒批价"]',
                "[]",
                "保留并纳入模拟执行。",
                "fixture",
                "v1",
                "adopted",
                "纳入今日模拟队列",
                "2026-05-10T08:00:00Z",
                "2026-05-10T07:30:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/professional/decision-brief?symbol=600519.SH&date=2026-05-10")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["decision_layer"]["status"] == "actionable"
    assert payload["decision_layer"]["label"] == "可进入研究执行"
    assert payload["trust"]["coverage"] >= 0.8
    assert payload["today"]["top_signal"]["signal_id"] == "sig-brief-1"
    assert payload["today"]["queue_summary"]["approved_count"] == 1
    assert payload["risk"]["position_count"] == 1
    assert payload["layers"][0]["key"] == "decision"
    assert {item["target_view"] for item in payload["explainers"]} >= {"symbolWorkspace", "backtest", "review"}
    assert any(step["priority"] == "P0" for step in payload["next_steps"])
    assert payload["audit"]["sync_trace_count"] == 1


def test_professional_decision_brief_filters_execution_queue_to_current_symbol(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()

    from tradingagents.research.repository import upsert_daily_bars, upsert_signals

    upsert_daily_bars(
        [
            {
                "date": "2026-05-10",
                "symbol": "000858.SZ",
                "market": "CHINA",
                "open": 180,
                "high": 190,
                "low": 178,
                "close": 188,
                "volume": 12000,
                "amount": 2256000,
                "source": "fixture",
            }
        ]
    )
    upsert_signals(
        [
            {
                "signal_id": "sig-target-pending",
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 90,
                "strategy_version": "resonance_v2_conservative",
            },
            {
                "signal_id": "sig-other-adopted",
                "date": "2026-05-10",
                "symbol": "000858.SZ",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 89,
                "strategy_version": "resonance_v2_conservative",
            },
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO agent_decision_log (
                review_id, signal_id, date, symbol, action, confidence,
                bull_points_json, bear_points_json, risk_flags_json,
                missing_data_json, review_summary, model_name, prompt_version,
                decision_status, decision_note, resolved_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "review-other-adopted",
                "sig-other-adopted",
                "2026-05-10",
                "000858.SZ",
                "keep",
                "high",
                "[]",
                "[]",
                "[]",
                "[]",
                "其他标的已采纳",
                "fixture",
                "v1",
                "adopted",
                "只适用于其他标的",
                "2026-05-10T08:00:00Z",
                "2026-05-10T07:30:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/professional/decision-brief?symbol=600519.SH&date=2026-05-10")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["today"]["queue_summary"]["approved_count"] == 0
    assert payload["decision_layer"]["status"] == "watch"


def test_execution_queue_prefers_latest_resolved_review_decision(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()

    from tradingagents.research.repository import upsert_signals

    upsert_signals(
        [
            {
                "signal_id": "sig-review-order",
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 90,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )
    with get_connection() as conn:
        for row in [
            (
                "review-created-later",
                "adopted",
                "较早完成人工采纳",
                "2026-05-10T10:00:00Z",
                "2026-05-10T09:00:00Z",
            ),
            (
                "review-resolved-later",
                "watch",
                "后续复核改为观察",
                "2026-05-10T08:00:00Z",
                "2026-05-10T11:00:00Z",
            ),
        ]:
            conn.execute(
                """
                INSERT INTO agent_decision_log (
                    review_id, signal_id, date, symbol, action, confidence,
                    bull_points_json, bear_points_json, risk_flags_json,
                    missing_data_json, review_summary, model_name, prompt_version,
                    decision_status, decision_note, created_at, resolved_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    row[0],
                    "sig-review-order",
                    "2026-05-10",
                    "600519.SH",
                    "keep",
                    "high",
                    "[]",
                    "[]",
                    "[]",
                    "[]",
                    row[2],
                    "fixture",
                    "v1",
                    row[1],
                    row[2],
                    row[3],
                    row[4],
                ),
            )
        conn.commit()

    client = TestClient(create_app())
    queue = client.get("/api/professional/execution-queue?date=2026-05-10&symbol=600519.SH")

    assert queue.status_code == 200
    item = queue.json()["data"]["items"][0]
    assert item["decision_status"] == "watch"
    assert item["execution_status"] == "candidate"
    assert item["review_id"] == "review-resolved-later"


def test_professional_trading_plan_calendar_and_risk_gate(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()

    from tradingagents.research.repository import upsert_signals

    upsert_signals(
        [
            {
                "signal_id": "sig-plan-1",
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": '["收盘站上MA20", "MACD转强", "量能确认"]',
                "risk_json": '["高开追涨风险", "跌破MA20失效"]',
                "invalid_json": '["收盘跌破硬止损", "Agent审查驳回"]',
                "score": 92,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE daily_bars
            SET adj_factor = 1.0, limit_up = 1672, limit_down = 1368, is_suspended = 0
            WHERE symbol = ? AND date = ?
            """,
            ("600519.SH", "2026-05-10"),
        )
        conn.execute(
            """
            INSERT INTO agent_decision_log (
                review_id, signal_id, date, symbol, action, confidence,
                bull_points_json, bear_points_json, risk_flags_json,
                missing_data_json, review_summary, model_name, prompt_version,
                decision_status, decision_note, resolved_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "review-plan-1",
                "sig-plan-1",
                "2026-05-10",
                "600519.SH",
                "keep",
                "high",
                '["趋势、量能和相对强度共振"]',
                '["涨停附近不追价"]',
                '["若高开超过计划上沿则等待回落"]',
                "[]",
                "可以纳入模拟执行，但必须受仓位和硬止损约束。",
                "fixture",
                "v1",
                "adopted",
                "纳入交易计划",
                "2026-05-10T08:00:00Z",
                "2026-05-10T07:30:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/professional/trading-plan?signal_id=sig-plan-1")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["signal_id"] == "sig-plan-1"
    assert payload["action"] == "buy"
    assert payload["risk_gate"]["status"] == "pass"
    assert payload["entry_zone"]["low"] < payload["entry_zone"]["high"]
    assert payload["hard_stop"] < payload["entry_zone"]["low"]
    assert 0 < payload["max_position_pct"] <= 0.12
    assert any(item["key"] == "hard_stop" for item in payload["intraday_monitors"])
    assert len(payload["scenario_playbook"]) >= 4
    assert any("按计划入场" in item["label"] for item in payload["discipline_checklist"])
    assert payload["no_trade_reasons"] == []

    calendar = client.get("/api/professional/trading-calendar?date=2026-05-10")
    assert calendar.status_code == 200
    calendar_payload = calendar.json()["data"]
    assert calendar_payload["summary"]["plan_count"] >= 1
    assert calendar_payload["summary"]["monitor_count"] >= 1
    assert calendar_payload["items"][0]["signal_id"] == "sig-plan-1"
    assert calendar_payload["items"][0]["next_step"] == "按交易计划执行并进入盘中监控"

    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO data_quality_log (
                date, check_name, severity, symbol, message, created_at, resolution_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-05-10",
                "daily-bar-gap",
                "critical",
                "600519.SH",
                "核心行情存在缺口，禁止生成买入计划。",
                "2026-05-10T09:00:00Z",
                "open",
            ),
        )
        conn.commit()

    blocked = client.get("/api/professional/trading-plan?signal_id=sig-plan-1")
    assert blocked.status_code == 200
    blocked_payload = blocked.json()["data"]
    assert blocked_payload["action"] == "blocked"
    assert blocked_payload["risk_gate"]["status"] == "blocked"
    assert any("核心行情存在缺口" in reason for reason in blocked_payload["no_trade_reasons"])


def test_professional_governance_matrix_tracks_p0_p1_requirements(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()

    from tradingagents.research.repository import upsert_signals

    upsert_signals(
        [
            {
                "signal_id": "sig-governance-1",
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2 多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 90,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            UPDATE daily_bars
            SET adj_factor = 1.25, limit_up = 1672, limit_down = 1368, is_suspended = 0
            WHERE symbol = ? AND date = ?
            """,
            ("600519.SH", "2026-05-10"),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO index_bars (
                date, index_symbol, market, open, high, low, close, volume, amount, source, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-05-10",
                "000300.SH",
                "CHINA",
                4000,
                4050,
                3980,
                4020,
                1000000,
                400000000,
                "fixture",
                "2026-05-10T00:00:00Z",
            ),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO event_return (
                signal_id, entry_date, entry_price, ret_5d, ret_20d, ret_60d,
                excess_index_20d, excess_industry_20d, max_adverse_20d,
                max_favorable_20d, success_flag, fail_reason, market_regime, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "sig-governance-1",
                "2026-05-11",
                1530,
                0.02,
                0.06,
                0.09,
                0.03,
                0.01,
                -0.015,
                0.08,
                1,
                None,
                "risk_on",
                "2026-05-31T00:00:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/professional/investment-governance?symbol=600519.SH&date=2026-05-10")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["summary"]["p0_total"] >= 5
    assert payload["summary"]["p1_total"] >= 6
    assert payload["summary"]["decision_blocked"] is False
    assert payload["summary"]["maturity_score"] > 0.5
    p0 = {item["key"]: item for item in payload["groups"]["P0"]}
    assert p0["price_adjustment_trading_rules"]["status"] == "ready"
    assert p0["universe_benchmark"]["status"] == "ready"
    assert p0["signal_attribution"]["status"] == "ready"
    p1 = {item["key"]: item for item in payload["groups"]["P1"]}
    assert p1["fundamental_depth"]["status"] == "ready"
    assert p1["portfolio_risk_depth"]["target_view"] == "portfolioRisk"
    assert payload["groups"]["P0"][0]["depth"] == "audit"


def test_professional_governance_hk_equity_uses_hk_rules_and_ignores_stale_sync_errors(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_index_bars, upsert_signals

    init_db()
    upsert_watchlist_symbols(["00700.HK"], market="HONGKONG", industry="互联网")
    upsert_daily_bars(
        [
            {
                "date": "2026-05-15",
                "symbol": "00700.HK",
                "market": "HONGKONG",
                "open": 459.0,
                "high": 462.6,
                "low": 454.2,
                "close": 456.4,
                "volume": 26449868,
                "amount": 12109673878,
                "is_suspended": 0,
                "source": "fixture-hk",
            }
        ]
    )
    upsert_index_bars(
        [
            {
                "date": "2026-05-15",
                "index_symbol": "HSI",
                "market": "HONGKONG",
                "open": 26391.02,
                "high": 26391.02,
                "low": 25847.15,
                "close": 25962.73,
                "volume": 19830055956,
                "amount": 325385515870,
                "source": "fixture-index",
            }
        ]
    )
    upsert_signals(
        [
            {
                "signal_id": "sig-hk-governance",
                "date": "2026-05-15",
                "symbol": "00700.HK",
                "market": "HONGKONG",
                "signal_name": "V2多指标共振",
                "signal_level": "B",
                "direction": "risk",
                "timeframe": "weekly+daily",
                "evidence_json": "[]",
                "risk_json": "[]",
                "invalid_json": "[]",
                "score": 65,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO data_quality_log (
                date, check_name, severity, symbol, message, created_at, resolution_status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "2026-05-11",
                "data_sync",
                "error",
                "00700.HK",
                "旧同步失败，后续已被更新行情覆盖。",
                "2026-05-11T09:00:00Z",
                "open",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/professional/investment-governance?symbol=00700.HK&date=2026-05-15")

    assert response.status_code == 200
    payload = response.json()["data"]
    p0 = {item["key"]: item for item in payload["groups"]["P0"]}
    assert p0["price_adjustment_trading_rules"]["status"] != "blocker"
    assert "港股" in "；".join(p0["price_adjustment_trading_rules"]["evidence"])
    assert p0["hard_data_block"]["status"] == "ready"
    assert "阻断问题 0" in p0["hard_data_block"]["evidence"]


def test_professional_trade_proxy_maps_indexes_and_direct_equity(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_index_bars

    init_db()
    upsert_index_bars(
        [
            {
                "date": f"2026-01-{day:02d}",
                "index_symbol": "HSI",
                "market": "HONGKONG",
                "open": 25000 + day,
                "high": 25200 + day,
                "low": 24900 + day,
                "close": 25100 + day,
                "volume": 100000000,
                "amount": 12000000000,
                "source": "fixture-index",
            }
            for day in range(1, 31)
        ]
    )

    client = TestClient(create_app())
    hsi = client.get("/api/professional/trade-proxy?symbol=HSI&date=2026-01-30")
    equity = client.get("/api/professional/trade-proxy?symbol=00700.HK&date=2026-01-30")
    governance = client.get("/api/professional/investment-governance?symbol=HSI&date=2026-01-30")

    assert hsi.status_code == 200
    hsi_payload = hsi.json()["data"]
    assert hsi_payload["asset_type"] == "index"
    assert hsi_payload["status"] == "mapped"
    assert hsi_payload["default_proxy"]["symbol"] == "2800.HK"
    assert hsi_payload["default_proxy"]["proxy_type"] == "ETF"
    assert any(item["key"] == "liquidity" for item in hsi_payload["execution_checks"])

    assert equity.status_code == 200
    equity_payload = equity.json()["data"]
    assert equity_payload["asset_type"] == "equity"
    assert equity_payload["status"] == "direct"
    assert equity_payload["default_proxy"]["symbol"] == "00700.HK"

    p1 = {item["key"]: item for item in governance.json()["data"]["groups"]["P1"]}
    assert p1["trade_proxy_mapping"]["status"] == "ready"
    assert "2800.HK" in " ".join(p1["trade_proxy_mapping"]["evidence"])


def test_professional_signal_explain_unifies_evidence_review_attribution_and_proxy(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    _seed_professional_data()

    from tradingagents.research.repository import upsert_signals

    upsert_signals(
        [
            {
                "signal_id": "sig-explain-1",
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "V2多指标共振",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "weekly+daily",
                "evidence_json": '["M1周线强多头", "M3买入触发"]',
                "risk_json": '["止损距离 3%"]',
                "invalid_json": '["跌破硬止损"]',
                "score": 91,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO agent_decision_log (
                review_id, signal_id, date, symbol, action, confidence,
                bull_points_json, bear_points_json, risk_flags_json,
                missing_data_json, review_summary, model_name, prompt_version,
                decision_status, decision_note, resolved_at, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "review-explain-1",
                "sig-explain-1",
                "2026-05-10",
                "600519.SH",
                "keep",
                "high",
                '["趋势与量能同向"]',
                "[]",
                '["关注回撤"]',
                "[]",
                "可进入模拟观察。",
                "fixture",
                "v1",
                "adopted",
                "纳入计划",
                "2026-05-10T08:00:00Z",
                "2026-05-10T07:30:00Z",
            ),
        )
        conn.execute(
            """
            INSERT OR REPLACE INTO event_return (
                signal_id, entry_date, entry_price, ret_5d, ret_20d, ret_60d,
                excess_index_20d, excess_industry_20d, max_adverse_20d,
                max_favorable_20d, success_flag, fail_reason, market_regime, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "sig-explain-1",
                "2026-05-11",
                1530,
                0.02,
                0.06,
                0.08,
                0.03,
                0.01,
                -0.015,
                0.09,
                1,
                None,
                "risk_on",
                "2026-05-31T00:00:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/professional/signal-explain?signal_id=sig-explain-1")

    assert response.status_code == 200
    payload = response.json()["data"]
    assert payload["signal"]["signal_id"] == "sig-explain-1"
    assert payload["layers"]["decision"]["action"] == "buy"
    assert payload["layers"]["explain"]["evidence"][0] == "M1周线强多头"
    assert payload["layers"]["audit"]["lineage"]["summary"]["coverage"] >= 0.8
    assert payload["review"]["decision_status"] == "adopted"
    assert payload["attribution"]["ret_20d"] == 0.06
    assert payload["trading_plan"]["risk_gate"]["status"] in {"pass", "warn"}
    assert payload["trade_proxy"]["status"] == "direct"


def test_professional_routes_treat_supported_index_as_index_not_missing_equity_data(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_index_bars, upsert_signals

    init_db()
    upsert_index_bars(
        [
            {
                "date": f"2026-01-{day:02d}",
                "index_symbol": "000852.SH",
                "market": "CHINA",
                "open": 8000 + day,
                "high": 8060 + day,
                "low": 7970 + day,
                "close": 8010 + day * 3,
                "volume": 300000000 + day,
                "amount": 500000000000 + day,
                "source": "fixture-index",
            }
            for day in range(1, 31)
        ]
    )
    upsert_signals(
        [
            {
                "signal_id": "sig-index-1",
                "date": "2026-01-30",
                "symbol": "000852.SH",
                "market": "CHINA",
                "signal_name": "V2多指标共振",
                "signal_level": "C",
                "direction": "opportunity",
                "timeframe": "weekly+daily",
                "evidence_json": '["指数趋势改善"]',
                "risk_json": '["小盘风格波动较高"]',
                "invalid_json": "[]",
                "score": 33,
                "strategy_version": "resonance_v2_conservative",
            }
        ]
    )

    client = TestClient(create_app())

    factors = client.get("/api/professional/factors?symbol=000852.SH&date=2026-01-30")
    assert factors.status_code == 200
    factor_payload = factors.json()["data"]
    assert factor_payload["asset_type"] == "index"
    assert factor_payload["factor_snapshot"]["source"] == "index_bars_derived"
    assert factor_payload["factor_snapshot"]["ret20"] is not None

    lineage = client.get("/api/professional/lineage?symbol=000852.SH&date=2026-01-30")
    assert lineage.status_code == 200
    lineage_payload = lineage.json()["data"]
    assert lineage_payload["asset_type"] == "index"
    assert lineage_payload["summary"]["coverage"] >= 0.75
    assert "daily_bars" not in {
        item["table"] for item in lineage_payload["items"] if item["status"] == "missing"
    }
    assert "factor_daily" not in {
        item["table"] for item in lineage_payload["items"] if item["status"] == "missing"
    }

    governance = client.get(
        "/api/professional/investment-governance?symbol=000852.SH&date=2026-01-30"
    )
    assert governance.status_code == 200
    governance_payload = governance.json()["data"]
    assert governance_payload["asset_type"] == "index"
    assert governance_payload["summary"]["decision_blocked"] is False
    assert governance_payload["summary"]["p0_blocker_count"] == 0

    brief = client.get("/api/professional/decision-brief?symbol=000852.SH&date=2026-01-30")
    assert brief.status_code == 200
    brief_payload = brief.json()["data"]
    assert brief_payload["trust"]["level"] != "blocked"
    assert brief_payload["decision_layer"]["status"] != "blocked"


def test_professional_analysis_readiness_flags_hk_symbol_gaps(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    init_db()
    upsert_watchlist_symbols(
        ["01024.HK"],
        market="HONGKONG",
        name="快手-W",
        industry="互联网",
        thesis="港股成长互联网样本",
    )
    upsert_daily_bars(
        [
            {
                "date": "2026-05-14",
                "symbol": "01024.HK",
                "market": "HONGKONG",
                "open": 50.2,
                "high": 51.4,
                "low": 49.8,
                "close": 50.85,
                "volume": 61207264,
                "amount": 3169512818,
                "source": "fixture-hk",
            },
            {
                "date": "2026-05-15",
                "symbol": "01024.HK",
                "market": "HONGKONG",
                "open": 50.6,
                "high": 51.0,
                "low": 48.8,
                "close": 49.34,
                "volume": 50533425,
                "amount": 2505114852,
                "source": "fixture-hk",
            },
        ]
    )
    upsert_factors(
        [
            {
                "date": "2026-05-15",
                "symbol": "01024.HK",
                "ma20": 46.816,
                "ma60": 52.97,
                "rsi14": 64.46,
                "ret20": 0.048,
                "ret60": -0.304,
                "rel_strength_index20": 0.065,
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO news_evidence (
                news_id, date, symbol, headline, source, url, sentiment,
                credibility, summary, created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "placeholder-news",
                "2026-05-15",
                "01024.HK",
                "No news found for 01024.HK",
                "auto",
                None,
                "neutral",
                0.55,
                "No news found for 01024.HK",
                "2026-05-15T00:00:00Z",
            ),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get("/api/professional/analysis-readiness?symbol=1024.HK&date=2026-05-15")

    assert response.status_code == 200
    payload = response.json()["data"]
    categories = {item["key"]: item for item in payload["categories"]}
    assert payload["symbol"] == "01024.HK"
    assert payload["level"] == "partial"
    assert categories["market_data"]["status"] == "ready"
    assert categories["technical_factors"]["status"] == "ready"
    assert categories["security_master"]["status"] == "warn"
    assert categories["fundamentals"]["status"] == "warn"
    assert categories["news_evidence"]["status"] == "warn"
    assert categories["news_evidence"]["metadata"]["valid_count"] == 0
    assert categories["fund_flow"]["status"] == "warn"
    assert categories["signals"]["status"] == "warn"
    assert categories["agent_review"]["status"] == "warn"
    assert categories["attribution"]["status"] == "warn"
    assert payload["summary"]["warn_count"] >= 6
    next_action_keys = {item["key"] for item in payload["next_actions"]}
    assert {"complete_security_master", "sync_fundamentals", "replace_placeholder_news"}.issubset(next_action_keys)


def test_checkpoint_resume_route_creates_checkpoint_enabled_task(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    captured = {}

    class DummyManager:
        def create_task(self, request):
            captured["request"] = request
            return "resume-task"

    monkeypatch.setattr(
        "tradingagents.api.operability_routes.TaskManager.get_instance",
        lambda: DummyManager(),
        raising=False,
    )
    client = TestClient(create_app())

    response = client.post(
        "/api/checkpoints/600519.SH/2026-05-10/resume",
        json={
            "market_profile": "china",
            "research_depth": "deep",
            "llm_provider": "openai",
            "deep_think_llm": "gpt-5.4",
            "quick_think_llm": "gpt-5.4-mini",
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["task_id"] == "resume-task"
    assert captured["request"].checkpoint_enabled is True
    assert captured["request"].clear_checkpoint_before_run is False
