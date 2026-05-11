import json


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
