from fastapi.testclient import TestClient


def _quote_text(code: str = "sh600519", name: str = "贵州茅台", raw_code: str = "600519") -> str:
    fields = [""] * 46
    fields[0] = "1"
    fields[1] = name
    fields[2] = raw_code
    fields[3] = "1725.00"
    fields[4] = "1700.00"
    fields[5] = "1710.00"
    fields[6] = "1000"
    fields[30] = "20260109103000"
    fields[31] = "25.00"
    fields[32] = "1.47"
    fields[33] = "1730.00"
    fields[34] = "1698.00"
    fields[35] = "1725.00/1000/172500000"
    fields[36] = "1000"
    fields[37] = "17250"
    return f'v_{code}="' + "~".join(fields) + '";'


def _minute_payload(code: str = "sh600519"):
    return {
        "code": 0,
        "data": {
            code: {
                "data": {
                    "date": "20260109",
                    "data": [
                        "0930 1710.00 100 17100000",
                        "0931 1720.00 150 25800000",
                        "0932 1725.00 210 36100000",
                    ],
                }
            }
        },
    }


def _seed_daily_fallback(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars

    init_db()
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
        ]
    )


def test_realtime_quotes_parse_tencent_snapshot(monkeypatch):
    from tradingagents.research import realtime_market
    from tradingagents.api.server import create_app

    realtime_market.clear_realtime_cache()
    monkeypatch.setattr(
        realtime_market,
        "_fetch_tencent_quote_text",
        lambda code: _quote_text(code),
    )

    client = TestClient(create_app())
    response = client.get("/api/market/realtime/quotes?symbols=600519.SH")

    assert response.status_code == 200
    payload = response.json()
    quote = payload["data"]["quotes"][0]
    assert payload["data"]["live_count"] == 1
    assert quote["status"] == "live"
    assert quote["is_realtime"] is True
    assert quote["provider"] == "tencent"
    assert quote["price"] == 1725.0
    assert quote["prev_close"] == 1700.0
    assert quote["change"] == 25.0
    assert round(quote["change_pct"], 4) == 0.0147
    assert quote["trade_date"] == "2026-01-09"
    assert quote["trade_time"] == "10:30:00"


def test_realtime_intraday_returns_minute_points(monkeypatch):
    from tradingagents.research import realtime_market
    from tradingagents.api.server import create_app

    realtime_market.clear_realtime_cache()
    monkeypatch.setattr(
        realtime_market,
        "_fetch_tencent_quote_text",
        lambda code: _quote_text(code),
    )
    monkeypatch.setattr(
        realtime_market,
        "_fetch_tencent_intraday_payload",
        lambda code: _minute_payload(code),
    )

    client = TestClient(create_app())
    response = client.get("/api/market/realtime/intraday?symbol=600519.SH")

    assert response.status_code == 200
    payload = response.json()
    data = payload["data"]
    assert data["status"] == "live"
    assert data["point_count"] == 3
    assert data["date"] == "2026-01-09"
    assert data["points"][0]["time"] == "09:30"
    assert data["points"][1]["volume"] == 50.0
    assert data["points"][2]["amount"] == 10300000.0
    assert data["quote"]["status"] == "live"


def test_realtime_hsi_index_uses_tencent_hk_index_code(monkeypatch):
    from tradingagents.research import realtime_market
    from tradingagents.api.server import create_app

    quote_calls: list[str] = []
    minute_calls: list[str] = []
    realtime_market.clear_realtime_cache()

    def fake_quote(code: str) -> str:
        quote_calls.append(code)
        return _quote_text(code, name="恒生指数", raw_code="HSI")

    def fake_minute(code: str) -> dict:
        minute_calls.append(code)
        return _minute_payload(code)

    monkeypatch.setattr(realtime_market, "_fetch_tencent_quote_text", fake_quote)
    monkeypatch.setattr(realtime_market, "_fetch_tencent_intraday_payload", fake_minute)

    client = TestClient(create_app())
    quote_response = client.get("/api/market/realtime/quotes?symbols=恒生指数")
    intraday_response = client.get("/api/market/realtime/intraday?symbol=HSI")

    assert quote_response.status_code == 200
    assert intraday_response.status_code == 200
    quote = quote_response.json()["data"]["quotes"][0]
    intraday = intraday_response.json()["data"]
    assert quote_calls == ["hkHSI"]
    assert minute_calls == ["hkHSI"]
    assert quote["symbol"] == "HSI"
    assert quote["market"] == "HONGKONG"
    assert quote["status"] == "live"
    assert intraday["symbol"] == "HSI"
    assert intraday["status"] == "live"


def test_realtime_quote_falls_back_to_local_daily(tmp_path, monkeypatch):
    _seed_daily_fallback(tmp_path, monkeypatch)

    from tradingagents.research import realtime_market
    from tradingagents.api.server import create_app

    realtime_market.clear_realtime_cache()

    def broken_quote(_code: str) -> str:
        raise RuntimeError("remote timeout")

    monkeypatch.setattr(realtime_market, "_fetch_tencent_quote_text", broken_quote)

    client = TestClient(create_app())
    response = client.get("/api/market/realtime/quotes?symbols=600519.SH")

    assert response.status_code == 200
    payload = response.json()
    quote = payload["data"]["quotes"][0]
    assert payload["data"]["fallback_count"] == 1
    assert quote["status"] == "fallback"
    assert quote["is_realtime"] is False
    assert quote["price"] == 1720.0
    assert quote["error"] == "remote timeout"
