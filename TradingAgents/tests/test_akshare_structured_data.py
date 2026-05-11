import pandas as pd


def test_china_stock_data_frame_uses_mocked_akshare(monkeypatch):
    from tradingagents.dataflows import akshare_china

    calls = {}

    def fake_stock_zh_a_hist(**kwargs):
        calls.update(kwargs)
        return pd.DataFrame(
            [
                {
                    "日期": "2026-05-10",
                    "开盘": 100,
                    "最高": 105,
                    "最低": 99,
                    "收盘": 104,
                    "成交量": 1234,
                    "成交额": 5678,
                }
            ]
        )

    monkeypatch.setattr(akshare_china, "_stock_zh_a_hist", fake_stock_zh_a_hist)

    frame = akshare_china.get_china_stock_data_frame_akshare(
        "600519.SH", "2026-05-01", "2026-05-11"
    )

    assert calls == {
        "symbol": "600519",
        "period": "daily",
        "start_date": "20260501",
        "end_date": "20260511",
        "adjust": "qfq",
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
        "source": "akshare",
    }


def test_hk_stock_data_frame_uses_mocked_akshare(monkeypatch):
    from tradingagents.dataflows import akshare_china

    calls = {}

    def fake_stock_hk_hist(**kwargs):
        calls.update(kwargs)
        return pd.DataFrame(
            [
                {
                    "日期": "2026-05-10",
                    "开盘": 400,
                    "最高": 410,
                    "最低": 398,
                    "收盘": 405,
                    "成交量": 2234,
                }
            ]
        )

    monkeypatch.setattr(akshare_china, "_stock_hk_hist", fake_stock_hk_hist)

    frame = akshare_china.get_hk_stock_data_frame_akshare(
        "700.HK", "2026-05-01", "2026-05-11"
    )

    assert calls == {
        "symbol": "00700",
        "period": "daily",
        "start_date": "20260501",
        "end_date": "20260511",
        "adjust": "qfq",
    }
    assert frame.iloc[0]["date"] == "2026-05-10"
    assert frame.iloc[0]["symbol"] == "00700.HK"
    assert frame.iloc[0]["market"] == "HONGKONG"
    assert frame.iloc[0]["volume"] == 2234
    assert pd.isna(frame.iloc[0]["amount"])


def test_china_stock_data_frame_falls_back_to_tencent(monkeypatch):
    from tradingagents.dataflows import akshare_china

    calls = {}

    def broken_stock_zh_a_hist(**kwargs):
        raise RuntimeError("eastmoney disconnected")

    def fake_stock_zh_a_hist_tx(**kwargs):
        calls.update(kwargs)
        return pd.DataFrame(
            [
                {
                    "date": "2026-05-10",
                    "open": 100,
                    "high": 105,
                    "low": 99,
                    "close": 104,
                    "amount": 1234,
                }
            ]
        )

    monkeypatch.setattr(akshare_china, "_stock_zh_a_hist", broken_stock_zh_a_hist)
    monkeypatch.setattr(akshare_china, "_stock_zh_a_hist_tx", fake_stock_zh_a_hist_tx)

    frame = akshare_china.get_china_stock_data_frame_akshare(
        "600519.SH", "2026-05-01", "2026-05-11"
    )

    assert calls == {
        "symbol": "sh600519",
        "start_date": "20260501",
        "end_date": "20260511",
        "adjust": "qfq",
    }
    assert frame.iloc[0]["source"] == "akshare_tx"
    assert frame.iloc[0]["volume"] == 1234
    assert pd.isna(frame.iloc[0]["amount"])


def test_hk_stock_data_frame_falls_back_to_sina_daily(monkeypatch):
    from tradingagents.dataflows import akshare_china

    calls = {}

    def broken_stock_hk_hist(**kwargs):
        raise RuntimeError("eastmoney disconnected")

    def fake_stock_hk_daily(**kwargs):
        calls.update(kwargs)
        return pd.DataFrame(
            [
                {
                    "date": "2026-04-30",
                    "open": 390,
                    "high": 395,
                    "low": 388,
                    "close": 392,
                    "volume": 1000,
                },
                {
                    "date": "2026-05-10",
                    "open": 400,
                    "high": 410,
                    "low": 398,
                    "close": 405,
                    "volume": 2234,
                },
            ]
        )

    monkeypatch.setattr(akshare_china, "_stock_hk_hist", broken_stock_hk_hist)
    monkeypatch.setattr(akshare_china, "_stock_hk_daily", fake_stock_hk_daily)

    frame = akshare_china.get_hk_stock_data_frame_akshare(
        "700.HK", "2026-05-01", "2026-05-11"
    )

    assert calls == {"symbol": "00700", "adjust": "qfq"}
    assert frame.iloc[0]["date"] == "2026-05-10"
    assert frame.iloc[0]["source"] == "akshare_sina"
    assert frame.iloc[0]["volume"] == 2234
