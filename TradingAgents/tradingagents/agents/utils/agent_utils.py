from langchain_core.messages import HumanMessage, RemoveMessage

from tradingagents.markets import detect_market, Market

# Import tools from separate utility files
from tradingagents.agents.utils.core_stock_tools import (
    get_stock_data
)
from tradingagents.agents.utils.technical_indicators_tools import (
    get_indicators
)
from tradingagents.agents.utils.fundamental_data_tools import (
    get_fundamentals,
    get_balance_sheet,
    get_cashflow,
    get_income_statement
)
from tradingagents.agents.utils.news_data_tools import (
    get_news,
    get_insider_transactions,
    get_global_news,
    search_web,
)


def get_language_instruction() -> str:
    """Return a prompt instruction for the configured output language.

    Returns empty string when English (default), so no extra tokens are used.
    Only applied to user-facing agents (analysts, portfolio manager).
    Internal debate agents stay in English for reasoning quality.
    """
    from tradingagents.dataflows.config import get_config
    lang = get_config().get("output_language", "English")
    if lang.strip().lower() == "english":
        return ""
    return f" Write your entire response in {lang}."


def build_instrument_context(ticker: str) -> str:
    """Describe the exact instrument with market-specific trading rules context."""

    try:
        market = detect_market(ticker)
    except Exception:
        market = None

    if market == Market.CHINA:
        return (
            f"The instrument to analyze is `{ticker}`. "
            "This is a China A-share market instrument. Consider T+1 settlement, "
            "100-share buy lots, exchange-specific price limits, suspension risk, "
            "ST or delisting-risk labels, policy sensitivity, announcements, and liquidity. "
            "Pay special attention to the company's business segments, subsidiaries, and new product "
            "launches (e.g. AI initiatives, cloud services, overseas expansion). "
            "Evaluate how individual business lines contribute to overall valuation. "
            "Use this exact ticker in every tool call, report, and recommendation."
        )
    if market == Market.HONGKONG:
        return (
            f"The instrument to analyze is `{ticker}`. "
            "This is a Hong Kong stock market instrument. Consider T+2 settlement, "
            "variable lot sizes (not fixed 100 shares), no daily price limits, "
            "short selling allowed, international capital flow sensitivity, "
            "and HKEX announcements. "
            "Pay special attention to the company's business segments, subsidiaries, and new product "
            "launches (e.g. AI models, video generation tools, e-commerce platforms, fintech arms). "
            "Many HK-listed Chinese tech companies have high-growth subsidiaries whose value may not "
            "be fully reflected in the parent's stock price — analyze these separately. "
            "Use this exact ticker in every tool call, report, and recommendation."
        )

    return (
        f"The instrument to analyze is `{ticker}`. "
        "Use this exact ticker in every tool call, report, and recommendation, "
        "preserving any exchange suffix (e.g. `.TO`, `.L`, `.HK`, `.T`)."
    )

def create_msg_delete():
    def delete_messages(state):
        """Clear messages and add placeholder for Anthropic compatibility"""
        messages = state["messages"]

        # Remove all messages
        removal_operations = [RemoveMessage(id=m.id) for m in messages]

        # Add a minimal placeholder message
        placeholder = HumanMessage(content="Continue")

        return {"messages": removal_operations + [placeholder]}

    return delete_messages


        
