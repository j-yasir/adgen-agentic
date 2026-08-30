from __future__ import annotations

from agents.base import AgentBuilder
from agents.business_researcher.prompts import PRODUCT_RESEARCH_SYSTEM_PROMPT, RESEARCH_SYSTEM_PROMPT
from utils.LLM.schemas import LLMConfig

# Stage 1 of URL-based business onboarding (see tasks/business_onboarding_runner.py
# for the full two-stage pipeline). web_search only — no scrape_url — per the
# explicit design decision: kie.ai's googleSearch-grounded chat call already
# reads real page content to answer a query, so a dedicated scraper isn't
# needed to read the given site, only a smaller, more targeted tool surface.
business_researcher_agent = AgentBuilder(
    agent_name="business_researcher",
    system_prompt=RESEARCH_SYSTEM_PROMPT,
    tool_names=["web_search"],
    skills=[],
    llm_config=LLMConfig(
        provider="kie",
        model_name="gemini-2.5-flash",
        temperature=0.3,
        max_tokens=8000,
    ),
)

# Stage 1 of URL-based product onboarding (see services/product_service.py
# ::create_from_url) — a separate AgentBuilder instance since the system
# prompt differs (scoped to one product, not a whole business), same tool
# surface and reasoning as business_researcher_agent above. Finding the
# product's actual photo is NOT this agent's job — that's a deterministic,
# non-LLM step (utils/product_image_finder.py) on the product_page_url this
# agent reports.
product_researcher_agent = AgentBuilder(
    agent_name="product_researcher",
    system_prompt=PRODUCT_RESEARCH_SYSTEM_PROMPT,
    tool_names=["web_search"],
    skills=[],
    llm_config=LLMConfig(
        provider="kie",
        model_name="gemini-2.5-flash",
        temperature=0.3,
        max_tokens=6000,
    ),
)
