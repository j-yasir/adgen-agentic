"""Producer-side error type.

No business-rule validation lives here (unlike the Strategist, a single
image plan has no cross-asset consistency to check). JSON extraction is
reused directly from agents.strategist.validation.parse_json_object — a
generic markdown-fence-stripping JSON extractor, not strategist-specific.
"""

from __future__ import annotations


class ProducerError(Exception):
    """Raised when a Producer sub-agent stage cannot produce valid output after repairs."""
