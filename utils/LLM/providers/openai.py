import os
from langchain_openai import ChatOpenAI
from app.config import settings

def get_openai_llm(model_name: str, temperature: float, **kwargs):
    # Prefer: explicit kwarg → os.environ → pydantic settings (reads .env directly)
    api_key = kwargs.get('api_key') or os.getenv("OPENAI_API_KEY") or settings.OPENAI_API_KEY or None
    base_url = kwargs.get('base_url') or None

    return ChatOpenAI(
        model=model_name,
        temperature=temperature,
        api_key=api_key,
        max_tokens=kwargs.get('max_tokens'),
        streaming=kwargs.get('streaming', False),
        base_url=base_url,
    )