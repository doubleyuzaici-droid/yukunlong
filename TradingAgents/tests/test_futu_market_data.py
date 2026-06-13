import pandas as pd


def test_to_futu_code_maps_project_symbols():
    from tradingagents.dataflows.futu_market import to_futu_code

    assert to_futu_code("01024.HK") == "HK.01024"
    assert to_futu_code("1024.hk") == "HK.01024"
    assert to_futu_code("600519.SH") == "SH.600519"
    assert to_futu_code("000001.SZ") == "SZ.000001"
    assert to_futu_code("000300.SH") == "SH.000300"
    assert to_futu_code("HSI") == "HK.800000"
    assert to_futu_code("AAPL") == "US.AAPL"


def test_fetch_daily_bars_maps_history_kline(monkeypatch):
    from tradingagents.dataflows import futu_market

    class FakeQuoteContext:
        def request_history_kline(self, code, start=None, end=None, **kwargs):
            assert code == "HK.01024"
            assert start == "2026-05-01"
            assert end == "2026-05-12"
            return (
                futu_market.RET_OK,
                pd.DataFrame([{
                    "code": "HK.01024",
                    "time_key": "2026-05-12 00:00:00",
                    "open": 56.7,
                    "high": 57.4,
                    "low": 52.6,
                    "close": 52.6,
                    "volume": 151743764,
                    "turnover": 8288691208.0,
                }]),
                None,
            )

        def close(self):
            self.closed = True

    monkeypatch.setattr(futu_market, "_open_quote_context", lambda: FakeQuoteContext())

    frame = futu_market.get_stock_data_frame_futu("1024.hk", "2026-05-01", "2026-05-12")

    row = frame.iloc[0]
    assert row["date"] == "2026-05-12"
    assert row["symbol"] == "01024.HK"
    assert row["market"] == "HONGKONG"
    assert row["open"] == 56.7
    assert row["amount"] == 8288691208.0
    assert row["source"] == "futu_history_kline"


def test_fetch_index_bars_maps_futu_history_kline(monkeypatch):
    from tradingagents.dataflows import futu_market

    class FakeQuoteContext:
        def request_history_kline(self, code, start=None, end=None, **kwargs):
            assert code == "HK.800000"
            assert start == "2026-05-01"
            assert end == "2026-05-20"
            return (
                futu_market.RET_OK,
                pd.DataFrame([{
                    "code": "HK.800000",
                    "time_key": "2026-05-19 00:00:00",
                    "open": 23500.0,
                    "high": 23620.0,
                    "low": 23380.0,
                    "close": 23480.0,
                    "volume": 19830055956,
                    "turnover": 325385515870.0,
                }]),
                None,
            )

        def close(self):
            self.closed = True

    monkeypatch.setattr(futu_market, "_open_quote_context", lambda: FakeQuoteContext())

    frame = futu_market.get_index_data_frame_futu("恒生指数", "2026-05-01", "2026-05-20")

    row = frame.iloc[0]
    assert row["date"] == "2026-05-19"
    assert row["index_symbol"] == "HSI"
    assert row["market"] == "HONGKONG"
    assert row["close"] == 23480.0
    assert row["amount"] == 325385515870.0
    assert row["source"] == "futu_history_kline"


def test_fetch_intraday_minutes_maps_rt_data(monkeypatch):
    from tradingagents.dataflows import futu_market

    class FakeQuoteContext:
        def get_rt_data(self, code):
            assert code == "HK.01024"
            return (
                futu_market.RET_OK,
                pd.DataFrame([
                    {
                        "code": "HK.01024",
                        "time": "09:30",
                        "cur_price": 52.1,
                        "volume": 1000,
                        "turnover": 52100.0,
                    },
                    {
                        "code": "HK.01024",
                        "time": "09:31",
                        "cur_price": 52.6,
                        "volume": 1300,
                        "turnover": 68380.0,
                    },
                ]),
            )

        def close(self):
            self.closed = True

    monkeypatch.setattr(futu_market, "_open_quote_context", lambda: FakeQuoteContext())

    payload = futu_market.fetch_futu_intraday_minutes(
        "1024.hk",
        quote={"trade_date": "2026-05-12", "prev_close": 51.6},
    )

    assert payload["provider"] == "futu"
    assert payload["source"] == "futu_rt_data"
    assert payload["status"] == "live"
    assert payload["date"] == "2026-05-12"
    assert payload["point_count"] == 2
    assert payload["points"][0]["datetime"] == "2026-05-12T09:30:00+08:00"
    assert payload["points"][1]["price"] == 52.6
    assert payload["points"][1]["amount"] == 68380.0
