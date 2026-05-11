from dataclasses import dataclass


@dataclass(frozen=True)
class WatchlistItem:
    symbol: str
    market: str
    name: str | None = None
    industry: str | None = None
    thesis: str | None = None
    status: str = "active"


@dataclass(frozen=True)
class DailyBar:
    date: str
    symbol: str
    market: str
    open: float | None = None
    high: float | None = None
    low: float | None = None
    close: float | None = None
    volume: float | None = None
    amount: float | None = None
    source: str | None = None
