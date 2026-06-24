from __future__ import annotations

from typing import Callable

# ── Registry ─────────────────────────────────────────────────────────────────
# Tools are registered lazily: each entry maps a string name to an import path.
# Actual @tool functions are imported on first access so the module stays
# lightweight at import time (no side-effects until get_tools() is called).

_TOOL_IMPORTS: dict[str, tuple[str, str]] = {
    # (module_path, attribute_name)
    "web_search":              ("tools.web_search",              "web_search"),
    "scrape_url":              ("tools.scrape_url",              "scrape_url"),
    "analyze_competitor":      ("tools.analyze_competitor",      "analyze_competitor"),
    "retrieve_past_campaigns": ("tools.retrieve_past_campaigns", "retrieve_past_campaigns"),
    "generate_image":          ("tools.generate_image",          "generate_image"),
    "generate_video":          ("tools.generate_video",          "generate_video"),
    "generate_audio":          ("tools.generate_audio",          "generate_audio"),
    "save_asset":              ("tools.save_asset",              "save_asset"),
}

_TOOL_CACHE: dict[str, Callable] = {}


def _load_tool(name: str) -> Callable:
    """Import and cache a tool function by registry name."""
    if name in _TOOL_CACHE:
        return _TOOL_CACHE[name]

    if name not in _TOOL_IMPORTS:
        raise ValueError(
            f"Unknown tool: '{name}'. "
            f"Available: {sorted(_TOOL_IMPORTS.keys())}"
        )

    module_path, attr = _TOOL_IMPORTS[name]
    import importlib
    module = importlib.import_module(module_path)
    tool_fn = getattr(module, attr)
    _TOOL_CACHE[name] = tool_fn
    return tool_fn


def get_tools(names: list[str]) -> list:
    """Select specific tools by name for a given agent.

    Args:
        names: List of tool names from the registry.

    Returns:
        List of @tool-decorated callables ready for create_react_agent.

    Raises:
        ValueError: If any name is not in the registry.
    """
    unknown = set(names) - set(_TOOL_IMPORTS)
    if unknown:
        raise ValueError(
            f"Unknown tools: {sorted(unknown)}. "
            f"Available: {sorted(_TOOL_IMPORTS.keys())}"
        )
    return [_load_tool(n) for n in names]


def list_tools() -> list[str]:
    """Return all registered tool names."""
    return sorted(_TOOL_IMPORTS.keys())


def register_tool(name: str, tool_fn: Callable) -> None:
    """Register a tool at runtime (useful for tests or plugins)."""
    _TOOL_IMPORTS[name] = ("__runtime__", name)
    _TOOL_CACHE[name] = tool_fn
