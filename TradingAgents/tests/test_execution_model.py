import pandas as pd


def test_china_entry_is_not_executable_at_limit_up():
    from tradingagents.backtest.execution_model import is_executable_entry

    assert not is_executable_entry(
        pd.Series(
            {
                "market": "CHINA",
                "open": 10.0,
                "limit_up": 10.0,
                "is_suspended": 0,
            }
        )
    )


def test_china_exit_is_not_executable_at_limit_down():
    from tradingagents.backtest.execution_model import is_executable_exit

    assert not is_executable_exit(
        pd.Series(
            {
                "market": "CHINA",
                "open": 9.0,
                "limit_down": 9.0,
                "is_suspended": 0,
            }
        )
    )
