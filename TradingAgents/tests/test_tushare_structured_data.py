import pandas as pd


def test_china_stock_data_frame_uses_mocked_tushare_pro(monkeypatch):
    from tradingagents.dataflows import tushare_china

    calls = {}

    class FakePro:
        def daily(self, **kwargs):
            calls.update(kwargs)
            return pd.DataFrame(
                [
                    {
                        "ts_code": "600519.SH",
                        "trade_date": "20260510",
                        "open": 100,
                        "high": 105,
                        "low": 99,
                        "close": 104,
                        "vol": 1234,
                        "amount": 5678,
                    }
                ]
            )

    monkeypatch.setattr(tushare_china, "_get_tushare_pro", lambda: FakePro())

    frame = tushare_china.get_china_stock_data_frame(
        "600519.SH", "2026-05-01", "2026-05-11"
    )

    assert calls == {
        "ts_code": "600519.SH",
        "start_date": "20260501",
        "end_date": "20260511",
    }
    assert list(frame.columns) == [
        "date",
        "symbol",
        "market",
        "open",
        "high",
        "low",
        "close",
        "volume",
        "amount",
        "source",
    ]
    assert frame.iloc[0].to_dict() == {
        "date": "2026-05-10",
        "symbol": "600519.SH",
        "market": "CHINA",
        "open": 100,
        "high": 105,
        "low": 99,
        "close": 104,
        "volume": 1234,
        "amount": 5678,
        "source": "tushare",
    }


def test_hk_stock_data_frame_uses_mocked_tushare_pro(monkeypatch):
    from tradingagents.dataflows import tushare_china

    calls = {}

    class FakePro:
        def hk_daily(self, **kwargs):
            calls.update(kwargs)
            return pd.DataFrame(
                [
                    {
                        "ts_code": "00700.HK",
                        "trade_date": "20260510",
                        "open": 400,
                        "high": 410,
                        "low": 398,
                        "close": 405,
                        "vol": 2234,
                    }
                ]
            )

    monkeypatch.setattr(tushare_china, "_get_tushare_pro", lambda: FakePro())

    frame = tushare_china.get_hk_stock_data_frame("700.HK", "2026-05-01", "2026-05-11")

    assert calls == {
        "ts_code": "00700.HK",
        "start_date": "20260501",
        "end_date": "20260511",
    }
    assert frame.iloc[0]["date"] == "2026-05-10"
    assert frame.iloc[0]["symbol"] == "00700.HK"
    assert frame.iloc[0]["market"] == "HONGKONG"
    assert frame.iloc[0]["volume"] == 2234
    assert pd.isna(frame.iloc[0]["amount"])
