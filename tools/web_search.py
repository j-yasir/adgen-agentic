from __future__ import annotations

import os
from langchain_core.tools import tool


# ── Strategy 1: kie.ai Google Search (default) ──────────────────────────────
# Makes a separate LLM call with googleSearch grounding enabled.
# Same KIE_API_KEY used for chat and media gen — no extra key needed.

def _kie_search(query: str) -> str:
    """Execute a Google Search via kie.ai's Gemini + googleSearch grounding."""
    import requests

    from config import settings
    api_key = os.getenv("KIE_API_KEY") or settings.KIE_API_KEY
    if not api_key:
        return "Error: KIE_API_KEY not set in environment."

    url = "https://api.kie.ai/gemini-2.5-flash/v1/chat/completions"
    resp = requests.post(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "adgen-agentic/1.0",
        },
        json={
            "messages": [
                {
                    "role": "system",
                    "content": [{"type": "text", "text": (
                        "You are a research assistant. Search the web and return "
                        "comprehensive, factual results. Include specific data points, "
                        "names, URLs, and dates. Structure your findings clearly."
                    )}],
                },
                {
                    "role": "user",
                    "content": [{"type": "text", "text": query}],
                },
            ],
            "tools": [{"type": "function", "function": {"name": "googleSearch"}}],
            "stream": False,
            "include_thoughts": False,
        },
        timeout=60,
    )

    if resp.status_code != 200:
        return f"Search failed (HTTP {resp.status_code}): {resp.text[:300]}"

    data = resp.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    return content or "Search returned no results."


# ── Strategy 2: Tavily Search ────────────────────────────────────────────────
# Requires TAVILY_API_KEY. Purpose-built for LLM consumption.
# Cheaper per call, returns structured results.

def _tavily_search(query: str, max_results: int = 5) -> str:
    """Execute a web search via Tavily API."""
    try:
        from tavily import TavilyClient
    except ImportError:
        return "Error: tavily-python not installed. Run: pip install tavily-python"

    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return "Error: TAVILY_API_KEY not set in environment."

    client = TavilyClient(api_key=api_key)
    results = client.search(query, max_results=max_results)

    lines = []
    for r in results.get("results", []):
        lines.append(f"**{r.get('title', 'Untitled')}**")
        lines.append(f"URL: {r.get('url', '')}")
        lines.append(f"{r.get('content', '')}")
        lines.append("")

    return "\n".join(lines) if lines else "No results found."


# ── Public tool (uses kie.ai by default) ─────────────────────────────────────

SEARCH_BACKEND = os.getenv("SEARCH_BACKEND", "kie").lower()


@tool
def web_search(query: str) -> str:
    """Search the web for current information about a topic.

    Use this to find competitor ads, industry trends, platform updates,
    seasonal context, audience behavior, and any real-time information
    that isn't available in the BKO.

    Args:
        query: The search query string. Be specific and include relevant
               context like industry, platform, year, and geography.
    """
    if SEARCH_BACKEND == "tavily":
        return _tavily_search(query)
    return _kie_search(query)
