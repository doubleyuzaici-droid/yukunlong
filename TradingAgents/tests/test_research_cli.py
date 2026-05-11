import json
from datetime import date, timedelta


def _daily_rows():
    start = date(2026, 1, 1)
    rows = []
    for index in range(130):
        current = start + timedelta(days=index)
        close = 100.0 + index
        rows.append(
            {
                "date": current.isoformat(),
                "symbol": "600519.SH",
                "market": "CHINA",
                "open": close - 0.5,
                "high": close + 1.0,
                "low": close - 1.0,
                "close": close,
                "volume": 1_000_000 + index,
                "amount": 100_000_000 + index,
                "source": "fixture",
            }
        )
    return rows


def test_research_cli_init_db_and_watchlist_commands(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.cli import main
    from tradingagents.research.db import get_db_path

    assert main(["init-db"]) == 0
    capsys.readouterr()
    assert get_db_path().exists()

    assert main(["add-watchlist", "00700.HK", "600519.SH"]) == 0
    capsys.readouterr()

    assert main(["list-watchlist"]) == 0

    output = capsys.readouterr().out
    data = json.loads(output)
    assert {row["symbol"] for row in data} == {"00700.HK", "600519.SH"}


def test_research_cli_compute_factors_command(tmp_path, monkeypatch, capsys):
    monkeypatch.setenv("TRADINGAGENTS_DATA_DIR", str(tmp_path))

    from tradingagents.research.cli import main
    from tradingagents.research.db import get_connection, init_db
    from tradingagents.research.repository import upsert_daily_bars, upsert_watchlist_symbols

    init_db()
    upsert_watchlist_symbols(["600519.SH"])
    upsert_daily_bars(_daily_rows())

    assert main(["compute-factors", "--start", "2026-01-01", "--end", "2026-05-15"]) == 0

    output = capsys.readouterr().out
    assert "computed 130 factor rows" in output
    with get_connection() as conn:
        count = conn.execute("SELECT COUNT(*) FROM factor_daily").fetchone()[0]
    assert count == 130


def test_research_cli_sync_bars_accepts_data_source(monkeypatch, capsys):
    from tradingagents.research.cli import main

    calls = []

    def fake_sync_watchlist_bars(start, end, *, source=None):
        calls.append((start, end, source))
        return 3

    monkeypatch.setattr(
        "tradingagents.research.cli.sync_watchlist_bars", fake_sync_watchlist_bars
    )

    assert (
        main(
            [
                "sync-bars",
                "--start",
                "2026-05-01",
                "--end",
                "2026-05-11",
                "--source",
                "akshare",
            ]
        )
        == 0
    )

    assert calls == [("2026-05-01", "2026-05-11", "akshare")]
    assert "synced 3 daily bars" in capsys.readouterr().out
