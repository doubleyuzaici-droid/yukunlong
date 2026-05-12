from __future__ import annotations

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class ResearchSignal:
    date: str
    symbol: str
    market: str
    signal_name: str
    signal_level: Literal["S", "A", "B", "C", "D"]
    direction: Literal["opportunity", "risk", "neutral"]
    timeframe: str
    evidence: list[str] = field(default_factory=list)
    risk: list[str] = field(default_factory=list)
    invalid_conditions: list[str] = field(default_factory=list)
    score: float = 0.0
    strategy_version: str = "signal_v1"
    market_regime: str = "range_bound"

    @property
    def signal_id(self) -> str:
        safe_symbol = self.symbol.replace(".", "_")
        return f"{self.date}-{safe_symbol}-{self.signal_name}-{self.strategy_version}"
