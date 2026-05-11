import json

PROHIBITED_TERMS = ["买入", "卖出", "目标价", "仓位", "满仓", "稳赚"]


def _seed_signals():
    from tradingagents.research.repository import (
        upsert_signals,
        upsert_watchlist_symbols,
    )

    upsert_watchlist_symbols(["600519.SH", "00700.HK"])
    upsert_signals(
        [
            {
                "signal_id": "trend",
                "date": "2026-05-11",
                "symbol": "600519.SH",
                "market": "CHINA",
                "signal_name": "趋势增强",
                "signal_level": "A",
                "direction": "opportunity",
                "timeframe": "daily",
                "evidence_json": json.dumps(["close > ma60"], ensure_ascii=False),
                "risk_json": json.dumps(["成交确认不足"], ensure_ascii=False),
                "invalid_json": json.dumps(["跌破 ma60"], ensure_ascii=False),
                "score": 85.0,
                "strategy_version": "signal_v1",
            },
            {
                "signal_id": "risk",
                "date": "2026-05-11",
                "symbol": "00700.HK",
                "market": "HONGKONG",
                "signal_name": "趋势破位",
                "signal_level": "D",
                "direction": "risk",
                "timeframe": "daily",
                "evidence_json": json.dumps(["close < ma60"], ensure_ascii=False),
                "risk_json": json.dumps(["趋势结构转弱"], ensure_ascii=False),
                "invalid_json": json.dumps(["重新站上 ma60"], ensure_ascii=False),
                "score": 20.0,
                "strategy_version": "signal_v1",
            },
        ]
    )


def test_daily_report_markdown_summarizes_signals_without_trading_terms(
    tmp_path, monkeypatch
):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.reports.daily_report import generate_daily_report

    init_db()
    _seed_signals()

    markdown = generate_daily_report("2026-05-11")

    assert "# A/H 股自选股复盘 - 2026-05-11" in markdown
    assert "扫描股票数：2" in markdown
    assert "触发信号数：2" in markdown
    assert (
        "| 600519.SH | CHINA | 趋势增强 | A | close > ma60 | 成交确认不足 |" in markdown
    )
    assert (
        "| 00700.HK | HONGKONG | 趋势破位 | D | close < ma60 | 趋势结构转弱 |"
        in markdown
    )
    for term in PROHIBITED_TERMS:
        assert term not in markdown


def test_save_daily_report_writes_markdown_file(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.db import init_db
    from tradingagents.research.reports.daily_report import save_daily_report

    init_db()
    _seed_signals()

    path = save_daily_report("2026-05-11")

    assert path.exists()
    assert path.name == "daily_report_2026-05-11.md"
    assert path.read_text(encoding="utf-8").startswith("# A/H 股自选股复盘")
