"""Web search tool for company and product research."""

import logging
import re
import urllib.parse

import requests

logger = logging.getLogger(__name__)

_DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
    ),
}


def web_search(query: str, limit: int = 8, engine: str = "auto") -> str:
    """Search the web for company/product/topic information.

    Tries search engines in order: Baidu → Bing → link references.
    Google is also attempted but may be blocked in mainland China.

    Args:
        query: Search query string
        limit: Max results (default 8)
        engine: "auto" / "baidu" / "bing" / "google"

    Returns:
        Formatted search results
    """
    engines = {
        "baidu": _baidu_search,
        "bing": _bing_search,
        "google": _google_search,
    }

    if engine != "auto" and engine in engines:
        return engines[engine](query, limit)

    for name in ("baidu", "bing", "google"):
        try:
            return engines[name](query, limit)
        except Exception:
            logger.debug("%s search failed, trying next", name, exc_info=True)

    return _search_urls_only(query)


def _baidu_search(query: str, limit: int = 8) -> str:
    """Search Baidu and return titles + URLs + snippets."""
    import requests as req
    encoded = urllib.parse.quote(query)
    url = f"https://www.baidu.com/s?wd={encoded}&rn={limit}"
    try:
        resp = req.get(url, headers=_DEFAULT_HEADERS, timeout=10)
        resp.raise_for_status()
    except Exception as e:
        raise RuntimeError(f"Baidu request failed: {e}")

    html = resp.text
    results = []

    # Baidu results are in <div class="result c-container"> or similar
    # Extract title and URL using regex patterns
    patterns = [
        # Pattern 1: h3 with title and link
        (r'<h3[^>]*class="[^"]*t[^"]*"[^>]*>.*?<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', 1),
        # Pattern 2: generic result container
        (r'class="c-container[^"]*".*?<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>', 1),
        # Pattern 3: data url pattern used by Baidu
        (r'<a[^>]*data-url="(https?://[^"]+)"', 0),
    ]

    for pattern, flags in patterns:
        matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                link = match[0]
                title = re.sub(r"<[^>]+>", "", match[1] if len(match) > 1 else "").strip()
            elif isinstance(match, str):
                link = match
                title = ""
            else:
                continue
            if link and not link.startswith("javascript:") and link not in {r[0] for r in results}:
                results.append((link, title))
        if len(results) >= limit:
            break

    if results:
        lines = [f"Baidu search results for '{query}':"]
        for i, (link, title) in enumerate(results[:limit], 1):
            if title:
                lines.append(f"{i}. **{title}**")
                lines.append(f"   {link}")
            else:
                lines.append(f"{i}. {link}")
        return "\n".join(lines)

    raise RuntimeError("No Baidu results found")


def _bing_search(query: str, limit: int = 8) -> str:
    """Search Bing and return titles + URLs."""
    import requests as req
    encoded = urllib.parse.quote(query)
    url = f"https://www.bing.com/search?q={encoded}&count={limit}"
    results = []
    try:
        resp = req.get(url, headers=_DEFAULT_HEADERS, timeout=10)
        resp.raise_for_status()
        html = resp.text

        pattern = r'<li class="b_algo"[^>]*>.*?<a[^>]*href="(https?://[^"]+)"[^>]*>(.*?)</a>'
        matches = re.findall(pattern, html, re.DOTALL | re.IGNORECASE)
        for link, title_raw in matches:
            title = re.sub(r"<[^>]+>", "", title_raw).strip()
            if link and not link.startswith("javascript:"):
                results.append((link, title))
            if len(results) >= limit:
                break
    except Exception as e:
        raise RuntimeError(f"Bing request failed: {e}")

    if results:
        lines = [f"Bing search results for '{query}':"]
        for i, (link, title) in enumerate(results[:limit], 1):
            lines.append(f"{i}. **{title}**")
            lines.append(f"   {link}")
        return "\n".join(lines)

    raise RuntimeError("No Bing results found")


def _google_search(query: str, limit: int = 8) -> str:
    """Search Google using googlesearch-python library."""
    from googlesearch import search

    results = []
    for lang in ("zh", "en"):
        try:
            for url in search(query, num=limit, stop=limit, lang=lang):
                if url not in results:
                    results.append(url)
        except Exception:
            pass
        if results:
            break

    if not results:
        raise RuntimeError("No Google results")

    lines = [f"Google search results for '{query}':"]
    for i, url in enumerate(results[:limit], 1):
        lines.append(f"{i}. {url}")
    return "\n".join(lines)


def _search_urls_only(query: str) -> str:
    """Ultimate fallback: provide search URLs for LLM reference."""
    encoded = urllib.parse.quote(query)
    lines = [f"Search references for '{query}' (LLM may use its knowledge):"]
    lines.append(f"")
    lines.append(f"- **Baidu**: https://www.baidu.com/s?wd={encoded}")
    lines.append(f"- **Bing Chinese**: https://cn.bing.com/search?q={encoded}")
    lines.append(f"- **Google**: https://www.google.com/search?q={encoded}")
    lines.append("")
    lines.append(
        "Use your training knowledge to provide the most relevant "
        "information about this query. Focus on recent developments, "
        "competitive analysis, and market implications."
    )
    return "\n".join(lines)
