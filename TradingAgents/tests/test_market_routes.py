from fastapi.testclient import TestClient


def _seed_market_rows(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import (
        upsert_daily_bars,
        upsert_index_bars,
        upsert_watchlist_symbols,
    )

    init_db()
    upsert_watchlist_symbols(["600519.SH", "00700.HK", "AAPL"])
    upsert_daily_bars(
        [
            {
                "date": "2026-01-08",
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": 1680.0,
                "high": 1710.0,
                "low": 1668.0,
                "close": 1700.0,
                "volume": 900000,
                "amount": 1500000000,
                "source": "fixture",
            },
            {
                "date": "2026-01-09",
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": 1705.0,
                "high": 1730.0,
                "low": 1698.0,
                "close": 1720.0,
                "volume": 1000000,
                "amount": 1700000000,
                "source": "fixture",
            },
            {
                "date": "2026-01-08",
                "symbol": "00700.HK",
                "market": "HONGKONG",
                "open": 300.0,
                "high": 305.0,
                "low": 296.0,
                "close": 304.0,
                "volume": 8000000,
                "amount": 2400000000,
                "source": "fixture",
            },
            {
                "date": "2026-01-09",
                "symbol": "00700.HK",
                "market": "HONGKONG",
                "open": 302.0,
                "high": 303.0,
                "low": 288.0,
                "close": 290.0,
                "volume": 9000000,
                "amount": 2700000000,
                "source": "fixture",
            },
        ]
    )
    upsert_index_bars(
        [
            {
                "date": "2026-01-08",
                "index_symbol": "000905.SH",
                "market": "CHINA",
                "open": 8200.0,
                "high": 8260.0,
                "low": 8180.0,
                "close": 8240.0,
                "volume": 200000000,
                "amount": 430000000000.0,
                "source": "fixture-index",
            },
            {
                "date": "2026-01-09",
                "index_symbol": "000905.SH",
                "market": "CHINA",
                "open": 8250.0,
                "high": 8330.0,
                "low": 8220.0,
                "close": 8310.0,
                "volume": 210000000,
                "amount": 450000000000.0,
                "source": "fixture-index",
            },
        ]
    )


def test_market_quotes_return_latest_price_change_and_progress(tmp_path, monkeypatch):
    _seed_market_rows(monkeypatch, tmp_path)

    from tradingagents.api.server import create_app

    client = TestClient(create_app())
    response = client.get("/api/market/quotes?symbols=600519.SH,00700.HK,AAPL")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["requested_count"] == 3
    assert payload["data"]["loaded_count"] == 2

    quotes = {row["symbol"]: row for row in payload["data"]["quotes"]}
    assert quotes["600519.SH"]["price"] == 1720.0
    assert quotes["600519.SH"]["prev_close"] == 1700.0
    assert quotes["600519.SH"]["change"] == 20.0
    assert round(quotes["600519.SH"]["change_pct"], 4) == 0.0118
    assert quotes["600519.SH"]["status"] == "ok"
    assert quotes["600519.SH"]["data_age_days"] >= 0
    assert quotes["600519.SH"]["freshness_status"] in {"fresh", "delayed", "stale"}
    assert quotes["600519.SH"]["freshness_text"]
    assert quotes["600519.SH"]["delay_policy"] == "本地日线缓存，非实时行情"
    assert quotes["AAPL"]["status"] == "missing"


def test_market_history_returns_quote_and_recent_bars(tmp_path, monkeypatch):
    _seed_market_rows(monkeypatch, tmp_path)

    from tradingagents.api.server import create_app

    client = TestClient(create_app())
    response = client.get(
        "/api/market/history?symbol=600519.SH&start=2026-01-01&end=2026-01-31"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["symbol"] == "600519.SH"
    assert payload["data"]["quote"]["price"] == 1720.0
    assert [row["date"] for row in payload["data"]["bars"]] == [
        "2026-01-08",
        "2026-01-09",
    ]


def test_market_history_supports_csi500_alias_from_index_bars(tmp_path, monkeypatch):
    _seed_market_rows(monkeypatch, tmp_path)

    from tradingagents.api.server import create_app

    client = TestClient(create_app())
    response = client.get(
        "/api/market/history?symbol=399905&start=2026-01-01&end=2026-01-31"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["symbol"] == "000905.SH"
    assert payload["data"]["asset_type"] == "index"
    assert payload["data"]["alias_symbol"] == "399905"
    assert payload["data"]["quote"]["price"] == 8310.0
    assert payload["data"]["quote"]["source"] == "fixture-index"
    assert [row["date"] for row in payload["data"]["bars"]] == [
        "2026-01-08",
        "2026-01-09",
    ]


def test_market_history_supports_sse50_chinese_alias_from_index_bars(tmp_path, monkeypatch):
    _seed_market_rows(monkeypatch, tmp_path)

    from tradingagents.api.server import create_app
    from tradingagents.research.repository import upsert_index_bars

    upsert_index_bars(
        [
            {
                "date": "2026-01-09",
                "index_symbol": "000016.SH",
                "market": "CHINA",
                "open": 2900.0,
                "high": 2930.0,
                "low": 2888.0,
                "close": 2921.0,
                "volume": 120000000,
                "amount": 280000000000.0,
                "source": "fixture-sse50",
            }
        ]
    )

    client = TestClient(create_app())
    response = client.get(
        "/api/market/history?symbol=中证50&start=2026-01-01&end=2026-01-31"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["symbol"] == "000016.SH"
    assert payload["data"]["asset_type"] == "index"
    assert payload["data"]["name"] == "上证50"
    assert payload["data"]["display_name"] == "上证50 / 000016.SH"
    assert payload["data"]["alias_notice"] == "中证50 已标准化为 上证50 / 000016.SH"
    assert payload["data"]["quote"]["price"] == 2921.0


def test_market_pulse_summarizes_watchlist_breadth_and_movers(tmp_path, monkeypatch):
    _seed_market_rows(monkeypatch, tmp_path)

    from tradingagents.api.server import create_app

    client = TestClient(create_app())
    response = client.get("/api/market/pulse")

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["latest_date"] == "2026-01-09"
    assert payload["data"]["breadth"]["advancers"] == 1
    assert payload["data"]["breadth"]["decliners"] == 1
    assert payload["data"]["breadth"]["loaded_count"] == 2
    assert payload["data"]["freshness"]["latest_date"] == "2026-01-09"
    assert payload["data"]["freshness"]["stale_count"] >= 0
    assert payload["data"]["gainers"][0]["symbol"] == "600519.SH"
    assert payload["data"]["losers"][0]["symbol"] == "00700.HK"


def test_market_context_returns_factor_flow_rules_and_state(tmp_path, monkeypatch):
    _seed_market_rows(monkeypatch, tmp_path)

    from tradingagents.research.db import get_connection
    from tradingagents.research.repository import upsert_factors, upsert_fund_flows
    from tradingagents.api.server import create_app

    upsert_factors(
        [
            {
                "date": "2026-01-09",
                "symbol": "600519.SH",
                "ma20": 1688.0,
                "ma60": 1620.0,
                "ma120": 1580.0,
                "rsi14": 61.2,
                "atr14": 28.4,
                "volume_ratio20": 1.35,
                "amount_ratio20": 1.42,
                "ret20": 0.055,
                "ret60": 0.12,
                "rel_strength_index20": 0.034,
                "rel_strength_industry20": 0.015,
                "weekly_state": "uptrend",
                "monthly_state": "range",
                "main_net_inflow_ratio20": 1.8,
                "northbound_inflow_5d": 250000000.0,
            }
        ]
    )
    upsert_fund_flows(
        [
            {
                "date": "2026-01-09",
                "symbol": "600519.SH",
                "main_net_inflow": 90000000.0,
                "large_net_inflow": 30000000.0,
                "northbound_net_inflow": 50000000.0,
            }
        ]
    )
    with get_connection() as conn:
        conn.execute(
            """
            INSERT INTO security_master (
                symbol, raw_code, market, exchange, name, industry, currency,
                lot_size, list_date, is_st, is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                "2026-01-06",
                1,
                1,
            ),
        )
        conn.execute(
            """
            UPDATE daily_bars
            SET limit_up = close, limit_down = 1548.0, is_suspended = 0
            WHERE symbol = ? AND date = ?
            """,
            ("600519.SH", "2026-01-09"),
        )
        conn.commit()

    client = TestClient(create_app())
    response = client.get(
        "/api/market/context?symbol=600519.SH&start=2026-01-01&end=2026-01-31"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["symbol"] == "600519.SH"
    assert payload["data"]["factor_snapshot"]["ma20"] == 1688.0
    assert payload["data"]["fund_flow_snapshot"]["main_net_inflow"] == 90000000.0
    assert payload["data"]["market_state"]["regime"] == "bull_trend"
    assert payload["data"]["trading_rules"]["market"] == "china"
    assert payload["data"]["trading_rules"]["price_limit_pct"] is None
    assert payload["data"]["trading_rules"]["is_st"] is True
    assert payload["data"]["trading_rules"]["is_limit_up"] is True
    assert payload["data"]["trading_rules"]["is_first_five_listing_days"] is True
    assert payload["data"]["trading_rules"]["calendar"]["latest_trade_date"] == "2026-01-09"
    assert payload["data"]["data_coverage"]["factor_rows"] == 1


def test_market_context_supports_index_bars_with_derived_technicals(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.api.server import create_app
    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_index_bars

    init_db()
    upsert_index_bars(
        [
            {
                "date": f"2026-01-{day:02d}",
                "index_symbol": "000852.SH",
                "market": "CHINA",
                "open": 8000 + day,
                "high": 8050 + day,
                "low": 7980 + day,
                "close": 8010 + day * 2,
                "volume": 200000000 + day,
                "amount": 400000000000 + day,
                "source": "fixture-index",
            }
            for day in range(1, 31)
        ]
    )

    client = TestClient(create_app())
    response = client.get(
        "/api/market/context?symbol=000852.SH&start=2026-01-01&end=2026-01-31"
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["symbol"] == "000852.SH"
    assert payload["data"]["asset_type"] == "index"
    assert payload["data"]["factor_snapshot"]["source"] == "index_bars_derived"
    assert payload["data"]["factor_snapshot"]["ma20"] is not None
    assert payload["data"]["market_state"]["regime"] in {"bull_trend", "bear_trend", "range_bound"}
    assert payload["data"]["data_coverage"]["index_bar_rows"] == 30
