import sys
from datetime import date
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))


def _has_langchain():
    try:
        import langchain_core  # noqa: F401

        return True
    except ImportError:
        return False


class TestChinaSymbolNormalization:
    def test_normalize_shanghai_main(self):
        from tradingagents.markets.china import normalize_china_symbol

        assert normalize_china_symbol("600519") == "600519.SH"
        assert normalize_china_symbol("601318") == "601318.SH"

    def test_normalize_shenzhen_main(self):
        from tradingagents.markets.china import normalize_china_symbol

        assert normalize_china_symbol("000001") == "000001.SZ"
        assert normalize_china_symbol("002415") == "002415.SZ"

    def test_normalize_chinext(self):
        from tradingagents.markets.china import normalize_china_symbol

        assert normalize_china_symbol("300750") == "300750.SZ"

    def test_normalize_star(self):
        from tradingagents.markets.china import normalize_china_symbol

        assert normalize_china_symbol("688981") == "688981.SH"

    def test_normalize_bse(self):
        from tradingagents.markets.china import normalize_china_symbol

        assert normalize_china_symbol("920118") == "920118.BJ"

    def test_normalize_already_qualified(self):
        from tradingagents.markets.china import normalize_china_symbol

        assert normalize_china_symbol("600519.SH") == "600519.SH"
        assert normalize_china_symbol("000001.SZ") == "000001.SZ"

    def test_reject_invalid_paths(self):
        from tradingagents.markets.china import normalize_china_symbol

        with pytest.raises(ValueError):
            normalize_china_symbol("../600519")
        with pytest.raises(ValueError):
            normalize_china_symbol("not_a_symbol")

    def test_is_china_symbol(self):
        from tradingagents.markets.china import is_china_symbol

        assert is_china_symbol("600519.SH") is True
        assert is_china_symbol("700.HK") is False
        assert is_china_symbol("NVDA") is False

    def test_classify_board(self):
        from tradingagents.markets.china import ChinaBoard, classify_china_symbol

        assert classify_china_symbol("600519.SH") == ChinaBoard.SSE_MAIN
        assert classify_china_symbol("688981.SH") == ChinaBoard.STAR
        assert classify_china_symbol("300750.SZ") == ChinaBoard.CHINEXT
        assert classify_china_symbol("920118.BJ") == ChinaBoard.BSE


class TestHongKongSymbolNormalization:
    def test_normalize_basic(self):
        from tradingagents.markets.hongkong import normalize_hk_symbol

        assert normalize_hk_symbol("00700") == "00700.HK"
        assert normalize_hk_symbol("700") == "00700.HK"

    def test_normalize_already_qualified(self):
        from tradingagents.markets.hongkong import normalize_hk_symbol

        assert normalize_hk_symbol("00700.HK") == "00700.HK"
        assert normalize_hk_symbol("00700.hk") == "00700.HK"

    def test_normalize_large_codes(self):
        from tradingagents.markets.hongkong import normalize_hk_symbol

        assert normalize_hk_symbol("09988") == "09988.HK"

    def test_is_hk_symbol(self):
        from tradingagents.markets.hongkong import is_hk_symbol

        assert is_hk_symbol("00700.HK") is True
        assert is_hk_symbol("600519.SH") is False
        assert is_hk_symbol("NVDA") is False

    def test_reject_invalid(self):
        from tradingagents.markets.hongkong import normalize_hk_symbol

        with pytest.raises(ValueError):
            normalize_hk_symbol("NVDA")
        with pytest.raises(ValueError):
            normalize_hk_symbol("")

    def test_classify_board(self):
        from tradingagents.markets.hongkong import HongKongBoard, classify_hk_symbol

        assert classify_hk_symbol("00700.HK") == HongKongBoard.MAIN
        assert classify_hk_symbol("08083.HK") == HongKongBoard.GEM


class TestMarketDetection:
    def test_detect_china(self):
        from tradingagents.markets import detect_market, Market

        assert detect_market("600519.SH") == Market.CHINA
        assert detect_market("000001.SZ") == Market.CHINA

    def test_detect_hongkong(self):
        from tradingagents.markets import detect_market, Market

        assert detect_market("00700.HK") == Market.HONGKONG
        assert detect_market("09988.HK") == Market.HONGKONG

    def test_detect_us(self):
        from tradingagents.markets import detect_market, Market

        assert detect_market("NVDA") == Market.US
        assert detect_market("AAPL") == Market.US


class TestDefaultConfig:
    def test_config_has_market_profile(self):
        from tradingagents.default_config import DEFAULT_CONFIG

        assert "market_profile" in DEFAULT_CONFIG
        assert "china_market" in DEFAULT_CONFIG
        assert "hongkong_market" in DEFAULT_CONFIG

    def test_china_market_config(self):
        from tradingagents.default_config import DEFAULT_CONFIG

        cm = DEFAULT_CONFIG["china_market"]
        assert cm["simulation_only"] is True
        assert cm["benchmark_symbol"] == "000300.SH"

    def test_hk_market_config(self):
        from tradingagents.default_config import DEFAULT_CONFIG

        hm = DEFAULT_CONFIG["hongkong_market"]
        assert hm["simulation_only"] is True
        assert hm["benchmark_symbol"] == "HSI"

    def test_data_vendors_include_china(self):
        from tradingagents.default_config import DEFAULT_CONFIG

        dv = DEFAULT_CONFIG["data_vendors"]
        assert "china_market_data" in dv
        assert "hk_market_data" in dv


class TestChinaRules:
    def test_main_board_lot_size_blocks_odd(self):
        from tradingagents.markets.china_rules import (
            ChinaTradingRuleInput,
            evaluate_china_trade_constraints,
        )

        result = evaluate_china_trade_constraints(
            ChinaTradingRuleInput(
                symbol="600519.SH",
                side="buy",
                quantity=101,
                last_close=100.0,
                proposed_price=101.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is False
        assert any("100-share lot" in r for r in result.reasons)

    def test_main_board_price_limit_up(self):
        from tradingagents.markets.china_rules import (
            ChinaTradingRuleInput,
            evaluate_china_trade_constraints,
        )

        result = evaluate_china_trade_constraints(
            ChinaTradingRuleInput(
                symbol="600519.SH",
                side="buy",
                quantity=100,
                last_close=100.0,
                proposed_price=111.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is False
        assert any("price limit" in r for r in result.reasons)

    def test_main_board_within_limit(self):
        from tradingagents.markets.china_rules import (
            ChinaTradingRuleInput,
            evaluate_china_trade_constraints,
        )

        result = evaluate_china_trade_constraints(
            ChinaTradingRuleInput(
                symbol="600519.SH",
                side="buy",
                quantity=100,
                last_close=100.0,
                proposed_price=101.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is True

    def test_chinext_twenty_percent(self):
        from tradingagents.markets.china_rules import (
            ChinaTradingRuleInput,
            evaluate_china_trade_constraints,
        )

        result = evaluate_china_trade_constraints(
            ChinaTradingRuleInput(
                symbol="300750.SZ",
                side="buy",
                quantity=100,
                last_close=100.0,
                proposed_price=119.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is True

    def test_st_has_stricter_limit(self):
        from tradingagents.markets.china_rules import (
            ChinaTradingRuleInput,
            evaluate_china_trade_constraints,
        )

        result = evaluate_china_trade_constraints(
            ChinaTradingRuleInput(
                symbol="600519.SH",
                side="buy",
                quantity=100,
                last_close=100.0,
                proposed_price=106.0,
                trade_date=date(2026, 4, 30),
                is_st=True,
            )
        )
        assert result.allowed is False

    def test_suspended(self):
        from tradingagents.markets.china_rules import (
            ChinaTradingRuleInput,
            evaluate_china_trade_constraints,
        )

        result = evaluate_china_trade_constraints(
            ChinaTradingRuleInput(
                symbol="600519.SH",
                side="buy",
                quantity=100,
                last_close=100.0,
                proposed_price=100.0,
                trade_date=date(2026, 4, 30),
                is_suspended=True,
            )
        )
        assert result.allowed is False
        assert any("suspended" in r for r in result.reasons)


class TestHongKongRules:
    def test_lot_size_check(self):
        from tradingagents.markets.hongkong_rules import (
            HongKongTradingRuleInput,
            evaluate_hk_trade_constraints,
        )

        result = evaluate_hk_trade_constraints(
            HongKongTradingRuleInput(
                symbol="00700.HK",
                side="buy",
                quantity=50,
                lot_size=100,
                last_close=300.0,
                proposed_price=310.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is False
        assert any("lot size" in r for r in result.reasons)

    def test_lot_size_ok(self):
        from tradingagents.markets.hongkong_rules import (
            HongKongTradingRuleInput,
            evaluate_hk_trade_constraints,
        )

        result = evaluate_hk_trade_constraints(
            HongKongTradingRuleInput(
                symbol="00700.HK",
                side="buy",
                quantity=200,
                lot_size=100,
                last_close=300.0,
                proposed_price=310.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is True

    def test_extreme_price_warning(self):
        from tradingagents.markets.hongkong_rules import (
            HongKongTradingRuleInput,
            evaluate_hk_trade_constraints,
        )

        result = evaluate_hk_trade_constraints(
            HongKongTradingRuleInput(
                symbol="00700.HK",
                side="buy",
                quantity=100,
                lot_size=100,
                last_close=300.0,
                proposed_price=500.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is True
        assert any("50%" in w for w in result.warnings)

    def test_t2_warning_on_sell(self):
        from tradingagents.markets.hongkong_rules import (
            HongKongTradingRuleInput,
            evaluate_hk_trade_constraints,
        )

        result = evaluate_hk_trade_constraints(
            HongKongTradingRuleInput(
                symbol="00700.HK",
                side="sell",
                quantity=100,
                lot_size=100,
                last_close=300.0,
                proposed_price=310.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is True
        assert any("T+2" in w for w in result.warnings)


class TestPromptContext:
    @pytest.mark.skipif(
        "not _has_langchain()",
        reason="langchain_core not installed in this environment",
    )
    def test_china_context_mentions_a_share_rules(self):
        from tradingagents.agents.utils.agent_utils import build_instrument_context

        context = build_instrument_context("600519.SH")
        assert "A-share" in context
        assert "T+1" in context
        assert "price limit" in context

    @pytest.mark.skipif(
        "not _has_langchain()",
        reason="langchain_core not installed in this environment",
    )
    def test_hk_context_mentions_hk_rules(self):
        from tradingagents.agents.utils.agent_utils import build_instrument_context

        context = build_instrument_context("00700.HK")
        assert "Hong Kong" in context
        assert "T+2" in context
        assert "no daily price limits" in context

    @pytest.mark.skipif(
        "not _has_langchain()",
        reason="langchain_core not installed in this environment",
    )
    def test_us_context_unchanged(self):
        from tradingagents.agents.utils.agent_utils import build_instrument_context

        context = build_instrument_context("NVDA")
        assert "A-share" not in context
        assert "Hong Kong" not in context


class TestCompliance:
    def test_china_annotation(self):
        from tradingagents.markets.china_compliance import annotate_market_decision

        result = annotate_market_decision("BUY 100 shares", "600519.SH")
        assert "SIMULATION ONLY" in result
        assert "not financial advice" in result.lower()

    def test_hk_annotation(self):
        from tradingagents.markets.china_compliance import annotate_market_decision

        result = annotate_market_decision("BUY 100 shares", "00700.HK")
        assert "SIMULATION ONLY" in result
        assert "Hong Kong" in result

    def test_us_not_annotated(self):
        from tradingagents.markets.china_compliance import annotate_market_decision

        result = annotate_market_decision("BUY NVDA", "NVDA")
        assert result == "BUY NVDA"


class TestSmokeIntegration:
    def test_full_pipeline_smoke(self):
        from tradingagents.markets.china import normalize_china_symbol
        from tradingagents.markets.china_compliance import annotate_market_decision
        from tradingagents.markets.china_rules import (
            ChinaTradingRuleInput,
            evaluate_china_trade_constraints,
        )

        symbol = normalize_china_symbol("600519")
        assert symbol == "600519.SH"

        result = evaluate_china_trade_constraints(
            ChinaTradingRuleInput(
                symbol=symbol,
                side="buy",
                quantity=100,
                last_close=100.0,
                proposed_price=101.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is True

        decision = annotate_market_decision("BUY 100 shares", symbol)
        assert "SIMULATION ONLY" in decision
        assert "A-share" in decision

    def test_hk_full_pipeline_smoke(self):
        from tradingagents.markets.hongkong import normalize_hk_symbol
        from tradingagents.markets.china_compliance import annotate_market_decision
        from tradingagents.markets.hongkong_rules import (
            HongKongTradingRuleInput,
            evaluate_hk_trade_constraints,
        )

        symbol = normalize_hk_symbol("700")
        assert symbol == "00700.HK"

        result = evaluate_hk_trade_constraints(
            HongKongTradingRuleInput(
                symbol=symbol,
                side="buy",
                quantity=200,
                lot_size=100,
                last_close=300.0,
                proposed_price=310.0,
                trade_date=date(2026, 4, 30),
            )
        )
        assert result.allowed is True

        decision = annotate_market_decision("BUY 200 shares", symbol)
        assert "SIMULATION ONLY" in decision
