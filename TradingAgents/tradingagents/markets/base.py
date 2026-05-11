from enum import Enum
from typing import Optional


class Market(str, Enum):
    US = "us"
    CHINA = "china"
    HONGKONG = "hongkong"


def detect_market(symbol: str) -> Optional[Market]:
    from .china import is_china_symbol
    from .hongkong import is_hk_symbol

    if is_china_symbol(symbol):
        return Market.CHINA
    if is_hk_symbol(symbol):
        return Market.HONGKONG
    return Market.US
