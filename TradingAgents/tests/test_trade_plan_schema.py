from tradingagents.agents.schemas import PortfolioDecision, PortfolioRating, TraderAction, TraderProposal, render_pm_decision, render_trader_proposal


def test_portfolio_decision_renders_risk_controls():
    decision = PortfolioDecision(
        rating=PortfolioRating.BUY,
        executive_summary="Constructive setup.",
        investment_thesis="Quant and LLM evidence align.",
        price_target=120.0,
        stop_loss=95.0,
        max_position_pct=0.12,
        holding_period_days=20,
        exit_conditions="Close below MA60.",
    )

    rendered = render_pm_decision(decision)

    assert "Stop Loss" in rendered
    assert "Max Position" in rendered
    assert "Exit Conditions" in rendered


def test_trader_proposal_renders_extended_risk_controls():
    proposal = TraderProposal(
        action=TraderAction.BUY,
        reasoning="Follow signal alignment.",
        stop_loss=95.0,
        take_profit=120.0,
        max_position_pct=0.1,
        holding_period_days=15,
        exit_conditions="Close below MA60",
    )

    rendered = render_trader_proposal(proposal)
    assert "Take Profit" in rendered
    assert "Max Position %" in rendered
    assert "Holding Period (Days)" in rendered
