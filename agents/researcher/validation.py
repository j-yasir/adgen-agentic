"""Deterministic validation for the researcher's final output.

Pure code, no LLM calls — mirrors agents/strategist/validation.py's own
reasoning. Used to catch a response that's syntactically valid JSON but
substantively useless (e.g. the model's final synthesis degenerating into a
small unrelated fragment instead of the real report) — a case Pydantic's own
model_validate can't catch, since every field on ResearchReport has a default
and an empty-but-schema-shaped report would validate cleanly.
"""

from __future__ import annotations

# A real report has content in most of these; an empty/degenerate one has
# none. Requiring 2+ filters out both a total miss and a one-field fluke.
_SUBSTANTIVE_FIELDS = (
    "competitor_ad_patterns",
    "platform_insights",
    "recommended_angles",
    "audience_intelligence",
)


def is_substantive_report(data: object) -> bool:
    """True if at least 2 of the report's core content sections have real
    content in them."""
    if not isinstance(data, dict):
        return False

    filled = 0
    for field in _SUBSTANTIVE_FIELDS:
        value = data.get(field)
        if isinstance(value, list) and len(value) > 0:
            filled += 1
        elif isinstance(value, dict) and any(v not in (None, [], {}, "") for v in value.values()):
            filled += 1
    return filled >= 2
