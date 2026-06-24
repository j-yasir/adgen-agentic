import os
from langchain_openai import ChatOpenAI

KIE_BASE = "https://api.kie.ai"

# kie.ai embeds the model name in the URL path:
#   https://api.kie.ai/{model_name}/v1/chat/completions
# ChatOpenAI appends /chat/completions to base_url, so we set:
#   base_url = https://api.kie.ai/{model_name}/v1

# Models confirmed available on kie.ai
KIE_MODELS = {
    "gemini-2.5-flash",
    "gemini-2.5-pro",
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
}


def get_kie_llm(model_name: str, temperature: float, **kwargs):
    """
    Construct a ChatOpenAI instance pointing at kie.ai's OpenAI-compatible endpoint.

    kie.ai uses the same API key (KIE_API_KEY) for both chat models and
    media generation (image/video/audio via utils/MediaGen).
    """
    from config import settings
    api_key = kwargs.get("api_key") or os.getenv("KIE_API_KEY") or settings.KIE_API_KEY
    if not api_key:
        raise ValueError(
            "KIE_API_KEY not found in environment variables or configuration. "
            "This key is shared across chat models and media generation."
        )

    base_url = kwargs.get("base_url") or f"{KIE_BASE}/{model_name}/v1"

    return ChatOpenAI(
        model=model_name,
        temperature=temperature,
        api_key=api_key,
        max_tokens=kwargs.get("max_tokens"),
        streaming=kwargs.get("streaming", False),
        base_url=base_url,
        default_headers={"User-Agent": "adgen-agentic/1.0"},
    )
