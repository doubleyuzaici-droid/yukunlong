import os

from tradingagents.markets.china import normalize_china_symbol
from tradingagents.markets.hongkong import normalize_hk_symbol


def _get_tushare_pro():
    import tushare as ts

    token = os.getenv("TUSHARE_TOKEN")
    if not token:
        raise RuntimeError("TUSHARE_TOKEN is required for Tushare China/HK data")
    ts.set_token(token)
    return ts.pro_api()


def _fmt_date(value: str) -> str:
    return value.replace("-", "")


def _display_date(value: str) -> str:
    return f"{value[:4]}-{value[4:6]}-{value[6:]}"


def get_china_stock_data(symbol: str, start_date: str, end_date: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.daily(
        ts_code=ts_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date)
    )
    if frame is None or frame.empty:
        return f"No China A-share stock data found for {ts_code} from {start_date} to {end_date}."
    frame = frame.sort_values("trade_date")
    lines = [f"China A-share OHLCV data for {ts_code}:"]
    for _, row in frame.iterrows():
        lines.append(
            f"{_display_date(str(row['trade_date']))}: "
            f"open={row['open']}, high={row['high']}, low={row['low']}, "
            f"close={row['close']}, volume={row.get('vol')}, amount={row.get('amount')}"
        )
    return "\n".join(lines)


def get_hk_stock_data(symbol: str, start_date: str, end_date: str) -> str:
    hk_code = normalize_hk_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.hk_daily(
        ts_code=hk_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date)
    )
    if frame is None or frame.empty:
        return f"No HK stock data found for {hk_code} from {start_date} to {end_date}."
    frame = frame.sort_values("trade_date")
    lines = [f"HK OHLCV data for {hk_code}:"]
    for _, row in frame.iterrows():
        lines.append(
            f"{_display_date(str(row['trade_date']))}: "
            f"open={row['open']}, high={row['high']}, low={row['low']}, "
            f"close={row['close']}, volume={row.get('vol')}"
        )
    return "\n".join(lines)


def get_china_indicators(symbol: str, start_date: str, end_date: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.daily(
        ts_code=ts_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date)
    )
    if frame is None or frame.empty:
        return f"No China A-share indicator data found for {ts_code}."
    frame = frame.sort_values("trade_date")
    first = float(frame.iloc[0]["close"])
    last = float(frame.iloc[-1]["close"])
    ret = (last - first) / first if first != 0 else 0.0
    avg_vol = float(frame["vol"].mean()) if "vol" in frame else 0.0
    return (
        f"China A-share technical summary for {ts_code}: "
        f"latest close={last}, period return={ret:.2%}, average volume={avg_vol:.0f}."
    )


def get_hk_indicators(symbol: str, start_date: str, end_date: str) -> str:
    hk_code = normalize_hk_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.hk_daily(
        ts_code=hk_code, start_date=_fmt_date(start_date), end_date=_fmt_date(end_date)
    )
    if frame is None or frame.empty:
        return f"No HK indicator data found for {hk_code}."
    frame = frame.sort_values("trade_date")
    first = float(frame.iloc[0]["close"])
    last = float(frame.iloc[-1]["close"])
    ret = (last - first) / first if first != 0 else 0.0
    avg_vol = float(frame["vol"].mean()) if "vol" in frame else 0.0
    return (
        f"HK technical summary for {hk_code}: "
        f"latest close={last}, period return={ret:.2%}, average volume={avg_vol:.0f}."
    )


def get_china_fundamentals(symbol: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.fina_indicator(ts_code=ts_code)
    if frame is None or frame.empty:
        return f"No China A-share fundamental data found for {ts_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"China A-share fundamentals for {ts_code} as of {latest.get('end_date')}: "
        f"ROE={latest.get('roe')}, gross_margin={latest.get('grossprofit_margin')}, "
        f"debt_to_assets={latest.get('debt_to_assets')}."
    )


def get_china_balance_sheet(symbol: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.balancesheet(ts_code=ts_code)
    if frame is None or frame.empty:
        return f"No China A-share balance sheet found for {ts_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"China A-share balance sheet for {ts_code} as of {latest.get('end_date')}: "
        f"total_assets={latest.get('total_assets')}, total_liab={latest.get('total_liab')}, "
        f"total_hldr_eqy={latest.get('total_hldr_eqy_exc_min_int')}."
    )


def get_china_income_statement(symbol: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.income(ts_code=ts_code)
    if frame is None or frame.empty:
        return f"No China A-share income statement found for {ts_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"China A-share income for {ts_code} as of {latest.get('end_date')}: "
        f"revenue={latest.get('revenue')}, n_income={latest.get('n_income')}."
    )


def get_china_cashflow(symbol: str) -> str:
    ts_code = normalize_china_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.cashflow(ts_code=ts_code)
    if frame is None or frame.empty:
        return f"No China A-share cashflow found for {ts_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"China A-share cashflow for {ts_code} as of {latest.get('end_date')}: "
        f"n_cashflow_act={latest.get('n_cashflow_act')}, "
        f"n_cashflow_inv_act={latest.get('n_cashflow_inv_act')}, "
        f"n_cash_flows_fin_act={latest.get('n_cash_flows_fin_act')}."
    )


def get_hk_fundamentals(symbol: str) -> str:
    hk_code = normalize_hk_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.hk_fina_indicator(ts_code=hk_code)
    if frame is None or frame.empty:
        return f"No HK fundamental data found for {hk_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"HK fundamentals for {hk_code} as of {latest.get('end_date')}: "
        f"ROE={latest.get('roe')}, gross_margin={latest.get('grossprofit_margin')}, "
        f"debt_to_assets={latest.get('debt_to_assets')}."
    )


def get_hk_balance_sheet(symbol: str) -> str:
    hk_code = normalize_hk_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.hk_balancesheet(ts_code=hk_code)
    if frame is None or frame.empty:
        return f"No HK balance sheet found for {hk_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"HK balance sheet for {hk_code} as of {latest.get('end_date')}: "
        f"total_assets={latest.get('total_assets')}, total_liab={latest.get('total_liab')}."
    )


def get_hk_income_statement(symbol: str) -> str:
    hk_code = normalize_hk_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.hk_income(ts_code=hk_code)
    if frame is None or frame.empty:
        return f"No HK income statement found for {hk_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"HK income for {hk_code} as of {latest.get('end_date')}: "
        f"revenue={latest.get('revenue')}, n_income={latest.get('n_income')}."
    )


def get_hk_cashflow(symbol: str) -> str:
    hk_code = normalize_hk_symbol(symbol)
    pro = _get_tushare_pro()
    frame = pro.hk_cashflow(ts_code=hk_code)
    if frame is None or frame.empty:
        return f"No HK cashflow found for {hk_code}."
    latest = frame.sort_values("end_date").iloc[-1].to_dict()
    return (
        f"HK cashflow for {hk_code} as of {latest.get('end_date')}: "
        f"n_cashflow_act={latest.get('n_cashflow_act')}."
    )
