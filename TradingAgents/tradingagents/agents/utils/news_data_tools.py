from langchain_core.tools import tool
from typing import Annotated
from tradingagents.dataflows.interface import route_to_vendor

@tool
def get_news(
    ticker: Annotated[str, "Ticker symbol"],
    start_date: Annotated[str, "Start date in yyyy-mm-dd format"],
    end_date: Annotated[str, "End date in yyyy-mm-dd format"],
) -> str:
    """
    Retrieve news data for a given ticker symbol.
    Uses the configured news_data vendor.
    Args:
        ticker (str): Ticker symbol
        start_date (str): Start date in yyyy-mm-dd format
        end_date (str): End date in yyyy-mm-dd format
    Returns:
        str: A formatted string containing news data
    """
    return route_to_vendor("get_news", ticker, start_date, end_date)

@tool
def get_global_news(
    curr_date: Annotated[str, "Current date in yyyy-mm-dd format"],
    look_back_days: Annotated[int, "Number of days to look back"] = 7,
    limit: Annotated[int, "Maximum number of articles to return"] = 5,
) -> str:
    """
    Retrieve global news data.
    Uses the configured news_data vendor.
    Args:
        curr_date (str): Current date in yyyy-mm-dd format
        look_back_days (int): Number of days to look back (default 7)
        limit (int): Maximum number of articles to return (default 5)
    Returns:
        str: A formatted string containing global news data
    """
    return route_to_vendor("get_global_news", curr_date, look_back_days, limit)

@tool
def get_insider_transactions(
    ticker: Annotated[str, "ticker symbol"],
) -> str:
    """
    Retrieve insider transaction information about a company.
    Uses the configured news_data vendor.
    Args:
        ticker (str): Ticker symbol of the company
    Returns:
        str: A report of insider transaction data
    """
    return route_to_vendor("get_insider_transactions", ticker)

@tool
def search_web(
    query: Annotated[str, "Search query for company, product, or topic research. Use Chinese queries for Chinese companies (e.g. '可灵 AI 最新进展 2026')"],
    limit: Annotated[int, "Maximum number of results"] = 8,
    engine: Annotated[str, "Search engine: 'auto' (Baidu→Bing→Google), 'baidu', 'bing', 'google'"] = "auto",
) -> str:
    """
    Search the web for the latest information about companies, products, subsidiaries,
    business segments, and competitive developments. Uses Baidu for Chinese queries by default,
    falls back to Bing and Google. Use this to find information about
    specific subsidiaries (e.g. 'Kuaishou Kling AI update 2026') or new product launches
    that may not appear in traditional financial news sources.
    Args:
        query (str): Search query (be specific - include company name + product/subsidiary name)
        limit (int): Maximum number of results (default 8)
        engine (str): Search engine to use (default 'auto')
    Returns:
        str: Web search results with titles, URLs, and snippets
    """
    from tradingagents.dataflows.web_search import web_search
    return web_search(query, limit, engine)
