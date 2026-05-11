import pandas as pd


def _has_number(value) -> bool:
    return value is not None and not pd.isna(value)


def is_executable_entry(row: pd.Series) -> bool:
    if row.get("is_suspended", 0):
        return False
    open_price = row.get("open")
    if not _has_number(open_price):
        return False
    limit_up = row.get("limit_up")
    if row.get("market") == "CHINA" and _has_number(limit_up):
        return float(open_price) < float(limit_up)
    return True


def is_executable_exit(row: pd.Series) -> bool:
    if row.get("is_suspended", 0):
        return False
    open_price = row.get("open")
    if not _has_number(open_price):
        return False
    limit_down = row.get("limit_down")
    if row.get("market") == "CHINA" and _has_number(limit_down):
        return float(open_price) > float(limit_down)
    return True
