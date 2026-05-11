from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from .china import ChinaBoard, classify_china_symbol


@dataclass(frozen=True)
class ChinaTradingRuleInput:
    symbol: str
    side: str
    quantity: int
    last_close: float
    proposed_price: float
    trade_date: date
    is_st: bool = False
    is_suspended: bool = False
    is_first_five_listing_days: bool = False


@dataclass(frozen=True)
class ChinaTradingRuleResult:
    allowed: bool
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def _price_limit(symbol: str, is_st: bool, is_first_five_listing_days: bool) -> Optional[float]:
    if is_first_five_listing_days:
        return None
    board = classify_china_symbol(symbol)
    if board in {ChinaBoard.CHINEXT, ChinaBoard.STAR}:
        return 0.20
    if board == ChinaBoard.BSE:
        return 0.30
    return 0.10 if not is_st else 0.05


def evaluate_china_trade_constraints(inp: ChinaTradingRuleInput) -> ChinaTradingRuleResult:
    reasons: list[str] = []
    warnings: list[str] = []

    if inp.is_suspended:
        reasons.append("security is suspended")

    if inp.side.lower() == "buy" and inp.quantity % 100 != 0:
        reasons.append("buy quantity must be a 100-share lot")

    limit = _price_limit(inp.symbol, inp.is_st, inp.is_first_five_listing_days)
    if limit is not None:
        upper = round(inp.last_close * (1 + limit), 2)
        lower = round(inp.last_close * (1 - limit), 2)
        if inp.proposed_price > upper or inp.proposed_price < lower:
            reasons.append(f"proposed price violates {limit:.0%} price limit")

    if inp.side.lower() == "sell":
        warnings.append("A-share sell orders must respect T+1 availability")

    if inp.is_st:
        warnings.append("security is ST-labelled, higher delisting risk")

    return ChinaTradingRuleResult(allowed=not reasons, reasons=reasons, warnings=warnings)
