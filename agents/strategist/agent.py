from __future__ import annotations

from agents.base import AgentBuilder
from utils.LLM.schemas import LLMConfig


def build_planner_agent(system_prompt: str) -> AgentBuilder:
    """Build the Stage-1 distribution planner.

    Built per run because the system prompt is formatted with the campaign's
    num_variants (construction is cheap). The copy skills are NOT tools here —
    the pipeline in graph.py fans out to them in parallel after planning.
    """
    return AgentBuilder(
        agent_name="strategist_planner",
        system_prompt=system_prompt,
        tool_names=["retrieve_past_campaigns"],
        skills=[],
        llm_config=LLMConfig(
            provider="kie",
            model_name="gemini-2.5-flash",
            temperature=0.4,   # planning = structured decisions
            max_tokens=4000,   # the DistributionPlan is deliberately small
        ),
    )


if __name__ == "__main__":
    import asyncio
    import json

    from agents.strategist.graph import strategist_pipeline

    test_research = {
        "competitor_ad_patterns": [
            {
                "competitor_name": "National Foods",
                "positioning": "Mass-market, affordable",
                "weaknesses_to_exploit": ["Perceived as artificial", "Lacks gifting appeal"],
                "hooks_used": [{"hook_text": "Make every breakfast special", "format": "video", "platform": "instagram"}],
            }
        ],
        "platform_insights": [
            {
                "platform": "instagram",
                "ad_specs": [{"format": "reel", "aspect_ratio": "9:16", "max_duration": 60}],
                "trending_formats": ["Reels", "Carousels"],
                "content_themes": ["Authenticity", "Gifting"],
            },
            {
                "platform": "tiktok",
                "ad_specs": [{"format": "video", "aspect_ratio": "9:16", "max_duration": 60}],
                "trending_formats": ["UGC-style demos"],
                "content_themes": ["Authenticity"],
            },
        ],
        "audience_intelligence": {
            "purchase_triggers": ["Limited batch", "Eid deadline"],
            "common_objections": ["Price concern", "Shipping trust"],
        },
        "recommended_angles": [
            {
                "angle_name": "The Storyteller's Gift",
                "target_emotion": "pride",
                "best_platforms": ["instagram", "email"],
                "suggested_formats": ["carousel", "email"],
                "funnel_fit": "mofu",
                "hook_direction": "This Eid, gift a story from the mountains.",
            },
            {
                "angle_name": "The Scarcity Push",
                "target_emotion": "urgency",
                "best_platforms": ["instagram", "tiktok"],
                "suggested_formats": ["reel", "static"],
                "funnel_fit": "mofu",
                "hook_direction": "Only 3 weeks until Eid. Our batch is 80% sold out.",
            },
        ],
        "tone_recommendations": ["Urgent", "Premium", "Warm"],
        "asset_type_insights": {
            "static_image": {"cta_patterns": ["Order for Eid Delivery"]},
            "video_ad": {"hook_timing": "1.5 seconds", "script_structure": "Hook > Story > CTA"},
            "email_template": {"subject_line_patterns": ["Only 50 jars left"]},
        },
    }

    test_state = {
        "campaign_id": "test-strat",
        "business_id": "biz-456",
        "user_id": "user-789",
        "bko": {
            "identity": {
                "company_name": "Karakoram Kitchen",
                "industry": "Food & Beverage",
                "description": "Premium Hunza-sourced organic preserves",
            },
            "brand": {
                "voice": {"primary_tone": "warm", "writing_style": "conversational", "pov": "second_person"},
                "visual_identity": {"primary_colors": ["#D4A574", "#2C1810"], "design_aesthetic": "warm_earthy"},
                "dos": ["Show the real product", "Use warm natural light"],
                "donts": ["Use stock photos", "Make health claims"],
            },
            "audience": {
                "primary": {
                    "demographics": {"age_range": "25-45", "geography": "Pakistan"},
                    "pain_points": ["can't find genuine organic products"],
                }
            },
            "offerings": {
                "conversion_url": "https://karakoramkitchen.pk/shop",
                "products_services": [
                    {"name": "Hunza Apricot Jam", "description": "Wild apricot preserve", "is_hero": True, "unique_selling_points": ["no preservatives", "wild harvested"]},
                    {"name": "Sea Buckthorn Preserve", "description": "Rare GB berry preserve", "unique_selling_points": ["high vitamin C", "rare ingredient"]},
                ],
            },
            "messaging": {
                "primary_value_propositions": ["Handcrafted from wild fruit", "No preservatives"],
                "emotional_hooks": ["Taste the mountains"],
                "forbidden_topics": [],
            },
            "compliance": {"restricted_claims": ["boosts immunity"], "required_ad_disclosures": []},
        },
        "campaign_name": "Eid 2026 — Gifting Push",
        "objective": "conversion",
        "platforms": ["instagram", "tiktok"],
        "asset_types": ["static_image", "video_ad", "email"],
        "funnel_stage": "mofu",
        "num_variants": 4,
        "hero_products": ["Hunza Apricot Jam", "Sea Buckthorn Preserve"],
        "tone_override": "urgent",
        "special_brief": "Eid in 3 weeks. Lead with gifting angle. Push them to buy.",
        "research_report": test_research,
    }

    def print_event(event_type: str, payload: dict) -> None:
        print(f"  [{event_type}] {json.dumps(payload, default=str)[:180]}")

    async def main():
        print("Starting Strategist pipeline standalone test...\n")
        strategy_doc = await strategist_pipeline.ainvoke(test_state, on_event=print_event)
        print(f"\n{'=' * 60}")
        print(f"Theme:  {strategy_doc['campaign_theme']}")
        print(f"Arc:    {strategy_doc['narrative_arc'][:160]}")
        print(f"Assets: {len(strategy_doc['asset_plan'])}")
        for a in strategy_doc["asset_plan"]:
            print(f"  - {a['asset_id']}: {a['asset_type']} on {a['platform']} "
                  f"({a['format']}, {a['funnel_stage']}, {a['role_in_campaign']}) "
                  f"hook={a['hook'][:60]!r}")
        print(f"\nFull doc:\n{json.dumps(strategy_doc, indent=2, default=str)[:4000]}")

    asyncio.run(main())
