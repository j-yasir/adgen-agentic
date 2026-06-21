import os
from typing import Optional
from langchain_google_genai import ChatGoogleGenerativeAI

def get_gemini_llm(model_name: str, temperature: float, **kwargs):
    """
    Constructs the Gemini Chat Model.
    
    Mappings:
    - Generic 'max_tokens' -> Gemini 'max_output_tokens'
    """
    # 1. Handle API Key (Config override > Env Var > Error)
    api_key = kwargs.get('api_key') or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not found in environment variables or configuration.")

    # 2. Map generic arguments to Gemini-specific arguments
    # Gemini uses 'max_output_tokens' instead of 'max_tokens'
    max_tokens = kwargs.get('max_tokens')
    
    # 3. Create the instance
    llm = ChatGoogleGenerativeAI(
        model=model_name,
        temperature=temperature,
        google_api_key=api_key,
        max_output_tokens=max_tokens,
        # 'streaming' is handled by the .stream() method in LangChain, 
        # but passing it here hints the model to prepare for it.
        streaming=kwargs.get('streaming', False),
        # Handles conversion of system prompts for older models that don't support them natively
        convert_system_message_to_human=True 
    )
    
    return llm