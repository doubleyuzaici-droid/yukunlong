import pandas as pd


def is_executable_entry(row: pd.Series) -> bool:
    if row.get("is_suspended", 0):
        return False
    return not pd.isna(row.get("open"))


def is_executable_exit(row: pd.Series) -> bool:
    if row.get("is_suspended", 0):
        return False
    return not pd.isna(row.get("open"))
