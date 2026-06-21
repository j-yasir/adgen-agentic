import os
from langchain_huggingface import HuggingFaceEndpoint, ChatHuggingFace

def get_huggingface_llm(model_name: str, temperature: float, **kwargs):
    """
    Constructs a HuggingFace Endpoint wrapped in a Chat Interface.
    
    Mappings:
    - Generic 'max_tokens' -> HF 'max_new_tokens'
    - Generic 'model_name' -> HF 'repo_id'
    """
    # 1. Handle API Token
    api_token = kwargs.get('api_key') or os.getenv("HUGGINGFACEHUB_API_TOKEN")
    if not api_token:
        raise ValueError("HUGGINGFACEHUB_API_TOKEN not found in environment variables or configuration.")

    # 2. Map generic arguments to HF-specific arguments
    # HF Endpoint uses 'max_new_tokens'
    max_new_tokens = kwargs.get('max_tokens', 512) # Default to 512 if not provided

    # 3. Create the Base Endpoint (Text Generation)
    llm = HuggingFaceEndpoint(
        repo_id=model_name,
        huggingfacehub_api_token=api_token,
        temperature=temperature,
        max_new_tokens=max_new_tokens,
        task="text-generation",
        # Some models require these specific flags
        do_sample=True if temperature > 0 else False,
        repetition_penalty=1.1 
    )

    # 4. Wrap in ChatHuggingFace
    # This ensures that when you send a list of messages (System, User), 
    # it is formatted correctly for the model (e.g., applying [INST] tags for Mistral).
    chat_model = ChatHuggingFace(llm=llm)
    
    return chat_model