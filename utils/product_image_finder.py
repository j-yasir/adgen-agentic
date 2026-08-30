"""Deterministic (no LLM, no scraping service) product image discovery.

Given a product page URL, fetches the raw HTML with a plain HTTP GET and
looks for a real image URL via the two near-universal conventions almost
every e-commerce/CMS platform uses: the og:image meta tag, and schema.org
Product JSON-LD. This is a parsing task, not a research task — the LLM
never sees raw HTML here, and no third-party scraping service is used (see
agents/business_researcher/prompts.py's PRODUCT_RESEARCH_SYSTEM_PROMPT for
why web_search alone isn't the right tool for finding an exact image URL).
"""

from __future__ import annotations

import json
from html.parser import HTMLParser
from urllib.parse import urljoin

import requests

from utils.logger import get_logger

logger = get_logger(__name__)

_REQUEST_TIMEOUT = 15
_USER_AGENT = "Mozilla/5.0 (compatible; AdGenBot/1.0; +product-image-lookup)"
_MAX_IMAGE_BYTES = 8 * 1024 * 1024  # matches utils/storage.py's own upload cap
_CHUNK_SIZE = 65536


class _MetaAndJsonLdParser(HTMLParser):
    """Collects the first og:image meta tag and every JSON-LD <script> body."""

    def __init__(self) -> None:
        super().__init__()
        self.og_image: str | None = None
        self._in_ld_json = False
        self._ld_json_chunks: list[str] = []
        self.ld_json_blocks: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attrs_dict = dict(attrs)
        if tag == "meta" and attrs_dict.get("property") in ("og:image", "og:image:secure_url"):
            if not self.og_image and attrs_dict.get("content"):
                self.og_image = attrs_dict["content"]
        if tag == "script" and attrs_dict.get("type") == "application/ld+json":
            self._in_ld_json = True
            self._ld_json_chunks = []

    def handle_data(self, data: str) -> None:
        if self._in_ld_json:
            self._ld_json_chunks.append(data)

    def handle_endtag(self, tag: str) -> None:
        if tag == "script" and self._in_ld_json:
            self._in_ld_json = False
            self.ld_json_blocks.append("".join(self._ld_json_chunks))


def _is_product_type(type_value) -> bool:
    if type_value == "Product":
        return True
    return isinstance(type_value, list) and "Product" in type_value


def _extract_ld_json_image(blocks: list[str]) -> str | None:
    for block in blocks:
        try:
            data = json.loads(block)
        except json.JSONDecodeError:
            continue

        candidates = data if isinstance(data, list) else [data]
        for candidate in candidates:
            if not isinstance(candidate, dict):
                continue
            # Some sites wrap entries in an @graph array instead of a bare list.
            entries = candidate.get("@graph") if isinstance(candidate.get("@graph"), list) else [candidate]
            for entry in entries:
                if not isinstance(entry, dict) or not _is_product_type(entry.get("@type")):
                    continue
                image = entry.get("image")
                if isinstance(image, str):
                    return image
                if isinstance(image, list) and image:
                    first = image[0]
                    return first if isinstance(first, str) else (first.get("url") if isinstance(first, dict) else None)
                if isinstance(image, dict):
                    return image.get("url")
    return None


def find_product_image_url(page_url: str) -> str | None:
    """Fetch page_url and return a real, absolute product image URL, or None
    if neither an og:image meta tag nor a Product JSON-LD image field is
    found. Never raises — a lookup failure here should never block product
    creation, just leave it without a photo."""
    try:
        resp = requests.get(page_url, timeout=_REQUEST_TIMEOUT, headers={"User-Agent": _USER_AGENT})
        resp.raise_for_status()
    except requests.RequestException as exc:
        logger.warning("find_product_image_url: fetch failed for %s: %s", page_url, exc)
        return None

    parser = _MetaAndJsonLdParser()
    try:
        parser.feed(resp.text)
    except Exception as exc:  # noqa: BLE001 — a malformed page must never crash product creation
        logger.warning("find_product_image_url: HTML parse failed for %s: %s", page_url, exc)
        return None

    image_url = parser.og_image or _extract_ld_json_image(parser.ld_json_blocks)
    if not image_url:
        logger.info("find_product_image_url: no og:image or Product JSON-LD image found for %s", page_url)
        return None

    return urljoin(page_url, image_url)


def fetch_image_bytes(image_url: str) -> bytes | None:
    """Download image bytes for utils/storage.py::save_product_image() to
    validate — that function does the real format/decode check, this only
    caps download size. Never raises; None means "couldn't get an image",
    not an error the caller needs to handle specially."""
    try:
        resp = requests.get(
            image_url, timeout=_REQUEST_TIMEOUT, headers={"User-Agent": _USER_AGENT}, stream=True,
        )
        resp.raise_for_status()

        chunks: list[bytes] = []
        total = 0
        for chunk in resp.iter_content(chunk_size=_CHUNK_SIZE):
            total += len(chunk)
            if total > _MAX_IMAGE_BYTES:
                logger.warning("fetch_image_bytes: %s exceeds %d bytes, aborting", image_url, _MAX_IMAGE_BYTES)
                return None
            chunks.append(chunk)
        return b"".join(chunks)
    except requests.RequestException as exc:
        logger.warning("fetch_image_bytes: download failed for %s: %s", image_url, exc)
        return None
