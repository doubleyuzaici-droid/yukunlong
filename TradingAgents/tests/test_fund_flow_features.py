from datetime import date, timedelta


def _daily_rows(symbol: str = "600519.SH"):
    start = date(2026, 1, 1)
    rows = []
    for i in range(40):
        d = (start + timedelta(days=i)).isoformat()
        close = 100 + i
        rows.append({"date": d, "symbol": symbol, "market": "CHINA", "open": close-1, "high": close+1, "low": close-2, "close": close, "volume": 10, "amount": 100, "source": "t"})
    return rows


def test_compute_symbol_factors_with_fund_flow(tmp_path, monkeypatch):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))
    from tradingagents.research.db import init_db, get_connection
    from tradingagents.research.repository import upsert_daily_bars, upsert_watchlist_symbols, upsert_fund_flows
    from tradingagents.research.factor_pipeline import compute_watchlist_factors

    init_db()
    upsert_watchlist_symbols(["600519.SH"])
    upsert_daily_bars(_daily_rows())
    flows = []
    for r in _daily_rows():
        flows.append({"date": r["date"], "symbol": "600519.SH", "main_net_inflow": 1000.0, "large_net_inflow": 100.0, "northbound_net_inflow": 10.0})
    upsert_fund_flows(flows)
    compute_watchlist_factors("2026-01-01", "2026-02-28")
    with get_connection() as conn:
        row = conn.execute("SELECT main_net_inflow_ratio20, northbound_inflow_5d FROM factor_daily WHERE symbol=? ORDER BY date DESC LIMIT 1", ("600519.SH",)).fetchone()
    assert row is not None
    assert row["main_net_inflow_ratio20"] is not None
    assert row["northbound_inflow_5d"] is not None
