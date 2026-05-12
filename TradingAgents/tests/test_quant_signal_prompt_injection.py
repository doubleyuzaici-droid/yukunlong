from unittest.mock import MagicMock

from tradingagents.agents.managers.portfolio_manager import create_portfolio_manager
from tradingagents.agents.managers.research_manager import create_research_manager
from tradingagents.agents.researchers.bear_researcher import create_bear_researcher
from tradingagents.agents.researchers.bull_researcher import create_bull_researcher
from tradingagents.agents.schemas import PortfolioDecision, PortfolioRating, ResearchPlan, TraderAction, TraderProposal
from tradingagents.agents.trader.trader import create_trader


class FakeResponse:
    def __init__(self, content="ok"):
        self.content = content


class FakeLLM:
    def __init__(self):
        self.prompts = []

    def invoke(self, prompt):
        self.prompts.append(prompt)
        return FakeResponse()


def test_bull_researcher_prompt_includes_quant_signal_context():
    llm = FakeLLM()
    node = create_bull_researcher(llm)
    node(
        {
            "investment_debate_state": {"history": "", "bull_history": "", "bear_history": "", "current_response": "", "count": 0},
            "market_report": "market",
            "sentiment_report": "sentiment",
            "news_report": "news",
            "fundamentals_report": "fundamentals",
            "quant_signal_context": "## Quant Signals\n- 趋势增强 [A]",
        }
    )
    assert "Quant Signals" in llm.prompts[0]
    assert "趋势增强" in llm.prompts[0]


def test_bear_researcher_prompt_includes_quant_signal_context():
    llm = FakeLLM()
    node = create_bear_researcher(llm)
    node(
        {
            "investment_debate_state": {"history": "", "bull_history": "", "bear_history": "", "current_response": "", "count": 0},
            "market_report": "market",
            "sentiment_report": "sentiment",
            "news_report": "news",
            "fundamentals_report": "fundamentals",
            "quant_signal_context": "## Quant Signals\n- 趋势增强 [A]",
        }
    )
    assert "Quant Signals" in llm.prompts[0]


def test_research_manager_prompt_includes_quant_signal_context():
    captured = {}
    structured = MagicMock()
    structured.invoke.side_effect = lambda prompt: captured.setdefault("prompt", prompt) or ResearchPlan(
        recommendation=PortfolioRating.HOLD,
        rationale="balanced",
        strategic_actions="wait",
    )
    llm = MagicMock()
    llm.with_structured_output.return_value = structured

    node = create_research_manager(llm)
    node({
        "company_of_interest": "600519.SH",
        "quant_signal_context": "## Quant Signals\n- 趋势增强 [A]",
        "investment_debate_state": {
            "history": "h", "bull_history": "b", "bear_history": "r", "current_response": "", "judge_decision": "", "count": 1
        }
    })
    assert "Quant Signals" in captured["prompt"]


def test_trader_prompt_includes_quant_signal_context():
    captured = {}
    structured = MagicMock()
    structured.invoke.side_effect = lambda prompt: captured.setdefault("prompt", prompt) or TraderProposal(
        action=TraderAction.HOLD,
        reasoning="wait",
    )
    llm = MagicMock()
    llm.with_structured_output.return_value = structured

    node = create_trader(llm)
    node({
        "company_of_interest": "600519.SH",
        "investment_plan": "plan",
        "quant_signal_context": "## Quant Signals\n- 趋势增强 [A]",
    })
    assert any("Quant Signals" in m["content"] for m in captured["prompt"])


def test_portfolio_manager_prompt_includes_quant_signal_context():
    captured = {}
    structured = MagicMock()
    structured.invoke.side_effect = lambda prompt: captured.setdefault("prompt", prompt) or PortfolioDecision(
        rating=PortfolioRating.HOLD,
        executive_summary="summary",
        investment_thesis="thesis",
    )
    llm = MagicMock()
    llm.with_structured_output.return_value = structured

    node = create_portfolio_manager(llm)
    node({
        "company_of_interest": "600519.SH",
        "investment_plan": "plan",
        "trader_investment_plan": "trader",
        "quant_signal_context": "## Quant Signals\n- 趋势增强 [A]",
        "past_context": "",
        "risk_debate_state": {
            "history": "h",
            "aggressive_history": "a",
            "conservative_history": "c",
            "neutral_history": "n",
            "latest_speaker": "",
            "current_aggressive_response": "",
            "current_conservative_response": "",
            "current_neutral_response": "",
            "judge_decision": "",
            "count": 1,
        },
    })
    assert "Quant Signals" in captured["prompt"]
