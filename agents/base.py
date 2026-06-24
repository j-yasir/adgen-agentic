from __future__ import annotations

from typing import Any, Type

from pydantic import BaseModel
from langgraph.prebuilt import create_react_agent
from langchain_core.language_models.chat_models import BaseChatModel

from utils.LLM.factory import get_llm_model
from utils.LLM.schemas import LLMConfig
from tools import get_tools
from utils.logger import get_logger

logger = get_logger(__name__)


class AgentBuilder:
    """Universal agent factory — every agent in the system is an instance of this class.

    Usage:
        agent = AgentBuilder(
            agent_name    = "researcher",
            system_prompt = RESEARCHER_SYSTEM_PROMPT,
            tool_names    = ["web_search", "scrape_url"],
            skills        = [deep_competitor_analysis],
            response_format = ResearchReport,
            llm_config    = LLMConfig(provider="gemini", model_name="gemini-2.0-flash"),
        )

        # Called by the orchestrator:
        result = await agent.ainvoke(campaign_state_dict)

        # Called for standalone testing:
        result = agent.invoke(test_input)
    """

    def __init__(
        self,
        agent_name: str,
        system_prompt: str,
        tool_names: list[str] | None           = None,
        skills: list | None                    = None,
        response_format: Type[BaseModel] | None = None,
        llm_config: LLMConfig | None           = None,
    ):
        self.agent_name = agent_name

        # ── LLM — always through utils/LLM factory ──────────────────
        config = llm_config or LLMConfig(
            provider="gemini",
            model_name="gemini-2.0-flash",
            temperature=0.3,
            max_tokens=8000,
        )
        self.llm: BaseChatModel = get_llm_model(config)

        # ── Tools = global registry picks + agent-specific skills ────
        global_tools = get_tools(tool_names or [])
        agent_skills = list(skills or [])
        self.tools = global_tools + agent_skills

        # ── Build the LangGraph ReAct agent ──────────────────────────
        self.agent = create_react_agent(
            model=self.llm,
            tools=self.tools,
            prompt=system_prompt,
            response_format=response_format,
            name=agent_name,
        )

        logger.info(
            "Built agent '%s' — %d tools (%d global + %d skills), response_format=%s",
            agent_name,
            len(self.tools),
            len(global_tools),
            len(agent_skills),
            response_format.__name__ if response_format else "None",
        )

    async def ainvoke(self, input: dict[str, Any], **kwargs) -> dict[str, Any]:
        """Async invocation — used by the orchestrator and background tasks."""
        return await self.agent.ainvoke(input, **kwargs)

    def invoke(self, input: dict[str, Any], **kwargs) -> dict[str, Any]:
        """Sync invocation — useful for testing and standalone scripts."""
        return self.agent.invoke(input, **kwargs)

    def get_graph(self):
        """Return the underlying compiled StateGraph (for visualization/debugging)."""
        return self.agent
