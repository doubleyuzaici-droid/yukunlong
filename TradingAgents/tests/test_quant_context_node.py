from tradingagents.graph.quant_context import create_quant_signal_loader


def test_quant_signal_loader_adds_rendered_context(monkeypatch):
    def fake_load(symbol, trade_date):
        assert symbol == "600519.SH"
        assert trade_date == "2026-05-12"
        return [
            {
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "score": 85.0,
                "evidence": ["close > ma60"],
                "risk": [],
                "invalid_conditions": ["close 跌破 ma60"],
            }
        ]

    loader = create_quant_signal_loader(load_signal_context_fn=fake_load)
    result = loader({"company_of_interest": "600519.SH", "trade_date": "2026-05-12"})

    assert "quant_signals" in result
    assert result["quant_signals"][0]["signal_name"] == "趋势增强"
    assert "quant_signal_context" in result
    assert "趋势增强" in result["quant_signal_context"]
