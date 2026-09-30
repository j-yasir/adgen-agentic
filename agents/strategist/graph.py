"""Strategist pipeline — plan → produce → assemble.

Stage 1 (plan):     ReAct planner agent emits a small DistributionPlan.
Stage 2 (produce):  specialist copy skills run in parallel, one per asset.
Stage 3 (assemble): pure code merges briefs + copy into a validated StrategyDoc.

Copy is written once by the skills and never re-emitted by a model, so it
cannot be paraphrased or truncated during assembly. Every stage validates its
output and repairs narrowly: a failing asset re-runs only its own skill.

Exposed as `strategist_pipeline`; the orchestrator node and the standalone
API endpoint both call `strategist_pipeline.ainvoke(state, on_event=...)`.
"""

from __future__ import annotations

import asyncio
import json
from typing import Any, Callable

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import ValidationError

from agents.strategist.agent import build_planner_agent
from agents.strategist.prompts import (
    REVISION_SYSTEM_PROMPT,
    build_copy_context,
    build_email_input,
    build_planner_input,
    build_planner_prompt,
    build_revision_input,
    build_static_input,
    build_video_input,
)
from agents.strategist.schemas import (
    AssetBrief,
    AssetPlan,
    AssetPlanAdapter,
    DistributionPlan,
    EmailPlan,
    RevisionPlan,
    StaticImagePlan,
    StrategyDoc,
    VideoAdPlan,
)
from agents.strategist.skills import (
    _content_to_text,
    write_email,
    write_static_ad,
    write_video_script,
)
from agents.strategist.validation import (
    StrategistError,
    max_video_duration,
    parse_json_object,
    validate_copy_content,
    validate_plan,
)
from utils.LLM.factory import get_llm_model
from utils.LLM.schemas import LLMConfig
from utils.logger import get_logger
from utils.retry import call_with_retries

logger = get_logger(__name__)

# Event callback: (event_type, payload). event_type must stay within the
# campaign_events CHECK constraint vocabulary (tool_call / tool_result / ...).
EventCallback = Callable[[str, dict], None]

_PLANNER_LLM_CONFIG = LLMConfig(
    provider="kie",
    model_name="gemini-3-6-flash-openai",
    temperature=0.4,   # planning = structured decisions
    max_tokens=4000,
)

_MAX_PLAN_REPAIRS = 3
_MAX_CONTENT_REPAIRS = 2

_SKILLS = {
    "static_image": ("write_static_ad", write_static_ad),
    "video_ad":     ("write_video_script", write_video_script),
    "email":        ("write_email", write_email),
}


def _noop_emit(_event_type: str, _payload: dict) -> None:
    pass


class StrategistPipeline:
    """Callable pipeline object. Stateless — safe to share across requests."""

    # ── Public entry point ────────────────────────────────────────────────────

    async def ainvoke(self, state: dict, on_event: EventCallback | None = None) -> dict:
        """Run the pipeline and return a validated StrategyDoc as a dict.

        Revision mode: when the state carries a previous strategy_doc plus a
        rejected hitl_response, only the assets the feedback touches are
        regenerated.

        Raises StrategistError when a stage cannot produce valid output.
        """
        emit = self._safe_emit(on_event or _noop_emit)

        hitl = state.get("hitl_response") or {}
        is_revision = bool(state.get("strategy_doc")) and hitl.get("approved") is False
        if is_revision:
            return await self._revise(state, emit)

        plan = await self._plan(state, emit)
        doc = await self._produce_and_assemble(state, plan, emit)
        return doc.model_dump()

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _safe_emit(emit: EventCallback) -> EventCallback:
        def wrapped(event_type: str, payload: dict) -> None:
            try:
                emit(event_type, payload)
            except Exception:
                logger.warning("Event emission failed (%s) — continuing", event_type, exc_info=True)
        return wrapped

    @staticmethod
    async def _direct_llm(system_prompt: str, user_prompt: str) -> str:
        llm = get_llm_model(_PLANNER_LLM_CONFIG)

        async def _once() -> str:
            response = await llm.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ])
            return _content_to_text(response.content)

        return await call_with_retries(_once, label="strategist_direct")

    @staticmethod
    async def _run_planner_agent(state: dict, system_prompt: str, user_input: str,
                                 emit: EventCallback) -> str:
        """Run the ReAct planner, forwarding tool activity as SSE events."""
        agent = build_planner_agent(system_prompt)
        input_ = {"messages": [HumanMessage(content=user_input)]}

        final_result: dict | None = None
        async for event in agent.agent.astream_events(input_, version="v2"):
            kind = event["event"]
            if kind == "on_tool_start":
                emit("tool_call", {
                    "tool": event["name"],
                    "input": str(event.get("data", {}).get("input", {}))[:500],
                })
            elif kind == "on_tool_end":
                emit("tool_result", {
                    "tool": event["name"],
                    "result_summary": str(event.get("data", {}).get("output", ""))[:500],
                })
            elif kind == "on_chain_end" and event.get("name") == agent.agent_name:
                final_result = event.get("data", {}).get("output", {})

        if final_result is None:
            final_result = await agent.ainvoke(input_)

        return _content_to_text(final_result["messages"][-1].content)

    # ── Stage 1: plan ─────────────────────────────────────────────────────────

    async def _plan(self, state: dict, emit: EventCallback) -> DistributionPlan:
        system_prompt = build_planner_prompt(int(state.get("num_variants") or 3))
        user_input = build_planner_input(state)

        # The whole ReAct run retries as a unit — kie.ai fails intermittently
        # mid-loop, and a fresh run is cheaper than resuming a broken one.
        raw = await call_with_retries(
            lambda: self._run_planner_agent(state, system_prompt, user_input, emit),
            label="strategist_planner",
        )

        errors = ""
        for attempt in range(_MAX_PLAN_REPAIRS + 1):
            if attempt > 0:
                emit("tool_result", {
                    "tool": "plan_validation",
                    "status": "repair",
                    "attempt": attempt,
                    "errors": errors[:500],
                })
                # Repairs are pure format/rule fixes — no tools needed.
                raw = await self._direct_llm(
                    system_prompt,
                    f"{user_input}\n\n## REPAIR\nYour previous plan failed validation:\n"
                    f"{errors}\n\nPrevious plan:\n{raw[:6000]}\n\n"
                    f"Re-emit the COMPLETE corrected JSON now — nothing else.",
                )
            try:
                plan = DistributionPlan.model_validate(parse_json_object(raw))
            except (ValueError, ValidationError) as exc:
                errors = str(exc)
                continue

            violations = validate_plan(plan, state)
            if not violations:
                emit("tool_result", {
                    "tool": "plan_distribution",
                    "theme": plan.campaign_theme,
                    "asset_count": len(plan.asset_briefs),
                    "distribution": self._distribution(plan.asset_briefs),
                })
                return plan
            errors = "\n".join(f"- {v}" for v in violations)

        raise StrategistError(f"Planner failed after {_MAX_PLAN_REPAIRS} repairs: {errors}")

    @staticmethod
    def _distribution(briefs: list[AssetBrief]) -> dict[str, int]:
        dist: dict[str, int] = {}
        for b in briefs:
            dist[b.asset_type] = dist.get(b.asset_type, 0) + 1
        return dist

    # ── Stage 2: produce copy (fan-out) ───────────────────────────────────────

    async def _produce_one(self, brief: AssetBrief, ctx: dict, state: dict,
                           narrative_arc: str, emit: EventCallback) -> AssetPlan:
        skill_name, skill = _SKILLS[brief.asset_type]

        if brief.asset_type == "static_image":
            user_prompt = build_static_input(brief, ctx, state, narrative_arc)
        elif brief.asset_type == "video_ad":
            limit = max_video_duration(state, brief.platform)
            user_prompt = build_video_input(brief, ctx, state, narrative_arc, limit)
        else:
            user_prompt = build_email_input(brief, ctx, state, narrative_arc)

        emit("tool_call", {
            "tool": skill_name,
            "asset_id": brief.asset_id,
            "asset_type": brief.asset_type,
            "platform": brief.platform,
            "angle": brief.angle,
        })

        copy = await skill(user_prompt)

        violations = validate_copy_content(copy.model_dump(), brief, state)
        for _ in range(_MAX_CONTENT_REPAIRS):
            if not violations:
                break
            emit("tool_result", {
                "tool": "content_validation",
                "asset_id": brief.asset_id,
                "status": "repair",
                "violations": violations,
            })
            copy = await skill(
                user_prompt,
                extra_instructions=(
                    "Your previous copy violated these rules — fix ALL of them:\n- "
                    + "\n- ".join(violations)
                ),
            )
            violations = validate_copy_content(copy.model_dump(), brief, state)
        if violations:
            raise StrategistError(
                f"{brief.asset_id}: copy still invalid after {_MAX_CONTENT_REPAIRS} repairs: "
                + "; ".join(violations),
                violations=violations,
            )

        # The CTA URL is not a creative decision — pin it to the BKO's value so
        # provider-level character sanitisation can never corrupt it.
        if brief.asset_type == "email" and ctx.get("conversion_url"):
            copy = copy.model_copy(update={"cta_url": ctx["conversion_url"]})

        emit("tool_result", {
            "tool": skill_name,
            "asset_id": brief.asset_id,
            "hook": copy.hook,
            "preview": getattr(copy, "headline", None) or getattr(copy, "subject_line", ""),
        })
        return self._merge(brief, copy)

    @staticmethod
    async def _gather_assets(coros) -> list[AssetPlan]:
        """Run asset productions in parallel; let siblings finish, then raise
        one aggregated error if any failed (avoids orphaned tasks and reports
        every failing asset at once)."""
        results = await asyncio.gather(*coros, return_exceptions=True)
        failures = [r for r in results if isinstance(r, BaseException)]
        if failures:
            raise StrategistError(
                "Asset copy generation failed: " + "; ".join(str(f) for f in failures),
                violations=[v for f in failures if isinstance(f, StrategistError) for v in f.violations],
            )
        return list(results)

    @staticmethod
    def _merge(brief: AssetBrief, copy: Any) -> AssetPlan:
        """Merge the planner's strategy header with the skill's copy — verbatim."""
        header = {
            "asset_id":         brief.asset_id,
            "platform":         brief.platform,
            "format":           brief.format,
            "funnel_stage":     brief.funnel_stage,
            "role_in_campaign": brief.role_in_campaign,
            "angle":            brief.angle,
            "hero_product":     brief.hero_product,
            "target_emotion":   brief.target_emotion,
            "key_message":      brief.key_message,
            "copy_tone":        brief.tone,
            "compliance_notes": brief.compliance_notes,
        }
        plan_cls = {
            "static_image": StaticImagePlan,
            "video_ad":     VideoAdPlan,
            "email":        EmailPlan,
        }[brief.asset_type]
        return plan_cls(**header, **copy.model_dump())

    async def _produce_and_assemble(self, state: dict, plan: DistributionPlan,
                                    emit: EventCallback) -> StrategyDoc:
        ctx = build_copy_context(state)
        asset_plans = await self._gather_assets(
            self._produce_one(brief, ctx, state, plan.narrative_arc, emit)
            for brief in plan.asset_briefs
        )
        # Stage 3 — assembly is pure construction; StrategyDoc validates on init.
        return StrategyDoc(
            campaign_theme=plan.campaign_theme,
            target_emotion=plan.target_emotion,
            narrative_arc=plan.narrative_arc,
            asset_plan=list(asset_plans),
            key_messages=plan.key_messages,
            what_to_avoid=plan.what_to_avoid,
        )

    # ── HITL revision: regenerate only what the feedback touches ──────────────

    async def _revise(self, state: dict, emit: EventCallback) -> dict:
        previous_doc: dict = state["strategy_doc"]
        feedback = (state.get("hitl_response") or {}).get("feedback") or "Strategy rejected."
        prev_assets = {a["asset_id"]: a for a in previous_doc.get("asset_plan", [])}
        prev_order = list(prev_assets.keys())

        user_input = build_revision_input(state, previous_doc, feedback)
        raw = await self._direct_llm(REVISION_SYSTEM_PROMPT, user_input)

        errors = ""
        revision: RevisionPlan | None = None
        for attempt in range(_MAX_PLAN_REPAIRS + 1):
            if attempt > 0:
                emit("tool_result", {
                    "tool": "revision_validation",
                    "status": "repair",
                    "errors": errors[:500],
                })
                raw = await self._direct_llm(
                    REVISION_SYSTEM_PROMPT,
                    f"{user_input}\n\n## REPAIR\nYour previous revision plan failed "
                    f"validation:\n{errors}\n\nPrevious response:\n{raw[:6000]}\n\n"
                    f"Re-emit the COMPLETE corrected JSON now — nothing else.",
                )
            try:
                revision = RevisionPlan.model_validate(parse_json_object(raw))
            except (ValueError, ValidationError) as exc:
                errors = str(exc)
                continue

            violations = self._validate_revision(revision, prev_assets, state)
            if not violations:
                break
            errors = "\n".join(f"- {v}" for v in violations)
            revision = None

        if revision is None:
            raise StrategistError(f"Revision planning failed after {_MAX_PLAN_REPAIRS} repairs: {errors}")

        emit("tool_result", {
            "tool": "plan_revision",
            "kept": revision.keep,
            "regenerating": [b.asset_id for b in revision.regenerate],
        })

        # Regenerate only the flagged assets; feedback rides along so the
        # copywriter addresses it directly.
        narrative_arc = revision.narrative_arc or previous_doc.get("narrative_arc", "")
        ctx = build_copy_context(state)
        ctx["special_brief"] = (
            f"{ctx['special_brief']} | Reviewer feedback to address: {feedback}".strip(" |")
        )
        regenerated = await self._gather_assets(
            self._produce_one(brief, ctx, state, narrative_arc, emit)
            for brief in revision.regenerate
        )
        regenerated_by_id = {p.asset_id: p for p in regenerated}

        asset_plans: list[AssetPlan] = []
        for asset_id in prev_order:
            if asset_id in regenerated_by_id:
                asset_plans.append(regenerated_by_id[asset_id])
            else:
                asset_plans.append(AssetPlanAdapter.validate_python(prev_assets[asset_id]))

        doc = StrategyDoc(
            campaign_theme=revision.campaign_theme or previous_doc.get("campaign_theme", ""),
            target_emotion=previous_doc.get("target_emotion", ""),
            narrative_arc=narrative_arc,
            asset_plan=asset_plans,
            key_messages=revision.key_messages or previous_doc.get("key_messages", []),
            what_to_avoid=revision.what_to_avoid or previous_doc.get("what_to_avoid", []),
        )
        return doc.model_dump()

    @staticmethod
    def _validate_revision(revision: RevisionPlan, prev_assets: dict[str, dict],
                           state: dict) -> list[str]:
        """Every previous asset_id must land in exactly one of keep/regenerate,
        and the resulting brief set must still satisfy the plan-level rules."""
        violations: list[str] = []
        prev_ids = set(prev_assets)
        keep_ids = set(revision.keep)
        regen_ids = {b.asset_id for b in revision.regenerate}

        overlap = keep_ids & regen_ids
        if overlap:
            violations.append(f"asset_ids in both keep and regenerate: {sorted(overlap)}.")
        missing = prev_ids - keep_ids - regen_ids
        if missing:
            violations.append(f"asset_ids missing from keep/regenerate: {sorted(missing)}.")
        unknown = (keep_ids | regen_ids) - prev_ids
        if unknown:
            violations.append(f"Unknown asset_ids (not in the previous strategy): {sorted(unknown)}.")
        if violations:
            return violations

        # Rebuild the full brief set (kept assets as pseudo-briefs) and re-run
        # the same plan rules — a revision must not break coverage or legality.
        try:
            briefs = list(revision.regenerate)
            for asset_id in keep_ids:
                a = prev_assets[asset_id]
                briefs.append(AssetBrief(
                    asset_id=a["asset_id"],
                    asset_type=a["asset_type"],
                    platform=a["platform"],
                    format=a["format"],
                    funnel_stage=a["funnel_stage"],
                    role_in_campaign=a["role_in_campaign"],
                    angle=a["angle"],
                    hero_product=a["hero_product"],
                    target_emotion=a["target_emotion"],
                    hook_direction=a.get("hook", ""),
                    key_message=a["key_message"],
                    tone=a.get("copy_tone", ""),
                    compliance_notes=a.get("compliance_notes", ""),
                ))
        except (KeyError, ValidationError) as exc:
            logger.warning("Could not rebuild briefs from previous strategy: %s", exc)
            return []

        plan = DistributionPlan(
            campaign_theme="revision", target_emotion="revision", narrative_arc="revision",
            asset_briefs=briefs, key_messages=["revision"], what_to_avoid=[],
        )
        return validate_plan(plan, state)


strategist_pipeline = StrategistPipeline()
