# AdGen-Agentic — Agent Architecture

> Universal architecture for all four agents: Researcher, Strategist, Producer, Auditor.  
> Every agent is built from the same pattern. Swap the prompt, tools, skills, and output schema — everything else stays identical.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [System Layers](#2-system-layers)
3. [Global Tool Registry](#3-global-tool-registry)
4. [Agent Skills](#4-agent-skills)
5. [Agent Builder (Base Class)](#5-agent-builder-base-class)
6. [Agent Definition Pattern](#6-agent-definition-pattern)
7. [Standalone Execution](#7-standalone-execution)
8. [Orchestrator Integration](#8-orchestrator-integration)
9. [LLM Integration](#9-llm-integration)
10. [Media Generation Integration](#10-media-generation-integration)
11. [Directory Structure](#11-directory-structure)
12. [Data Flow](#12-data-flow)
13. [Agent Specifications](#13-agent-specifications)
14. [Tool Specifications](#14-tool-specifications)
15. [Skill Specifications](#15-skill-specifications)
16. [Configuration & Models](#16-configuration--models)
17. [Error Handling](#17-error-handling)
18. [Implementation Order](#18-implementation-order)

---

## 1. Design Principles

| # | Principle | Implication |
|---|---|---|
| 1 | **All LLM calls go through `utils/LLM`** | No agent imports `ChatGoogleGenerativeAI` or any provider directly. `AgentBuilder` calls `get_llm_model()` from the factory. Tools/skills that need sub-LLM calls instantiate `LLMService`. |
| 2 | **All media generation goes through `utils/MediaGen`** | The `generate_image` tool is a thin `@tool` wrapper around `MediaGenService`. Agents never import media providers directly. |
| 3 | **Tools are global, skills are per-agent** | Tools live in `tools/`, are registered in `TOOL_REGISTRY`, and any agent can pick them by name. Skills live in `agents/*/skills.py` and are passed alongside tools. Both appear as `@tool` functions to the LLM — it can't tell the difference. |
| 4 | **Every agent runs standalone** | `python -m agents.researcher.agent` runs the researcher in isolation with test input. Same `.ainvoke()` interface whether called from the orchestrator or from `__main__`. |
| 5 | **Structured output via `response_format`** | Each agent declares a Pydantic model as its output schema. `create_react_agent` enforces this on the final response — no fragile JSON parsing from free text. |
| 6 | **Agents don't touch the DB** | Agents return data. The orchestrator nodes persist it. Clean separation between reasoning and side effects. |
| 7 | **Orchestrator is tool-agnostic** | The orchestrator calls `.ainvoke()` and reads a fixed key from the result. Whether an agent uses 1 tool or 10 doesn't affect the orchestrator. |

---

## 2. System Layers

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATOR LAYER                                  │
│  orchestrator/nodes.py  →  calls  agent.ainvoke(CampaignState)         │
│  Owns: DB writes, SSE events, state transitions                        │
│  Does NOT own: LLM calls, tool execution, reasoning                    │
└────────────────────────┬────────────────────────────────────────────────┘
                         │
                         │  .ainvoke(input) → {"research_report": {...}}
                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       AGENT LAYER                                       │
│  agents/*/agent.py  →  AgentBuilder instance                           │
│  Owns: system prompt, tool selection, skill selection, output schema    │
│  Uses: create_react_agent (LangGraph ReAct loop)                       │
└────────────┬──────────────────────────┬─────────────────────────────────┘
             │                          │
             │  LLM backbone            │  Tool calls during ReAct loop
             ▼                          ▼
┌────────────────────────┐  ┌─────────────────────────────────────────────┐
│     utils/LLM          │  │              TOOL + SKILL LAYER             │
│  LLMConfig             │  │                                             │
│  → get_llm_model()     │  │  tools/*.py        → global @tool functions │
│  → BaseChatModel       │  │  agents/*/skills.py → agent-specific @tool  │
│                        │  │                                             │
│  LLMService            │  │  Tools call into:                           │
│  → .generate()         │  │    • utils/LLM (sub-LLM calls)             │
│  (used inside tools)   │  │    • utils/MediaGen (image/video/audio)     │
└────────────────────────┘  │    • DB repos (read-only queries)           │
                            │    • External APIs (Firecrawl, Tavily)      │
                            └─────────────────────────────────────────────┘
```

---

## 3. Global Tool Registry

### Purpose

Tools are **atomic, reusable capabilities** available to any agent. Each tool is a `@tool`-decorated function in `tools/`. The registry maps string names to tool functions so agents can pick tools by name.

### Registry (`tools/__init__.py`)

```python
from tools.web_search import web_search
from tools.scrape_url import scrape_url
from tools.analyze_competitor import analyze_competitor
from tools.retrieve_past_campaigns import retrieve_past_campaigns
from tools.generate_image import generate_image
from tools.generate_video import generate_video
from tools.generate_audio import generate_audio
from tools.save_asset import save_asset

TOOL_REGISTRY: dict[str, Callable] = {
    # ── Research ──────────────────────────────────────────
    "web_search":               web_search,
    "scrape_url":               scrape_url,
    "analyze_competitor":       analyze_competitor,
    "retrieve_past_campaigns":  retrieve_past_campaigns,
    # ── Media Generation (wraps utils/MediaGen) ──────────
    "generate_image":           generate_image,
    "generate_video":           generate_video,
    "generate_audio":           generate_audio,
    # ── Storage ──────────────────────────────────────────
    "save_asset":               save_asset,
}


def get_tools(names: list[str]) -> list:
    """Select specific tools by name for a given agent."""
    missing = set(names) - set(TOOL_REGISTRY)
    if missing:
        raise ValueError(f"Unknown tools: {missing}")
    return [TOOL_REGISTRY[n] for n in names]
```

### Tool Anatomy

Every tool follows the same pattern:

```python
# tools/web_search.py

from langchain_core.tools import tool

@tool
def web_search(query: str) -> str:
    """Search the web for current information about a topic.
    
    Args:
        query: The search query string.
    
    Returns:
        Search results as formatted text.
    """
    # Implementation using Tavily, SerpAPI, or Google Search
    ...
```

### Rules

1. **One tool per file** — keeps imports clean
2. **Tools are stateless** — no instance variables, no `self`
3. **Tools return strings** — the LLM reads the return value as text in the ReAct loop
4. **Tools that need an LLM** import `LLMService` from `utils/LLM`, never a raw provider
5. **Tools that need media gen** import `MediaGenService` from `utils/MediaGen`
6. **Tools never write to the campaign DB** — they return data; the orchestrator persists it
7. **Tools can read from DB** (e.g. `retrieve_past_campaigns` queries pgvector) — reads are safe

### Tool ↔ Agent Matrix

| Tool | Researcher | Strategist | Producer | Auditor |
|---|:---:|:---:|:---:|:---:|
| `web_search` | ✅ | — | — | — |
| `scrape_url` | ✅ | — | — | — |
| `analyze_competitor` | ✅ | — | — | — |
| `retrieve_past_campaigns` | ✅ | ✅ | — | — |
| `generate_image` | — | — | ✅ | — |
| `generate_video` | — | — | ✅ | — |
| `generate_audio` | — | — | ✅ | — |
| `save_asset` | — | — | ✅ | — |

---

## 4. Agent Skills

### What is a Skill?

A **skill** is a `@tool`-decorated function that lives in `agents/*/skills.py`. Unlike global tools, skills are:

- **Agent-specific** — only the owning agent uses them
- **Multi-step** — they compose global tools + LLM sub-calls into a higher-level workflow
- **Domain-aware** — they encode agent-specific logic that doesn't belong in a generic tool

To the LLM, skills and tools are identical — both appear as callable functions in the ReAct tool list. The separation is organizational, not technical.

### Skill Anatomy

```python
# agents/researcher/skills.py

from langchain_core.tools import tool
from utils.LLM.ai_service import LLMService
from utils.LLM.schemas import LLMConfig, GenerationRequest
from tools.web_search import web_search
from tools.scrape_url import scrape_url


@tool
def deep_competitor_analysis(competitor_name: str, industry: str) -> str:
    """Run a comprehensive competitor analysis combining web search,
    website scraping, and LLM synthesis.
    
    Args:
        competitor_name: Name of the competitor to analyze.
        industry: Industry context for the analysis.
    
    Returns:
        Structured competitor analysis as text.
    """
    # Step 1: Search for recent competitor activity
    search_results = web_search.invoke(f"{competitor_name} ads {industry} 2026")
    
    # Step 2: Scrape their website if possible
    website_data = scrape_url.invoke(f"https://{competitor_name.lower().replace(' ', '')}.com")
    
    # Step 3: Use LLMService to synthesize findings
    llm = LLMService(LLMConfig(provider="gemini", model_name="gemini-2.0-flash"))
    synthesis = llm.generate(GenerationRequest(
        system_prompt="You are a competitive intelligence analyst.",
        user_prompt=(
            f"Synthesize these findings about {competitor_name}:\n\n"
            f"Web search:\n{search_results}\n\n"
            f"Website:\n{website_data}\n\n"
            f"Produce: positioning, strengths, weaknesses, ad patterns, "
            f"and opportunities we can exploit."
        ),
    ))
    return synthesis
```

### Skills Per Agent

| Agent | Skills | What They Do |
|---|---|---|
| **Researcher** | `deep_competitor_analysis` | Composes web_search + scrape_url + LLM synthesis for a thorough competitor deep-dive |
| **Researcher** | `research_platform_trends` | Searches platform-specific trends, synthesizes into actionable insights per platform |
| **Strategist** | `generate_strategy_section` | Generates one section of the strategy doc with self-critique built in |
| **Strategist** | `evaluate_hook_strength` | Tests a proposed hook against audience psychology and platform norms |
| **Producer** | `compose_ad_copy` | Writes headline + body + CTA as a unit, ensuring internal consistency |
| **Producer** | `build_image_prompt` | Translates visual_brief + brand identity into a generation-ready prompt |
| **Auditor** | `score_asset` | Multi-criteria scoring with rubric — one LLM call scores all dimensions |
| **Auditor** | `check_compliance` | Verifies asset against BKO compliance rules and required disclaimers |

---

## 5. Agent Builder (Base Class)

### Purpose

`agents/base.py` is the **universal factory** that constructs any agent. Every agent in the system is an `AgentBuilder` instance with different parameters. This enforces architectural consistency — no agent can bypass the LLM factory, use tools without registration, or skip structured output.

### Interface

```python
# agents/base.py

from __future__ import annotations

from typing import Any, Type
from pydantic import BaseModel
from langgraph.prebuilt import create_react_agent
from utils.LLM.factory import get_llm_model
from utils.LLM.schemas import LLMConfig
from tools import get_tools
from utils.logger import get_logger

logger = get_logger(__name__)


class AgentBuilder:
    """
    Universal agent factory.
    
    Every agent in the system is built through this class:
        agent = AgentBuilder(
            agent_name    = "researcher",
            system_prompt = RESEARCHER_SYSTEM_PROMPT,
            tool_names    = ["web_search", "scrape_url"],
            skills        = [deep_competitor_analysis],
            response_format = ResearchReport,
            llm_config    = LLMConfig(provider="gemini", ...),
        )
    
    The resulting object has .ainvoke() and .invoke() methods that
    the orchestrator (or standalone scripts) call.
    """

    def __init__(
        self,
        agent_name: str,
        system_prompt: str,
        tool_names: list[str]              = None,
        skills: list                       = None,
        response_format: Type[BaseModel]   = None,
        llm_config: LLMConfig              = None,
    ):
        self.agent_name = agent_name

        # ── LLM — always from utils/LLM factory ─────────────────────
        config = llm_config or LLMConfig(
            provider="gemini",
            model_name="gemini-2.0-flash",
            temperature=0.3,
            max_tokens=8000,
        )
        self.llm = get_llm_model(config)

        # ── Tools = global tools + agent-specific skills ─────────────
        global_tools = get_tools(tool_names or [])
        self.tools = global_tools + (skills or [])

        # ── Build the ReAct agent ────────────────────────────────────
        self.agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            prompt=system_prompt,
            response_format=response_format,
        )

        logger.info(
            "Built agent '%s' with %d tools (%d global + %d skills)",
            agent_name,
            len(self.tools),
            len(global_tools),
            len(skills or []),
        )

    async def ainvoke(self, input: dict[str, Any], **kwargs) -> dict[str, Any]:
        """Async invocation — used by the orchestrator."""
        return await self.agent.ainvoke(input, **kwargs)

    def invoke(self, input: dict[str, Any], **kwargs) -> dict[str, Any]:
        """Sync invocation — useful for testing and scripts."""
        return self.agent.invoke(input, **kwargs)
```

### What AgentBuilder Enforces

| Guarantee | How |
|---|---|
| LLM always from factory | `get_llm_model(config)` — no direct provider imports |
| Tools must be registered | `get_tools(names)` raises if a name is unknown |
| Structured output | `response_format` param passed to `create_react_agent` |
| Consistent interface | Every agent exposes `.ainvoke()` and `.invoke()` |
| Observable | Logs tool count and names on construction |

---

## 6. Agent Definition Pattern

Every agent follows the exact same file structure and instantiation pattern.

### File Structure Per Agent

```
agents/{agent_name}/
├── agent.py       # AgentBuilder instance + standalone runner
├── prompts.py     # SYSTEM_PROMPT constant + build_input() helper
├── schemas.py     # Pydantic output model (response_format)
├── skills.py      # Agent-specific @tool functions
├── state.py       # Internal TypedDict (for future sub-graph expansion)
└── nodes.py       # Reserved for future sub-graph nodes
```

### `agent.py` Pattern

```python
# agents/researcher/agent.py

from agents.base import AgentBuilder
from agents.researcher.prompts import RESEARCHER_SYSTEM_PROMPT
from agents.researcher.schemas import ResearchReport
from agents.researcher.skills import deep_competitor_analysis, research_platform_trends

# ── Agent instance (imported by orchestrator/nodes.py) ────────────────
researcher_agent = AgentBuilder(
    agent_name="researcher",
    system_prompt=RESEARCHER_SYSTEM_PROMPT,
    tool_names=["web_search", "scrape_url", "retrieve_past_campaigns"],
    skills=[deep_competitor_analysis, research_platform_trends],
    response_format=ResearchReport,
)
```

### `prompts.py` Pattern

```python
# agents/researcher/prompts.py

from orchestrator.state import CampaignState

RESEARCHER_SYSTEM_PROMPT = """You are the Researcher Agent in an autonomous 
ad generation pipeline. Your job is to gather campaign-specific intelligence...

You have access to the following tools:
- web_search: Search for current information
- scrape_url: Scrape a website URL  
- retrieve_past_campaigns: Find similar past campaigns
- deep_competitor_analysis: Run a thorough competitor analysis
- research_platform_trends: Research platform-specific trends

...detailed instructions..."""


def build_input(state: CampaignState) -> str:
    """Build the HumanMessage content from orchestrator state."""
    return (
        f"Research a campaign for the following business.\n\n"
        f"BKO:\n{state['bko']}\n\n"
        f"Objective: {state['objective']}\n"
        f"Platforms: {', '.join(state['platforms'])}\n"
        f"Funnel stage: {state['funnel_stage']}\n"
        f"Special brief: {state.get('special_brief') or 'none'}\n"
    )
```

### `schemas.py` Pattern

```python
# agents/researcher/schemas.py

from pydantic import BaseModel, Field


class CompetitorPattern(BaseModel):
    competitor_name: str
    ad_formats: list[str]
    hooks_used: list[str]
    positioning: str
    weaknesses_to_exploit: list[str]


class PlatformInsight(BaseModel):
    platform: str
    trending_formats: list[str]
    optimal_posting_times: str
    benchmark_ctr: float | None = None
    content_themes: list[str]


class ResearchReport(BaseModel):
    """Structured output from the Researcher agent."""
    competitor_ad_patterns: list[CompetitorPattern] = Field(
        description="Analysis of competitor advertising patterns"
    )
    platform_insights: list[PlatformInsight] = Field(
        description="Platform-specific trends and benchmarks"
    )
    audience_insights: list[str] = Field(
        description="Current behavioral trends for the target audience"
    )
    seasonal_context: list[str] = Field(
        description="Upcoming events, holidays, or cultural moments"
    )
    recommended_angles: list[str] = Field(
        description="3-5 suggested campaign angles with rationale"
    )
    tone_recommendations: list[str] = Field(
        description="Recommended tones based on audience and platform"
    )
    sources: list[str] = Field(
        default_factory=list,
        description="URLs or sources consulted"
    )
```

---

## 7. Standalone Execution

Every agent can run independently for testing, debugging, or isolated development. The `if __name__ == "__main__"` block in each `agent.py` provides this capability.

### Pattern

```python
# agents/researcher/agent.py  (bottom of file)

if __name__ == "__main__":
    import asyncio
    from agents.researcher.prompts import build_input

    test_state = {
        "bko": {
            "identity": {
                "company_name": "Karakoram Kitchen",
                "industry": "Food & Beverage",
                "description": "Premium Hunza-sourced organic preserves",
            },
            "audience": {
                "primary": {
                    "demographics": {"age_range": "25-45", "geography": "Pakistan"},
                    "pain_points": ["can't find organic preserves", "distrust mass brands"],
                }
            },
            "competitive_position": {
                "competitors": [
                    {"name": "National Foods", "type": "indirect"},
                    {"name": "Shan Foods", "type": "indirect"},
                ]
            },
        },
        "objective": "awareness",
        "platforms": ["instagram", "facebook"],
        "funnel_stage": "tofu",
        "special_brief": "Focus on the Hunza origin story",
    }

    async def main():
        from langchain_core.messages import HumanMessage

        result = await researcher_agent.ainvoke({
            "messages": [HumanMessage(content=build_input(test_state))]
        })
        print(result)

    asyncio.run(main())
```

### Usage

```bash
# Run researcher in isolation
python -m agents.researcher.agent

# Run strategist in isolation
python -m agents.strategist.agent

# Run producer in isolation
python -m agents.producer.agent

# Run auditor in isolation
python -m agents.auditor.agent
```

### Why This Matters

1. **Develop agents in parallel** — different team members (or sessions) can work on different agents without needing the full orchestrator
2. **Debug tool chains** — if a tool misbehaves, test it through the agent directly instead of running the whole pipeline
3. **Prompt iteration** — adjust system prompts and re-run instantly without creating campaigns or hitting HITL checkpoints
4. **Output validation** — verify the structured output schema works before plugging into the orchestrator

---

## 8. Orchestrator Integration

### How the Orchestrator Calls Agents

Each orchestrator node in `orchestrator/nodes.py` follows the same pattern:

```python
async def run_researcher(state: CampaignState) -> dict:
    db = _db()
    try:
        _emit(db, state["campaign_id"], "agent_started", "researcher",
              {"message": "Researcher agent starting"})

        # ── Call the agent ────────────────────────────────────────────
        result = await researcher_agent.ainvoke(dict(state))
        research_report = result.get("research_report")

        _emit(db, state["campaign_id"], "agent_completed", "researcher",
              {"message": "Research complete"})

        return {"research_report": research_report}
    except Exception as exc:
        _emit(db, state["campaign_id"], "agent_error", "researcher",
              {"error": str(exc)})
        return {"error": str(exc)}
    finally:
        db.close()
```

### The Contract

| Aspect | Contract |
|---|---|
| **Input** | `agent.ainvoke(dict(state))` — full `CampaignState` as a plain dict |
| **Output** | Dict with a single key matching the agent's domain: `{"research_report": {...}}`, `{"strategy_doc": {...}}`, `{"generated_assets": [...]}`, `{"audit_results": [...]}` |
| **Error** | Returns `{"error": "message"}` — orchestrator checks this and routes to `campaign_failed` |
| **Side effects** | None — the agent returns data, the orchestrator node persists it |

### Swapping Stub → Real Agent

One import change per agent:

```python
# Before (stub):
from agents.researcher.graph import researcher_agent

# After (real):
from agents.researcher.agent import researcher_agent
```

Same `.ainvoke()` interface. Same return shape. Zero orchestrator changes.

---

## 9. LLM Integration

### Two Usage Patterns

**Pattern 1 — Agent backbone (via AgentBuilder)**

The LLM that powers the ReAct reasoning loop. This is set once when the agent is constructed and drives all tool selection, reasoning, and final response generation.

```python
# Inside AgentBuilder.__init__():
self.llm = get_llm_model(config)   # utils/LLM/factory.py
self.agent = create_react_agent(model=self.llm, ...)
```

**Pattern 2 — Sub-calls inside tools/skills (via LLMService)**

When a tool or skill needs to make its own LLM call (e.g., to synthesize search results, write ad copy, or score an asset), it instantiates `LLMService` directly:

```python
# Inside a tool or skill:
from utils.LLM.ai_service import LLMService
from utils.LLM.schemas import LLMConfig, GenerationRequest

llm = LLMService(LLMConfig(
    provider="gemini",
    model_name="gemini-2.0-flash-lite",  # lighter model for sub-tasks
    temperature=0.3,
    max_tokens=2000,
))
result = llm.generate(GenerationRequest(
    system_prompt="You are a copywriter...",
    user_prompt="Write a headline for...",
    output_schema=HeadlineSchema,        # optional structured output
))
```

### Model Selection Guidelines

| Task | Model | Reasoning |
|---|---|---|
| Agent backbone (reasoning + tool selection) | `gemini-2.0-flash` | Fast enough for ReAct loops, smart enough for multi-step reasoning |
| Complex synthesis (competitor analysis, strategy generation) | `gemini-2.0-flash` | Needs full reasoning capability |
| Light tasks (validation, short extraction, scoring) | `gemini-2.0-flash-lite` | Cheap, fast, good enough for structured tasks |
| Vision/multimodal scoring | `gemini-2.0-flash` | Supports image input for visual asset scoring |

### Key Rule

> **No agent, tool, or skill ever imports a provider directly.**
> 
> ❌ `from langchain_google_genai import ChatGoogleGenerativeAI`  
> ✅ `from utils.LLM.factory import get_llm_model`  
> ✅ `from utils.LLM.ai_service import LLMService`

---

## 10. Media Generation Integration

### How Tools Wrap MediaGen

```python
# tools/generate_image.py

from langchain_core.tools import tool
from utils.MediaGen import MediaGenService, MediaGenConfig, ImageRequest


@tool
def generate_image(
    prompt: str,
    output_path: str,
    width: int = 1024,
    height: int = 1024,
    aspect_ratio: str | None = None,
) -> str:
    """Generate an image from a text prompt using the configured image generation model.
    
    Args:
        prompt: Detailed description of the image to generate.
        output_path: Where to save the generated image.
        width: Image width in pixels.
        height: Image height in pixels.
        aspect_ratio: Optional aspect ratio (e.g. "1:1", "9:16").
    
    Returns:
        Path to the saved image file, or error message.
    """
    service = MediaGenService(MediaGenConfig(
        provider="seedream",
        model_name="seedream-5-0-260128",
    ))
    result = service.generate(ImageRequest(
        prompt=prompt,
        output_path=output_path,
        width=width,
        height=height,
        aspect_ratio=aspect_ratio,
    ))
    if result.success:
        return f"Image saved to {result.output_path}"
    return f"Image generation failed: {result.error}"
```

### Same pattern for video and audio:

```python
# tools/generate_video.py  → wraps MediaGenService with VideoRequest
# tools/generate_audio.py  → wraps MediaGenService with AudioRequest
```

### Key Rule

> **No agent or skill ever imports a media provider directly.**
>
> ❌ `from utils.MediaGen.providers.seedream import SeedreamProvider`  
> ✅ `from utils.MediaGen import MediaGenService, MediaGenConfig, ImageRequest`

---

## 11. Directory Structure

```
agents/
├── base.py                         # AgentBuilder — universal factory
│
├── researcher/
│   ├── agent.py                    # researcher_agent = AgentBuilder(...)
│   ├── prompts.py                  # RESEARCHER_SYSTEM_PROMPT + build_input()
│   ├── schemas.py                  # ResearchReport (response_format)
│   ├── skills.py                   # deep_competitor_analysis, research_platform_trends
│   ├── state.py                    # ResearcherState (future sub-graph expansion)
│   └── nodes.py                    # Reserved (future sub-graph nodes)
│
├── strategist/
│   ├── agent.py                    # strategist_agent = AgentBuilder(...)
│   ├── prompts.py                  # STRATEGIST_SYSTEM_PROMPT + build_input()
│   ├── schemas.py                  # StrategyDoc (response_format)
│   ├── skills.py                   # generate_strategy_section, evaluate_hook_strength
│   ├── state.py
│   └── nodes.py
│
├── producer/
│   ├── agent.py                    # producer_agent = AgentBuilder(...)
│   ├── prompts.py                  # PRODUCER_SYSTEM_PROMPT + build_input()
│   ├── schemas.py                  # ProducerOutput (response_format)
│   ├── skills.py                   # compose_ad_copy, build_image_prompt
│   ├── state.py
│   └── nodes.py
│
└── auditor/
    ├── agent.py                    # auditor_agent = AgentBuilder(...)
    ├── prompts.py                  # AUDITOR_SYSTEM_PROMPT + build_input()
    ├── schemas.py                  # AuditResults (response_format)
    ├── skills.py                   # score_asset, check_compliance
    ├── state.py
    └── nodes.py


tools/
├── __init__.py                     # TOOL_REGISTRY + get_tools()
├── web_search.py                   # @tool — web search (Tavily/Google)
├── scrape_url.py                   # @tool — website scraping (Firecrawl)
├── analyze_competitor.py           # @tool — targeted competitor lookup
├── retrieve_past_campaigns.py      # @tool — pgvector semantic retrieval
├── generate_image.py               # @tool — wraps utils/MediaGen (image)
├── generate_video.py               # @tool — wraps utils/MediaGen (video)
├── generate_audio.py               # @tool — wraps utils/MediaGen (audio)
├── save_asset.py                   # @tool — wraps utils/storage
│
│  # Raw API clients (NOT @tool decorated — used by tools internally)
├── firecrawl.py                    # Firecrawl client
├── gemini.py                       # Gemini client (legacy, pre-utils/LLM)
├── imagen.py                       # Imagen client (legacy)
├── elevenlabs.py                   # ElevenLabs client
├── veo.py                          # Veo client
└── r2.py                           # R2 upload client
```

---

## 12. Data Flow

### Full Pipeline Data Flow

```
                           CampaignState
                               │
                    ┌──────────▼──────────┐
                    │      load_bko       │
                    │  Reads: business_id │
                    │  Writes: bko, etc.  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │   run_researcher    │
                    │                     │
                    │  agent.ainvoke()    │
                    │    ├─ web_search    │
                    │    ├─ scrape_url    │
                    │    └─ deep_comp..  │
                    │                     │
                    │  Writes:            │
                    │    research_report  │
                    └──────────┬──────────┘
                               │
                        [HITL: research_review]
                               │
                    ┌──────────▼──────────┐
                    │   run_strategist    │
                    │                     │
                    │  agent.ainvoke()    │
                    │    ├─ retrieve_past │
                    │    ├─ gen_section   │
                    │    └─ eval_hook     │
                    │                     │
                    │  Reads:             │
                    │    research_report  │
                    │  Writes:            │
                    │    strategy_doc     │
                    └──────────┬──────────┘
                               │
                        [HITL: plan_approval]
                               │
                    ┌──────────▼──────────┐
                    │    run_producer     │
                    │                     │
                    │  agent.ainvoke()    │
                    │    ├─ compose_copy  │
                    │    ├─ gen_image     │
                    │    ├─ gen_video     │
                    │    └─ save_asset    │
                    │                     │
                    │  Reads:             │
                    │    strategy_doc     │
                    │    audit_results    │
                    │    (if retry)       │
                    │  Writes:            │
                    │    generated_assets │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     run_auditor     │
                    │                     │
                    │  agent.ainvoke()    │
                    │    ├─ score_asset   │
                    │    └─ check_compl   │
                    │                     │
                    │  Reads:             │
                    │    generated_assets │
                    │    strategy_doc     │
                    │  Writes:            │
                    │    audit_results    │
                    │    assets_approved  │
                    │    assets_rejected  │
                    └──────────┬──────────┘
                               │
                        [route_after_audit]
                        ┌──────┴──────┐
                  rejected &       all approved
                  retry < 2        or exhausted
                        │              │
                   run_producer   [HITL: asset_review]
                                       │
                                 campaign_done
```

### Per-Agent I/O

| Agent | Reads from State | Writes to State | Tools Used | Skills Used |
|---|---|---|---|---|
| **Researcher** | `bko`, `objective`, `platforms`, `funnel_stage`, `special_brief` | `research_report` | `web_search`, `scrape_url`, `retrieve_past_campaigns` | `deep_competitor_analysis`, `research_platform_trends` |
| **Strategist** | `bko`, `research_report`, `objective`, `platforms`, `funnel_stage`, `num_variants`, `special_brief` | `strategy_doc` | `retrieve_past_campaigns` | `generate_strategy_section`, `evaluate_hook_strength` |
| **Producer** | `bko`, `strategy_doc`, `platforms`, `num_variants`, `audit_results` (if retry) | `generated_assets` | `generate_image`, `generate_video`, `generate_audio`, `save_asset` | `compose_ad_copy`, `build_image_prompt` |
| **Auditor** | `bko`, `strategy_doc`, `generated_assets` | `audit_results`, `assets_approved`, `assets_rejected` | — | `score_asset`, `check_compliance` |

---

## 13. Agent Specifications

### 13.1 Researcher Agent

**Responsibility:** Gather campaign-specific external intelligence that is NOT already in the BKO. The BKO describes the business. The Research Report describes the current landscape for this specific campaign.

**Model:** `gemini-2.0-flash` (temperature: 0.3)

**Global Tools:** `web_search`, `scrape_url`, `retrieve_past_campaigns`

**Skills:** `deep_competitor_analysis`, `research_platform_trends`

**Output Schema:** `ResearchReport`

```python
class ResearchReport(BaseModel):
    competitor_ad_patterns: list[CompetitorPattern]
    platform_insights:      list[PlatformInsight]
    audience_insights:      list[str]
    seasonal_context:       list[str]
    recommended_angles:     list[str]
    tone_recommendations:   list[str]
    sources:                list[str]
```

**ReAct Flow:**
1. Read BKO competitors → call `deep_competitor_analysis` for each
2. Call `research_platform_trends` for each target platform
3. Call `web_search` for seasonal/cultural context
4. Call `retrieve_past_campaigns` for learnings from this business's history
5. Synthesize into `ResearchReport`

---

### 13.2 Strategist Agent

**Responsibility:** Consume BKO + Research Report and produce a complete campaign plan. After Strategist runs, no creative decisions remain — Producer just executes.

**Model:** `gemini-2.0-flash` (temperature: 0.5)

**Global Tools:** `retrieve_past_campaigns`

**Skills:** `generate_strategy_section`, `evaluate_hook_strength`

**Output Schema:** `StrategyDoc`

```python
class AssetPlan(BaseModel):
    asset_id:       str
    platform:       str
    format:         str
    funnel_stage:   str
    hook:           str
    angle:          str
    key_message:    str
    cta:            str
    visual_brief:   str
    copy_notes:     str

class StrategyDoc(BaseModel):
    campaign_theme:       str
    target_emotion:       str
    funnel_distribution:  dict
    asset_plan:           list[AssetPlan]
    platform_notes:       dict
    key_messages:         list[str]
    what_to_avoid:        list[str]
```

---

### 13.3 Producer Agent

**Responsibility:** Execute the `strategy_doc.asset_plan` — generate all assets, save them, and return the asset list.

**Model:** `gemini-2.0-flash` (temperature: 0.4)

**Global Tools:** `generate_image`, `generate_video`, `generate_audio`, `save_asset`

**Skills:** `compose_ad_copy`, `build_image_prompt`

**Output Schema:** `ProducerOutput`

```python
class GeneratedAsset(BaseModel):
    asset_id:           str
    platform:           str
    format:             str
    headline:           str
    body_copy:          str
    cta:                str
    visual_description: str
    storage_url:        str | None

class ProducerOutput(BaseModel):
    generated_assets: list[GeneratedAsset]
```

---

### 13.4 Auditor Agent

**Responsibility:** Score every asset on multiple dimensions, produce per-asset critique, and classify assets as approved/rejected.

**Model:** `gemini-2.0-flash` (temperature: 0.1 — low creativity, high consistency)

**Global Tools:** None (auditor doesn't need external tools)

**Skills:** `score_asset`, `check_compliance`

**Output Schema:** `AuditResults`

```python
class AssetScore(BaseModel):
    asset_id:        str
    relevance:       float
    clarity:         float
    brand_alignment: float
    cta_strength:    float
    creative_quality: float
    weighted_avg:    float
    passed:          bool
    feedback:        str

class AuditResults(BaseModel):
    audit_results:   list[AssetScore]
    assets_approved: list[str]
    assets_rejected: list[str]
```

---

## 14. Tool Specifications

### 14.1 `web_search`

```
Input:  query (str)
Output: Formatted search results (str)
Uses:   Tavily API / Google Search API
```
Searches the web for current information. Returns top results with titles, snippets, and URLs. Used by the Researcher to find competitor ads, industry trends, and seasonal context.

---

### 14.2 `scrape_url`

```
Input:  url (str)
Output: Extracted page content (str)
Uses:   Firecrawl API (JS-rendered scraping)
```
Scrapes a web page and returns clean text content. Handles JavaScript-rendered pages via Firecrawl. Used to analyze competitor websites and landing pages.

---

### 14.3 `analyze_competitor`

```
Input:  competitor_name (str), context (str)
Output: Structured competitor summary (str)
Uses:   web_search internally + LLMService for synthesis
```
Searches for a competitor's recent activity and synthesizes findings. Returns positioning, strengths, weaknesses, and ad patterns.

---

### 14.4 `retrieve_past_campaigns`

```
Input:  business_id (str), objective (str), top_k (int, default 3)
Output: Similar past campaigns with outcomes (str)
Uses:   pgvector cosine similarity query
```
Queries the `business_embeddings` table for past campaigns most similar to the current objective. Returns top hooks, scores, and what worked/didn't work.

---

### 14.5 `generate_image`

```
Input:  prompt (str), output_path (str), width (int), height (int), aspect_ratio (str)
Output: Saved file path or error (str)
Uses:   utils/MediaGen → MediaGenService (configured provider)
```

---

### 14.6 `generate_video`

```
Input:  prompt (str), output_path (str), duration (float), width (int), height (int)
Output: Saved file path or error (str)
Uses:   utils/MediaGen → MediaGenService (configured provider)
```

---

### 14.7 `generate_audio`

```
Input:  prompt (str), output_path (str), duration (float), voice (str)
Output: Saved file path or error (str)
Uses:   utils/MediaGen → MediaGenService (configured provider)
```

---

### 14.8 `save_asset`

```
Input:  campaign_id (str), asset_id (str), asset_type (str), data (bytes)
Output: storage_url (str)
Uses:   utils/storage.save_asset()
```
Saves generated asset data to local storage. Returns the relative path. When R2 arrives, only this tool's implementation changes.

---

## 15. Skill Specifications

### Researcher Skills

**`deep_competitor_analysis(competitor_name, industry)`**
- Step 1: `web_search` for recent competitor activity and ads
- Step 2: `scrape_url` on competitor's website (best-effort)
- Step 3: `LLMService` synthesizes findings into: positioning, strengths, weaknesses, ad patterns, exploitable gaps
- Returns: Structured text analysis

**`research_platform_trends(platform, industry, objective)`**
- Step 1: `web_search` for platform-specific trends and algorithm changes
- Step 2: `web_search` for best-performing content formats on that platform
- Step 3: `LLMService` synthesizes into: trending formats, optimal posting times, benchmark metrics, content themes
- Returns: Platform-specific insight text

### Strategist Skills

**`generate_strategy_section(section_name, context)`**
- Uses `LLMService` to generate one section of the strategy document
- Includes built-in self-critique: generates → scores → revises if score < 7
- Returns: Strategy section JSON

**`evaluate_hook_strength(hook, audience_profile, platform)`**
- Uses `LLMService` to score a proposed hook on: attention capture, emotional resonance, platform fit
- Returns: Score (1-10) + improvement suggestions

### Producer Skills

**`compose_ad_copy(hook, angle, key_message, cta, tone, platform)`**
- Uses `LLMService` to write headline + body + CTA as a cohesive unit
- Ensures copy length matches platform norms
- Returns: Formatted ad copy text

**`build_image_prompt(visual_brief, brand_identity, platform, format)`**
- Uses `LLMService` to translate high-level visual brief into a generation-ready prompt
- Incorporates brand colors, imagery style, design aesthetic from BKO
- Returns: Detailed image generation prompt

### Auditor Skills

**`score_asset(asset, strategy_doc, bko)`**
- Uses `LLMService` with the full scoring rubric
- Scores on 5 dimensions: relevance, clarity, brand_alignment, cta_strength, creative_quality
- Computes weighted average
- Returns: JSON score breakdown + pass/fail + feedback

**`check_compliance(asset, bko_compliance)`**
- Uses `LLMService` to verify asset against:
  - BKO compliance rules (`industry_regulations`, `restricted_claims`)
  - Required disclaimers (`required_ad_disclosures`)
  - Brand don'ts (`brand.donts`)
- Returns: Pass/fail + list of violations if any

---

## 16. Configuration & Models

### Default LLM Configs Per Agent

```python
AGENT_CONFIGS = {
    "researcher": LLMConfig(
        provider="gemini",
        model_name="gemini-2.0-flash",
        temperature=0.3,
        max_tokens=8000,
    ),
    "strategist": LLMConfig(
        provider="gemini",
        model_name="gemini-2.0-flash",
        temperature=0.5,
        max_tokens=8000,
    ),
    "producer": LLMConfig(
        provider="gemini",
        model_name="gemini-2.0-flash",
        temperature=0.4,
        max_tokens=8000,
    ),
    "auditor": LLMConfig(
        provider="gemini",
        model_name="gemini-2.0-flash",
        temperature=0.1,
        max_tokens=4000,
    ),
}
```

### Sub-Task LLM Configs (used inside tools/skills)

```python
SUBTASK_CONFIGS = {
    "synthesis": LLMConfig(
        provider="gemini",
        model_name="gemini-2.0-flash",
        temperature=0.3,
        max_tokens=4000,
    ),
    "light_task": LLMConfig(
        provider="gemini",
        model_name="gemini-2.0-flash-lite",
        temperature=0.2,
        max_tokens=2000,
    ),
    "creative": LLMConfig(
        provider="gemini",
        model_name="gemini-2.0-flash",
        temperature=0.7,
        max_tokens=4000,
    ),
}
```

---

## 17. Error Handling

### Tool-Level Errors

Tools catch their own exceptions and return error strings. The ReAct loop sees the error as a tool result and decides whether to retry or report failure:

```python
@tool
def web_search(query: str) -> str:
    try:
        results = _search_api.search(query)
        return _format_results(results)
    except Exception as e:
        return f"Search failed: {e}. Try a different query or proceed without this data."
```

### Agent-Level Errors

If the ReAct loop exhausts retries or the LLM fails, `AgentBuilder.ainvoke()` raises. The orchestrator node catches this and returns `{"error": str(exc)}`:

```python
# orchestrator/nodes.py
async def run_researcher(state: CampaignState) -> dict:
    try:
        result = await researcher_agent.ainvoke(dict(state))
        return {"research_report": result.get("research_report")}
    except Exception as exc:
        return {"error": str(exc)}
```

### Pipeline-Level Errors

The `campaign_runner.py` wraps the entire `graph.ainvoke()` in a try/except and marks the campaign as failed:

```python
# tasks/campaign_runner.py
try:
    await graph.ainvoke(initial_state, config=config)
except Exception as exc:
    campaign_repo.update_status(db, campaign_id=campaign_id, status="failed", error=str(exc))
    streaming_service.emit(db, campaign_id=campaign_id, event_type="campaign_failed", ...)
```

---

## 18. Implementation Order

Build the infrastructure first, then implement agents one at a time. Each step is independently testable.

### Step 1 — Infrastructure

```
1. tools/__init__.py          ← TOOL_REGISTRY + get_tools()
2. agents/base.py             ← AgentBuilder class
```

### Step 2 — Researcher Agent (first real agent)

```
3. tools/web_search.py        ← @tool wrapping search API
4. tools/scrape_url.py        ← @tool wrapping Firecrawl
5. tools/retrieve_past_campaigns.py  ← @tool wrapping pgvector
6. agents/researcher/schemas.py      ← ResearchReport model
7. agents/researcher/skills.py       ← deep_competitor_analysis, research_platform_trends
8. agents/researcher/prompts.py      ← SYSTEM_PROMPT + build_input()
9. agents/researcher/agent.py        ← AgentBuilder instance + standalone runner
10. Update orchestrator/nodes.py     ← swap stub import → real import
```

### Step 3 — Strategist Agent

```
11. agents/strategist/schemas.py
12. agents/strategist/skills.py
13. agents/strategist/prompts.py
14. agents/strategist/agent.py
15. Update orchestrator/nodes.py
```

### Step 4 — Producer Agent

```
16. tools/generate_image.py
17. tools/generate_video.py
18. tools/generate_audio.py
19. tools/save_asset.py
20. agents/producer/schemas.py
21. agents/producer/skills.py
22. agents/producer/prompts.py
23. agents/producer/agent.py
24. Update orchestrator/nodes.py
```

### Step 5 — Auditor Agent

```
25. agents/auditor/schemas.py
26. agents/auditor/skills.py
27. agents/auditor/prompts.py
28. agents/auditor/agent.py
29. Update orchestrator/nodes.py
```

---

## Quick Reference

### Creating a New Agent (Checklist)

1. Create `agents/{name}/schemas.py` — define output Pydantic model
2. Create `agents/{name}/skills.py` — define agent-specific `@tool` functions
3. Create `agents/{name}/prompts.py` — write `SYSTEM_PROMPT` + `build_input()`
4. Create `agents/{name}/agent.py` — instantiate `AgentBuilder` with tools + skills + schema
5. Add standalone `if __name__ == "__main__"` block
6. Test standalone: `python -m agents.{name}.agent`
7. Update `orchestrator/nodes.py` — swap import from stub to real agent

### Adding a New Global Tool (Checklist)

1. Create `tools/{name}.py` — define `@tool` function
2. Add entry to `TOOL_REGISTRY` in `tools/__init__.py`
3. Add tool name to whichever agent's `tool_names` list needs it
4. No other files change
