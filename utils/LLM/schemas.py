from pydantic import BaseModel, Field
from typing import Optional, Any, Type

class LLMConfig(BaseModel):
    """Configuration for the LLM Model parameters"""
    provider: str
    model_name: Optional[str] = None
    temperature: float = 0.7
    max_tokens: Optional[int] = 1000
    streaming: bool = False
    api_key: Optional[str] = None  # Optional override
    base_url: Optional[str] = None  # Optional custom API base URL (e.g. kie.ai)

class GenerationRequest(BaseModel):
    """The actual payload for a generation call"""
    user_prompt: Optional[str] = None
    system_prompt: Optional[str] = "You are a helpful AI assistant."
    output_schema: Optional[Type[BaseModel]] = None # Pass a Pydantic class here for structured output
    image_path: Optional[str] = None  # Local file path for image input (enables multimodal calls)