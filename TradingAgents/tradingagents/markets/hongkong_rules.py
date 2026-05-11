from dataclasses import dataclass, field
from datetime import date


@dataclass(frozen=True)
class HongKongTradingRuleInput:
    symbol: str
    side: str
    quantity: int
    lot_size: int
    last_close: float
    proposed_price: float
    trade_date: date
    is_suspended: bool = False


@dataclass(frozen=True)
class HongKongTradingRuleResult:
    allowed: bool
    reasons: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def evaluate_hk_trade_constraints(inp: HongKongTradingRuleInput) -> HongKongTradingRuleResult:
    reasons: list[str] = []
    warnings: list[str] = []

    if inp.is_suspended:
        reasons.append("security is suspended")

    if inp.quantity % inp.lot_size != 0:
        reasons.append(f"quantity must be a multiple of lot size ({inp.lot_size})")

    if inp.side.lower() == "sell":
        warnings.append("HK sell orders must respect T+2 settlement availability")

    if inp.proposed_price > inp.last_close * 1.5:
        warnings.append("proposed price is >50% above last close")
    elif inp.proposed_price < inp.last_close * 0.5:
        warnings.append("proposed price is >50% below last close")

    return HongKongTradingRuleResult(allowed=not reasons, reasons=reasons, warnings=warnings)
