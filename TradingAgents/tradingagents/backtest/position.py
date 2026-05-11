from dataclasses import dataclass


@dataclass(frozen=True)
class Position:
    symbol: str
    market: str
    quantity: float
    entry_price: float
    entry_date: str
