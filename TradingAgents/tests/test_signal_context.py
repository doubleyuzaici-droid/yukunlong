import json

from tradingagents.research.db import init_db
from tradingagents.research.repository import upsert_signals
from tradingagents.research.signal_context import load_signal_context, render_signal_context


def test_load_signal_context_returns_symbol_date_signals(monkeypatch, tmp_path):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    init_db()
    upsert_signals(
        [
            {
                "signal_id": "2026-05-12-600519_SH-放量突破-signal_v1",
                "date": "2026-05-12",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "放量突破",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": json.dumps(["close >= 60日新高"], ensure_ascii=False),
                "risk_json": json.dumps(["RSI 偏热"], ensure_ascii=False),
                "invalid_json": json.dumps(["跌破 MA60"], ensure_ascii=False),
                "score": 85.0,
                "strategy_version": "signal_v1",
                "market_regime": "bull_trend",
            }
        ]
    )

    signals = load_signal_context("600519.SH", "2026-05-12")

    assert len(signals) == 1
    assert signals[0]["signal_name"] == "放量突破"
    assert signals[0]["signal_level"] == "A"
    assert signals[0]["evidence"] == ["close >= 60日新高"]
    assert signals[0]["market_regime"] == "bull_trend"


def test_render_signal_context_is_stable_and_readable():
    text = render_signal_context(
        [
            {
                "signal_name": "放量突破",
                "signal_level": "A",
                "direction": "opportunity",
                "score": 85.0,
                "market_regime": "bull_trend",
                "evidence": ["close >= 60日新高"],
                "risk": ["RSI 偏热"],
                "invalid_conditions": ["跌破 MA60"],
            }
        ]
    )

    assert "Quant Signals" in text
    assert "放量突破" in text
    assert "跌破 MA60" in text
    assert "regime=bull_trend" in text
