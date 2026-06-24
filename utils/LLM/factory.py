from .config import LLMProvider
from .schemas import LLMConfig
from langchain_core.language_models.chat_models import BaseChatModel


def get_llm_model(config: LLMConfig) -> BaseChatModel:
    provider = config.provider.lower()

    args = {
        "model_name": config.model_name,
        "temperature": config.temperature,
        "max_tokens": config.max_tokens,
        "streaming": config.streaming,
        "api_key": config.api_key,
        "base_url": config.base_url,
    }

    if provider == LLMProvider.OPENAI.value:
        from .providers.openai import get_openai_llm
        return get_openai_llm(**args)
    elif provider == LLMProvider.GEMINI.value:
        from .providers.gemini import get_gemini_llm
        return get_gemini_llm(**args)
    elif provider == LLMProvider.HUGGINGFACE.value:
        from .providers.huggingface import get_huggingface_llm
        return get_huggingface_llm(**args)
    else:
        raise ValueError(f"Unsupported provider: {provider}")