import pandas as pd


def _frame(source: str):
    return pd.DataFrame(
        [
            {
                "date": "2026-05-10",
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": 100,
                "high": 105,
                "low": 99,
                "close": 104,
                "volume": 1234,
                "amount": 5678,
                "source": source,
            }
        ]
    )


def _index_frame(source: str):
    return pd.DataFrame(
        [
            {
                "date": "2026-05-15",
                "index_symbol": "000905.SH",
                "market": "CHINA",
                "open": 8676.62,
                "high": 8717.09,
                "low": 8473.04,
                "close": 8536.34,
                "volume": 270961762,
                "amount": 643024000000.0,
                "source": source,
            }
        ]
    )


def test_fetch_daily_bars_defaults_to_akshare(monkeypatch):
    from tradingagents.research import data_sync

    calls = []

    def fake_akshare(symbol, start, end):
        calls.append((symbol, start, end))
        return _frame("akshare")

    monkeypatch.delenv("TRADINGAGENTS_DATA_SOURCE", raising=False)
    monkeypatch.setattr(data_sync, "get_china_stock_data_frame_akshare", fake_akshare)

    frame = data_sync.fetch_daily_bars("600519.SH", "2026-05-01", "2026-05-11")

    assert calls == [("600519.SH", "2026-05-01", "2026-05-11")]
    assert frame.iloc[0]["source"] == "akshare"


def test_fetch_daily_bars_can_force_tushare(monkeypatch):
    from tradingagents.research import data_sync

    calls = []

    def fake_tushare(symbol, start, end):
        calls.append((symbol, start, end))
        return _frame("tushare")

    monkeypatch.setattr(data_sync, "get_china_stock_data_frame_tushare", fake_tushare)

    frame = data_sync.fetch_daily_bars(
        "600519.SH", "2026-05-01", "2026-05-11", source="tushare"
    )

    assert calls == [("600519.SH", "2026-05-01", "2026-05-11")]
    assert frame.iloc[0]["source"] == "tushare"


def test_sync_watchlist_bars_logs_symbol_errors_and_continues(monkeypatch):
    from tradingagents.research import data_sync

    saved_rows = []
    quality_issues = []

    monkeypatch.setattr(
        data_sync,
        "list_watchlist",
        lambda: [{"symbol": "00700.HK"}, {"symbol": "600519.SH"}],
    )

    def fake_fetch_daily_bars(symbol, start, end, *, source=None):
        if symbol == "00700.HK":
            raise RuntimeError("temporary remote disconnect")
        return _frame("akshare")

    monkeypatch.setattr(data_sync, "fetch_daily_bars", fake_fetch_daily_bars)
    monkeypatch.setattr(
        data_sync, "upsert_daily_bars", lambda rows: saved_rows.extend(rows)
    )
    monkeypatch.setattr(
        data_sync,
        "log_quality_issue",
        lambda **kwargs: quality_issues.append(kwargs),
    )

    count = data_sync.sync_watchlist_bars(
        "2026-05-01", "2026-05-11", source="akshare"
    )

    assert count == 1
    assert saved_rows[0]["symbol"] == "600519.SH"
    assert quality_issues == [
        {
            "check_name": "data_sync",
            "severity": "error",
            "date": "2026-05-11",
            "symbol": "00700.HK",
            "message": "akshare sync failed: temporary remote disconnect",
        }
    ]


def test_sync_watchlist_fund_flows_upserts_and_logs_missing(monkeypatch):
    from tradingagents.research import data_sync

    upserted = []
    quality_issues = []

    monkeypatch.setattr(
        data_sync,
        "list_watchlist",
        lambda: [{"symbol": "600519.SH"}, {"symbol": "00700.HK"}],
    )

    def fake_fetch(symbol, _start, _end):
        if symbol == "00700.HK":
            return pd.DataFrame()
        return pd.DataFrame([{
            "date": "2026-05-10",
            "symbol": symbol,
            "main_net_inflow": 1.0,
            "large_net_inflow": 0.5,
            "northbound_net_inflow": 0.2,
        }])

    monkeypatch.setattr(data_sync, "fetch_fund_flow_daily", fake_fetch)
    monkeypatch.setattr(data_sync, "upsert_fund_flows", lambda rows: upserted.extend(rows))
    monkeypatch.setattr(data_sync, "log_quality_issue", lambda **kwargs: quality_issues.append(kwargs))

    count = data_sync.sync_watchlist_fund_flows("2026-05-01", "2026-05-11")

    assert count == 1
    assert upserted[0]["symbol"] == "600519.SH"
    assert quality_issues == [{
        "check_name": "fund_flow_sync",
        "severity": "warning",
        "date": "2026-05-11",
        "symbol": "00700.HK",
        "message": "fund flow unavailable",
    }]


def test_sync_index_bars_upserts_csi500_alias(monkeypatch):
    from tradingagents.research import data_sync

    calls = []
    upserted = []

    def fake_fetch_index_bars(symbol, start, end, *, source=None):
        calls.append((symbol, start, end, source))
        return _index_frame("akshare_index_em")

    monkeypatch.setattr(data_sync, "fetch_index_bars", fake_fetch_index_bars)
    monkeypatch.setattr(data_sync, "upsert_index_bars", lambda rows: upserted.extend(rows))

    count = data_sync.sync_index_bars(
        "2026-05-01", "2026-05-16", index_symbols=["399905"], source="akshare"
    )

    assert count == 1
    assert calls == [("399905", "2026-05-01", "2026-05-16", "akshare")]
    assert upserted[0]["index_symbol"] == "000905.SH"


def test_fetch_index_bars_routes_hsi_to_hk_index_fetcher(monkeypatch):
    from tradingagents.research import data_sync

    calls = []

    def fake_hk_index(symbol, start, end):
        calls.append((symbol, start, end))
        return pd.DataFrame(
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
                    "source": "akshare_hk_index_sina",
                }
            ]
        )

    monkeypatch.setattr(data_sync, "get_hk_index_data_frame_akshare", fake_hk_index)

    frame = data_sync.fetch_index_bars("恒生指数", "2026-05-01", "2026-05-16")

    assert calls == [("HSI", "2026-05-01", "2026-05-16")]
    assert frame.iloc[0]["index_symbol"] == "HSI"
    assert frame.iloc[0]["market"] == "HONGKONG"
