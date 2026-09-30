from __future__ import annotations

from langchain_core.tools import tool
from utils.LLM.ai_service import LLMService
from utils.LLM.schemas import LLMConfig, GenerationRequest


@tool
def deep_competitor_analysis(competitor_name: str, industry: str) -> str:
    """Run a comprehensive competitor analysis combining web search and LLM synthesis.

    Searches for the competitor's recent advertising activity, website positioning,
    and market strategy, then synthesizes findings into actionable intelligence.

    Args:
        competitor_name: Name of the competitor to analyze.
        industry: Industry context for the analysis (e.g. "Food & Beverage", "SaaS").
    """
    from tools.web_search import web_search

    search_results = web_search.invoke(
        f"{competitor_name} advertising strategy campaigns {industry} 2026"
    )

    llm = LLMService(LLMConfig(
        provider="kie",
        model_name="gemini-3-6-flash-openai",
        temperature=0.3,
        max_tokens=3000,
    ))
    synthesis = llm.generate(GenerationRequest(
        system_prompt=(
            "You are a competitive intelligence analyst specializing in digital advertising. "
            "Analyze the provided search data and extract actionable competitive intelligence."
        ),
        user_prompt=(
            f"Analyze competitor: {competitor_name} (industry: {industry})\n\n"
            f"Search data:\n{search_results}\n\n"
            f"Extract and structure:\n"
            f"1. Their market positioning and key messaging\n"
            f"2. Ad formats and platforms they use\n"
            f"3. ACTUAL hook text and ad copy examples (not summaries like "
            f"'recipe integration' — write the real hook text they use)\n"
            f"4. For each hook, note the format (reel/carousel/static) and platform\n"
            f"5. Strengths we should acknowledge\n"
            f"6. Weaknesses or gaps we can exploit\n"
            f"7. What makes them different from us\n\n"
            f"Be specific — quote actual ad copy where possible."
        ),
    ))
    return synthesis


@tool
def research_platform_trends(platform: str, industry: str, objective: str) -> str:
    """Research current trends, best practices, and algorithm updates for a specific platform.

    Searches for platform-specific content trends, optimal formats, posting strategies,
    and benchmark metrics relevant to the campaign's industry and objective.

    Args:
        platform: The social media platform (instagram, facebook, tiktok, youtube, linkedin, google).
        industry: The business's industry for context.
        objective: The campaign objective (awareness, traffic, conversion, lead_gen, engagement).
    """
    from tools.web_search import web_search

    search_results = web_search.invoke(
        f"{platform} advertising trends {industry} {objective} best performing "
        f"content formats engagement rates 2026"
    )

    llm = LLMService(LLMConfig(
        provider="kie",
        model_name="gemini-3-6-flash-openai",
        temperature=0.3,
        max_tokens=2000,
    ))
    synthesis = llm.generate(GenerationRequest(
        system_prompt=(
            "You are a social media advertising specialist. Analyze platform trends "
            "and provide actionable insights for campaign planning."
        ),
        user_prompt=(
            f"Platform: {platform}\n"
            f"Industry: {industry}\n"
            f"Campaign objective: {objective}\n\n"
            f"Search data:\n{search_results}\n\n"
            f"Extract and structure:\n"
            f"1. Currently trending content formats on {platform}\n"
            f"2. Best performing ad types for {objective} campaigns\n"
            f"3. Optimal posting times and frequency\n"
            f"4. Benchmark CTR and engagement rates for {industry}\n"
            f"5. Algorithm preferences and content themes that perform well\n"
            f"6. Platform-specific dos and don'ts for ads\n"
            f"7. TECHNICAL AD SPECS for each format:\n"
            f"   - Aspect ratio (9:16, 1:1, 4:5, 16:9)\n"
            f"   - Max video duration in seconds\n"
            f"   - Caption/text character limits\n"
            f"   - Any restrictions (text overlay %, safe zones, etc.)\n\n"
            f"Be specific with numbers and examples where available."
        ),
    ))
    return synthesis
