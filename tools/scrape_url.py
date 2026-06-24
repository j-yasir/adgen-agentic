from __future__ import annotations

import os
from langchain_core.tools import tool


@tool
def scrape_url(url: str) -> str:
    """Scrape a web page and return its content as clean text.

    Handles JavaScript-rendered pages via Firecrawl. Use this to analyze
    competitor websites, landing pages, and product pages.

    Args:
        url: The full URL to scrape (must start with http:// or https://).
    """
    try:
        from firecrawl import FirecrawlApp
    except ImportError:
        return "Error: firecrawl-py not installed. Run: pip install firecrawl-py"

    api_key = os.getenv("FIRECRAWL_API_KEY")
    if not api_key:
        return f"Error: FIRECRAWL_API_KEY not set. Cannot scrape {url}"

    try:
        app = FirecrawlApp(api_key=api_key)
        result = app.scrape_url(url, params={"formats": ["markdown"]})
        content = result.get("markdown", "") if isinstance(result, dict) else str(result)
        if not content:
            return f"Scrape returned empty content for {url}"
        # Truncate to avoid blowing up context
        if len(content) > 8000:
            content = content[:8000] + "\n\n[... truncated — content exceeded 8000 chars]"
        return content
    except Exception as e:
        return f"Scrape failed for {url}: {e}"
