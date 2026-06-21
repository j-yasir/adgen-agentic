from app.utilities.LLM.schemas import LLMConfig, GenerationRequest
from app.utilities.LLM.ai_service import LLMService

from dotenv import load_dotenv

# 1. Load env vars BEFORE importing other logic
load_dotenv() 

# 1. Configure
config = LLMConfig(
    provider="gemini",
    model_name="gemini-3-flash-preview",
    temperature=0.5
)

# 2. Initialize Service
llm_service = LLMService(config)

# 3. Request
response = llm_service.generate(GenerationRequest(
    system_prompt="You are a sarcastic coding assistant.",
    user_prompt="How do I print hello world in Python?"
))

print(response) 
# Output: "Oh, look at you tackling the big problems. It's print('Hello World'). Groundbreaking."