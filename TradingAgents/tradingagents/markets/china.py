from enum import Enum
import re


class ChinaBoard(str, Enum):
    SSE_MAIN = "sse_main"
    SZSE_MAIN = "szse_main"
    CHINEXT = "chinext"
    STAR = "star"
    BSE = "bse"


_SYMBOL_RE = re.compile(r"^\d{6}(\.(SH|SZ|BJ))?$", re.IGNORECASE)


def is_china_symbol(symbol: str) -> bool:
    if not isinstance(symbol, str):
        return False
    try:
        normalize_china_symbol(symbol)
        return True
    except ValueError:
        return False


def normalize_china_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if not _SYMBOL_RE.match(value):
        raise ValueError(f"Invalid China A-share symbol: {symbol}")
    if "." in value:
        return value
    if value.startswith(("600", "601", "603", "605", "688")):
        return f"{value}.SH"
    if value.startswith(("000", "001", "002", "003", "300")):
        return f"{value}.SZ"
    if value.startswith(
        (
            "430",
            "830",
            "831",
            "832",
            "833",
            "834",
            "835",
            "836",
            "837",
            "838",
            "839",
            "870",
            "871",
            "872",
            "873",
            "920",
        )
    ):
        return f"{value}.BJ"
    raise ValueError(f"Cannot infer exchange for China A-share symbol: {symbol}")


def classify_china_symbol(symbol: str) -> ChinaBoard:
    normalized = normalize_china_symbol(symbol)
    code, exchange = normalized.split(".")
    if exchange == "BJ":
        return ChinaBoard.BSE
    if exchange == "SH" and code.startswith("688"):
        return ChinaBoard.STAR
    if exchange == "SH":
        return ChinaBoard.SSE_MAIN
    if exchange == "SZ" and code.startswith("300"):
        return ChinaBoard.CHINEXT
    return ChinaBoard.SZSE_MAIN
