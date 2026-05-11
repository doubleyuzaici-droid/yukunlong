from dataclasses import dataclass


@dataclass(frozen=True)
class EventBacktestRequest:
    start: str
    end: str
    signal_names: list[str] | None = None
