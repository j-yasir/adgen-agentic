from __future__ import annotations

from agents.base import AgentBuilder
from agents.researcher.prompts import RESEARCHER_SYSTEM_PROMPT
from agents.researcher.skills import deep_competitor_analysis, research_platform_trends
from utils.LLM.schemas import LLMConfig

# NOTE: response_format is NOT used here because kie.ai's OpenAI-compatible
# endpoint treats response_format and function calling (tools) as mutually
# exclusive. LangGraph's create_react_agent needs function calling for the
# ReAct loop, so structured output is handled in the system prompt instead.
# The orchestrator node parses the JSON from the final message.

researcher_agent = AgentBuilder(
    agent_name="researcher",
    system_prompt=RESEARCHER_SYSTEM_PROMPT,
    tool_names=["web_search", "scrape_url", "retrieve_past_campaigns"],
    skills=[deep_competitor_analysis, research_platform_trends],
    llm_config=LLMConfig(
        provider="kie",
        model_name="gemini-2.5-flash",
        temperature=0.3,
        max_tokens=8000,
    ),
)


if __name__ == "__main__":
    import asyncio
    from langchain_core.messages import HumanMessage
    from agents.researcher.prompts import build_input

    test_state = {
        "campaign_id": "test-123",
        "business_id": "biz-456",
        "user_id": "user-789",
        "bko": {
            "identity": {
                "company_name": "Karakoram Kitchen",
                "industry": "Food & Beverage",
                "business_type": "D2C",
                "company_size": "startup",
                "description": "Premium Hunza-sourced organic preserves and dry fruits",
            },
            "audience": {
                "primary": {
                    "demographics": {"age_range": "25-45", "geography": "Pakistan", "gender": "all"},
                    "psychographics": {"values": ["health-conscious", "organic"], "interests": ["cooking", "wellness"]},
                    "pain_points": ["can't find genuine organic products", "distrust mass-produced brands"],
                    "desired_outcomes": ["healthy food for family", "support local producers"],
                },
            },
            "competitive_position": {
                "market_position": "niche",
                "competitors": [
                    {"name": "National Foods", "type": "indirect"},
                    {"name": "Shan Foods", "type": "indirect"},
                ],
                "primary_differentiators": ["Hunza origin", "no preservatives", "handcrafted"],
            },
            "marketing_context": {
                "active_platforms": ["instagram", "facebook"],
                "best_performing_content_types": ["product photography", "origin story"],
                "primary_conversion_goal": "purchase",
            },
        },
        "objective": "awareness",
        "platforms": ["instagram", "facebook"],
        "funnel_stage": "tofu",
        "num_variants": 3,
        "special_brief": "Focus on the Hunza origin story and health benefits",
    }

    async def main():
        print("Starting Researcher Agent standalone test...\n")
        result = await researcher_agent.ainvoke({
            "messages": [HumanMessage(content=build_input(test_state))]
        })
        final_msg = result["messages"][-1]
        print(f"\n{'='*60}")
        print(f"Total messages: {len(result['messages'])}")
        print(f"Final response:\n{final_msg.content[:2000]}")

    asyncio.run(main())
