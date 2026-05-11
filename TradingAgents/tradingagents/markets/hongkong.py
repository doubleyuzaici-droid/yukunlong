from enum import Enum
import re


class HongKongBoard(str, Enum):
    MAIN = "hk_main"
    GEM = "hk_gem"


_SYMBOL_RE = re.compile(r"^\d{1,5}(\.HK)?$", re.IGNORECASE)


def is_hk_symbol(symbol: str) -> bool:
    if not isinstance(symbol, str):
        return False
    try:
        normalize_hk_symbol(symbol)
        return True
    except ValueError:
        return False


def normalize_hk_symbol(symbol: str) -> str:
    value = symbol.strip().upper()
    if value.endswith(".HK"):
        code = value[:-3]
    else:
        code = value
    if not _SYMBOL_RE.match(code):
        raise ValueError(f"Invalid Hong Kong stock symbol: {symbol}")
    code = code.zfill(5)
    return f"{code}.HK"


def classify_hk_symbol(symbol: str) -> HongKongBoard:
    code = normalize_hk_symbol(symbol).split(".")[0]
    if code.startswith("08"):
        return HongKongBoard.GEM
    return HongKongBoard.MAIN
