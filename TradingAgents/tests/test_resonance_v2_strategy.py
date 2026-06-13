import math
from datetime import date, timedelta


def _daily_rows(symbol: str = "600519.SH", market: str = "CHINA", days: int = 130):
    start = date(2026, 1, 1)
    rows = []
    for index in range(days):
        current = start + timedelta(days=index)
        close = 100.0 + index * 0.8
        rows.append(
            {
                "date": current.isoformat(),
                "symbol": symbol,
                "market": market,
                "open": close - 0.4,
                "high": close + 1.8,
                "low": close - 1.5,
                "close": close,
                "volume": 1_000_000 + index * 8_000,
                "amount": close * (1_000_000 + index * 8_000),
                "source": "fixture",
            }
        )
    return rows


def _insert_index_rows(index_symbol: str = "000300.SH", market: str = "CHINA", days: int = 130):
    from tradingagents.research.db import get_connection

    start = date(2026, 1, 1)
    with get_connection() as conn:
        for index in range(days):
            current = start + timedelta(days=index)
            close = 3000.0 + index * 4 + math.sin(index / 3) * 28
            conn.execute(
                """
                INSERT OR REPLACE INTO index_bars (
                    date, index_symbol, market, open, high, low, close, volume, amount, source
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    current.isoformat(),
                    index_symbol,
                    market,
                    close - 2,
                    close + 6,
                    close - 5,
                    close,
                    10_000_000,
                    30_000_000_000,
                    "fixture",
                ),
            )
        conn.commit()


def test_resonance_v2_analyzes_symbol_scores_channels_and_checklist(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_fund_flows
    from tradingagents.strategies.resonance_v2 import analyze_resonance_v2

    init_db()
    upsert_daily_bars(_daily_rows())
    upsert_fund_flows(
        [
            {
                "date": (date(2026, 1, 1) + timedelta(days=index)).isoformat(),
                "symbol": "600519.SH",
                "main_net_inflow": 80_000_000 + index * 1_000_000,
                "large_net_inflow": 30_000_000,
                "northbound_net_inflow": 10_000_000,
            }
            for index in range(130)
        ]
    )
    _insert_index_rows()

    result = analyze_resonance_v2(
        "600519.SH",
        "2026-01-01",
        "2026-05-12",
        mode="conservative",
        capital=1_000_000,
    )

    assert result["strategy_name"] == "多指标共振策略 V2"
    assert result["symbol"] == "600519.SH"
    assert result["mode"] == "conservative"
    assert result["decision"]["action"] in {"observe", "buy_watch", "buy_allowed", "hold", "reduce", "exit"}
    assert result["trend_state"]["label"] in {"强多头", "弱多头", "中性", "弱空头", "强空头"}
    assert result["trend_state"]["period"] == "weekly"
    assert result["trend_state"]["sample_count"] > 0
    assert result["market_filter"]["benchmark_symbol"] == "000300.SH"
    assert result["market_filter"]["status"] == "pass"
    assert isinstance(result["buy_signal"]["conservative_entry"], bool)
    assert isinstance(result["buy_signal"]["score"], float)
    assert isinstance(result["sell_signal"]["score"], float)
    assert result["price_channels"]["predict_high_1"] > result["latest_bar"]["close"]
    assert result["price_channels"]["predict_low_1"] < result["latest_bar"]["close"]
    assert result["position_plan"]["max_position_pct"] == 0.25
    assert result["position_plan"]["suggested_shares"] % 100 == 0
    assert result["checklist"]
    assert not result["data_quality"]["blocking_reasons"]


def test_resonance_v2_degrades_when_benchmark_is_missing(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars
    from tradingagents.strategies.resonance_v2 import analyze_resonance_v2

    init_db()
    upsert_daily_bars(_daily_rows())

    result = analyze_resonance_v2("600519.SH", "2026-01-01", "2026-05-12")

    assert result["market_filter"]["status"] == "missing"
    assert result["market_filter"]["passed"] is False
    assert "缺少基准指数数据" in result["data_quality"]["warnings"]
    assert result["decision"]["action"] == "observe"


def test_resonance_v2_maps_growth_symbol_to_small_cap_benchmark_and_weekly_trend(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars
    from tradingagents.strategies.resonance_v2 import analyze_resonance_v2, resolve_benchmark_symbol

    init_db()
    upsert_daily_bars(_daily_rows(symbol="300750.SZ"))
    _insert_index_rows("000852.SH")

    result = analyze_resonance_v2(
        "300750.SZ",
        "2026-01-01",
        "2026-05-12",
        mode="aggressive",
        capital=1_000_000,
    )

    benchmark_symbol, benchmark_reason = resolve_benchmark_symbol("300750.SZ")
    assert benchmark_symbol == "000852.SH"
    assert "成长" in benchmark_reason or "中小盘" in benchmark_reason
    assert result["market_filter"]["benchmark_symbol"] == "000852.SH"
    assert result["market_filter"]["benchmark_reason"] == benchmark_reason
    assert result["trend_state"]["period"] == "weekly"
    assert result["trend_state"]["sample_count"] >= 15


def test_resonance_v2_maps_hk_symbol_to_hsi_benchmark(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.repository import upsert_daily_bars
    from tradingagents.strategies.resonance_v2 import analyze_resonance_v2, resolve_benchmark_symbol

    init_db()
    upsert_daily_bars(_daily_rows(symbol="00700.HK", market="HONGKONG"))
    _insert_index_rows("HSI", market="HONGKONG")

    benchmark_symbol, benchmark_reason = resolve_benchmark_symbol("00700.HK")
    result = analyze_resonance_v2(
        "00700.HK",
        "2026-01-01",
        "2026-05-12",
        mode="conservative",
        capital=1_000_000,
    )

    assert benchmark_symbol == "HSI"
    assert "恒生" in benchmark_reason
    assert result["market_filter"]["benchmark_symbol"] == "HSI"
    assert result["market_filter"]["status"] == "pass"


def test_resonance_v2_index_signal_preserves_index_market(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.strategies.resonance_v2 import analyze_resonance_v2, build_resonance_v2_signal

    init_db()
    _insert_index_rows("HSI", market="HONGKONG")

    result = analyze_resonance_v2(
        "恒生指数",
        "2026-01-01",
        "2026-05-12",
        mode="conservative",
        capital=1_000_000,
    )
    signal = build_resonance_v2_signal(result)

    assert result["symbol"] == "HSI"
    assert result["asset_type"] == "index"
    assert signal["market"] == "HONGKONG"
