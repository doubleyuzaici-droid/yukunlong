import math
from datetime import date, timedelta

from fastapi.testclient import TestClient


def _seed_strategy_rows(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_daily_bars

    init_db()
    start = date(2026, 1, 1)
    upsert_daily_bars(
        [
            {
                "date": (start + timedelta(days=index)).isoformat(),
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": 100 + index * 0.7,
                "high": 102 + index * 0.7,
                "low": 99 + index * 0.7,
                "close": 101 + index * 0.7,
                "volume": 1_000_000 + index * 6_000,
                "amount": (101 + index * 0.7) * (1_000_000 + index * 6_000),
                "source": "fixture",
            }
            for index in range(130)
        ]
    )
    with get_connection() as conn:
        for index in range(130):
            close = 3000 + index * 3 + math.sin(index / 3) * 24
            conn.execute(
                """
                INSERT OR REPLACE INTO index_bars (
                    date, index_symbol, market, open, high, low, close, volume, amount, source
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    (start + timedelta(days=index)).isoformat(),
                    "000300.SH",
                    "CHINA",
                    close - 2,
                    close + 5,
                    close - 5,
                    close,
                    10_000_000,
                    30_000_000_000,
                    "fixture",
                ),
            )
            csi500_close = 7600 + index * 8 + math.sin(index / 4) * 35
            conn.execute(
                """
                INSERT OR REPLACE INTO index_bars (
                    date, index_symbol, market, open, high, low, close, volume, amount, source
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    (start + timedelta(days=index)).isoformat(),
                    "000905.SH",
                    "CHINA",
                    csi500_close - 6,
                    csi500_close + 18,
                    csi500_close - 15,
                    csi500_close,
                    280_000_000,
                    650_000_000_000,
                    "fixture-index",
                ),
            )
        conn.commit()


def test_resonance_v2_strategy_route_returns_standalone_analysis(tmp_path, monkeypatch):
    _seed_strategy_rows(tmp_path, monkeypatch)

    from tradingagents.api.server import create_app

    client = TestClient(create_app())
    response = client.get(
        "/api/strategies/resonance-v2/analyze",
        params={
            "symbol": "600519.SH",
            "start": "2026-01-01",
            "end": "2026-05-12",
            "mode": "conservative",
            "capital": 1_000_000,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["symbol"] == "600519.SH"
    assert payload["data"]["strategy_name"] == "多指标共振策略 V2"
    assert "buy_signal" in payload["data"]
    assert "sell_signal" in payload["data"]
    assert "position_plan" in payload["data"]


def test_resonance_v2_signal_route_persists_signal_log(tmp_path, monkeypatch):
    _seed_strategy_rows(tmp_path, monkeypatch)

    from tradingagents.api.server import create_app
    from tradingagents.research.db import get_connection

    client = TestClient(create_app())
    response = client.post(
        "/api/strategies/resonance-v2/signal",
        json={
            "symbol": "600519.SH",
            "start": "2026-01-01",
            "end": "2026-05-12",
            "mode": "aggressive",
            "capital": 1_000_000,
            "persist": True,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["persisted"] is True
    assert payload["data"]["signal"]["strategy_version"] == "resonance_v2_aggressive"
    assert payload["data"]["signal"]["symbol"] == "600519.SH"

    with get_connection() as conn:
        row = conn.execute(
            "SELECT * FROM signal_log WHERE signal_id = ?",
            (payload["data"]["signal"]["signal_id"],),
        ).fetchone()

    assert row is not None
    assert row["signal_name"] == "V2多指标共振"
    assert row["timeframe"] == "weekly+daily"


def test_resonance_v2_backtest_route_returns_dedicated_result(tmp_path, monkeypatch):
    _seed_strategy_rows(tmp_path, monkeypatch)

    from tradingagents.api.server import create_app

    client = TestClient(create_app())
    response = client.post(
        "/api/strategies/resonance-v2/backtest",
        json={
            "symbol": "600519.SH",
            "start": "2026-01-01",
            "end": "2026-05-12",
            "mode": "aggressive",
            "initial_cash": 1_000_000,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    assert payload["data"]["kind"] == "resonance_v2"
    assert payload["data"]["backtest_id"]
    result = payload["data"]["result"]
    assert result["strategy_version"] == "resonance_v2_aggressive"
    assert result["metrics"]["initial_cash"] == 1_000_000
    assert "final_equity" in result["metrics"]
    assert "max_drawdown" in result["metrics"]
    assert result["equity_curve"]
    assert isinstance(result["signals"], list)


def test_resonance_v2_backtest_exposes_zero_trade_reasons_on_result(tmp_path, monkeypatch):
    _seed_strategy_rows(tmp_path, monkeypatch)

    from tradingagents.api.server import create_app
    from tradingagents.backtest.resonance_v2_backtester import _no_trade_reasons

    client = TestClient(create_app())
    response = client.post(
        "/api/strategies/resonance-v2/backtest",
        json={
            "symbol": "600519.SH",
            "start": "2026-01-01",
            "end": "2026-05-12",
            "mode": "conservative",
            "initial_cash": 1_000_000,
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["success"] is True
    result = payload["data"]["result"]
    expected_reasons = _no_trade_reasons(
        result["signals"],
        result["trades"],
        "conservative",
    )
    assert result["zero_trade_reasons"] == expected_reasons
    assert result["data_quality"]["no_trade_reasons"] == expected_reasons


def test_resonance_v2_routes_accept_csi500_alias_as_index_target(tmp_path, monkeypatch):
    _seed_strategy_rows(tmp_path, monkeypatch)

    from tradingagents.api.server import create_app

    client = TestClient(create_app())
    analysis_response = client.get(
        "/api/strategies/resonance-v2/analyze",
        params={
            "symbol": "399905",
            "start": "2026-01-01",
            "end": "2026-05-12",
            "mode": "conservative",
            "capital": 1_000_000,
        },
    )

    assert analysis_response.status_code == 200
    analysis_payload = analysis_response.json()
    assert analysis_payload["success"] is True
    analysis = analysis_payload["data"]
    assert analysis["symbol"] == "000905.SH"
    assert analysis["asset_type"] == "index"
    assert analysis["data_quality"]["bar_count"] >= 90
    assert analysis["data_quality"]["blocking_reasons"] == []
    assert analysis["market_filter"]["benchmark_symbol"] == "000905.SH"

    backtest_response = client.post(
        "/api/strategies/resonance-v2/backtest",
        json={
            "symbol": "399905",
            "start": "2026-01-01",
            "end": "2026-05-12",
            "mode": "aggressive",
            "initial_cash": 1_000_000,
        },
    )

    assert backtest_response.status_code == 200
    backtest_payload = backtest_response.json()
    assert backtest_payload["success"] is True
    result = backtest_payload["data"]["result"]
    assert result["symbol"] == "000905.SH"
    assert result["asset_type"] == "index"
    assert result["equity_curve"]
    assert result["data_quality"]["bar_count"] >= 90


def test_resonance_v2_backtester_preserves_hk_index_market_for_costs():
    from tradingagents.backtest.resonance_v2_backtester import _market_name

    assert _market_name("HSI") == "HONGKONG"


def test_resonance_v2_backtest_explains_no_trade_windows():
    from tradingagents.backtest.resonance_v2_backtester import _no_trade_reasons

    reasons = _no_trade_reasons(
        signals=[
            {"action": "observe"},
            {"action": "reduce"},
            {"action": "exit"},
        ],
        trades=[],
        mode="conservative",
    )

    assert any("未出现 buy_allowed" in reason for reason in reasons)
    assert any("风险/减仓" in reason for reason in reasons)

    blocked_execution_reasons = _no_trade_reasons(
        signals=[{"action": "buy_allowed"}],
        trades=[],
        mode="conservative",
    )
    assert any("可执行检查或仓位取整" in reason for reason in blocked_execution_reasons)
