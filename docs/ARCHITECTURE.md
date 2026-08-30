# AdGen-Agentic — Architecture Reference

> End-to-end autonomous multi-agent ad generation system.
> Stack: Python · FastAPI · LangGraph · PostgreSQL (+ pgvector) · kie.ai (LLM + media) · Next.js

> **This document describes the system's architecture** — built and running components alongside prospected
> ones that are designed but not yet implemented. For the deep, universal pattern every agent is built
> from (AgentBuilder, tool/skill layer, LLM factory), see [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md).
> For the Strategist's internal pipeline specifically, see [agents/STRATEGIST_AGENT_V2.md](./agents/STRATEGIST_AGENT_V2.md).

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [System Layers](#3-system-layers)
4. [Auth & User Management](#4-auth--user-management)
5. [Business Onboarding & BKO](#5-business-onboarding--bko)
6. [Campaign Layer](#6-campaign-layer)
7. [Orchestrator Architecture](#7-orchestrator-architecture)
8. [Durable Execution — Retry & Resume](#8-durable-execution--retry--resume)
9. [Agent Layer](#9-agent-layer)
10. [Memory System](#10-memory-system)
11. [Human-in-the-Loop](#11-human-in-the-loop)
12. [Streaming & Real-Time Events](#12-streaming--real-time-events)
13. [Database Schema](#13-database-schema)
14. [API Reference](#14-api-reference)
15. [Directory Structure](#15-directory-structure)
16. [Build Status](#16-build-status)

---

## 1. System Overview

A user onboards their business once — this produces a **Business Knowledge Object (BKO)**, a rich structured
document that becomes the single source of truth for every campaign that business runs. Launching a campaign
triggers a LangGraph pipeline of specialist agents (Researcher → Strategist → Producer → Auditor) that turns
the BKO plus a short campaign brief into finished ad assets, pausing at three human-review checkpoints along
the way.

**No Redis. No separate vector database.** Real-time progress streams to the client over Server-Sent Events
backed by PostgreSQL `LISTEN`/`NOTIFY`. Past-campaign semantic memory (when populated) uses the `pgvector`
extension on the same Postgres instance. The entire persistence and pub/sub layer is one service.

```
                              ┌────────────────────────────┐
                              │   User (Next.js frontend)  │
                              └──────────────┬─────────────┘
                                             │ REST + SSE (Bearer JWT)
                                             ▼
                              ┌────────────────────────────┐
                              │   FastAPI (api/)           │
                              │   auth · businesses ·      │
                              │   campaigns · stream ·      │
                              │   agents (standalone) ·     │
                              │   admin                     │
                              └──────────────┬─────────────┘
                     ┌────────────────────────┼───────────────────────┐
                     ▼                        ▼                       ▼
          ┌────────────────────┐   ┌────────────────────┐   ┌──────────────────────┐
          │  services/ + repos/ │   │ orchestrator/       │   │ SSE endpoint          │
          │  stored-procedure   │   │ LangGraph StateGraph│   │ LISTEN campaign_{id} │
          │  CRUD only          │   │ + AsyncPostgresSaver│   │ re-reads full rows    │
          └──────────┬──────────┘   └──────────┬──────────┘   └───────────┬───────────┘
                     │                        │                          │
                     ▼                        ▼                          │
          ┌─────────────────────────────────────────────────┐            │
          │            PostgreSQL (+ pgvector)                │◄──────────┘
          │  businesses.bko JSONB · campaigns · campaign_events│
          │  assets · audit_logs · LangGraph checkpoints        │
          └─────────────────────────────────────────────────┘
                                             ▲
                                             │ agent.ainvoke()
                              ┌──────────────┴─────────────┐
                              │  agents/ (Researcher,        │
                              │  Strategist, Producer,       │
                              │  Auditor)  — see §9           │
                              └──────────────┬─────────────┘
                                             ▼
                              ┌────────────────────────────┐
                              │  kie.ai (OpenAI-compatible)  │
                              │  chat models + image/video   │
                              │  generation, one API key     │
                              └────────────────────────────┘
```

---

## 2. Technology Stack

| Layer | Technology | Notes |
|---|---|---|
| API | FastAPI 0.137, Uvicorn | REST + Server-Sent Events. No WebSocket. |
| Auth | `python-jose` (JWT) + `passlib`/`bcrypt` | Access + refresh tokens, refresh rotation, DB-backed revocation |
| Orchestration | LangGraph 1.2 (`StateGraph`, `RetryPolicy`, `interrupt`/`Command`) | Deterministic routing + durable execution — no LLM in the orchestrator itself |
| Checkpointing | `langgraph-checkpoint-postgres` (`AsyncPostgresSaver`) | Every completed graph step persisted; `thread_id = campaign_id` |
| Agents | LangGraph `create_react_agent` via a shared `AgentBuilder` factory | See [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md) |
| LLM provider | **kie.ai** — OpenAI-compatible proxy in front of Gemini | One provider abstraction (`utils/LLM`) swaps providers via `LLMConfig`; kie.ai is what's actually configured today. Direct Gemini/OpenAI/HuggingFace provider adapters also exist in `utils/LLM/providers/` for future use. |
| Media generation | `utils/MediaGen` → kie.ai-hosted models (flux, Gemini image/"nano-banana", Seedream) | Provider-agnostic factory, same pattern as `utils/LLM`. **Not yet wired into the Producer** (see §9). |
| Relational DB + vectors | PostgreSQL 16 + `pgvector` | Single service for app state, event log, and (future) embeddings |
| DB access pattern | SQLAlchemy 2.0 (sync) executing **stored procedures only** | No ORM writes in application code — see §3. Async `psycopg` (v3) is used separately, only for the LangGraph checkpointer. |
| Migrations | Alembic | 3 revisions to date (see §13) |
| Streaming | PostgreSQL `LISTEN`/`NOTIFY` → SSE | `NOTIFY` carries a slim envelope only (8000-byte hard limit); the listener re-reads full rows from the DB — see §12 |
| Web research tools | Custom `web_search` + `scrape_url` tools (Researcher only) | `tools/firecrawl.py` exists as an empty placeholder — not the active scraping path today |
| Frontend | Next.js 16 (canary), React 19, TanStack Query, Tailwind 4, shadcn/ui | REST + SSE client only; no server-side agent logic |
| Testing | Pytest scaffolding under `tests/` | Present but not the primary verification method used during this build — most agent/pipeline changes are verified via live end-to-end runs (see §16) |

> **Why no Redis?** PostgreSQL `LISTEN`/`NOTIFY` handles pub/sub with zero extra infrastructure for a
> single-server deployment.
>
> **Why no separate vector DB?** `pgvector` runs on the same Postgres instance already used for everything
> else. The `business_embeddings` table and column exist today; semantic retrieval itself is not yet
> implemented (see §10).

---

## 3. System Layers

```
Transport      FastAPI routers (api/routes/) — thin; one line per endpoint, no business logic
                    │
Service         services/*.py — business logic, ownership checks, raises AppError subclasses
                    │
Repo            repos/*.py — DB access, calls stored procedures via SQLAlchemy text(), returns dicts
                    │
Stored Proc     sql/**/*.sql — all SQL lives here; PL/pgSQL functions, never inline strings in Python
                    │
Orchestrator    orchestrator/ — LangGraph StateGraph; routes between agent nodes, owns DB writes/SSE
                emission and durable-execution retry, contains NO LLM calls itself
                    │
Agent           agents/*/ — each agent is an AgentBuilder instance (system prompt + tools + skills);
                owns reasoning, tool selection, output schema
                    │
LLM / Media     utils/LLM, utils/MediaGen — provider-agnostic factories agents/skills call into
```

**Rules enforced throughout the backend:**
- Routers never contain logic — they call exactly one service method and return its result.
- Services never write raw SQL — always call repo methods.
- Repos never contain business logic — only execute stored procedures and return dicts.
- All SQL lives in `.sql` files under `sql/`, loaded at startup by `sql.load_stored_procedures()` (and
  reloadable via `POST /admin/load-procedures` without restarting the app).
- JSONB parameters are always passed as `CAST(:param AS JSONB)` — never `::jsonb` — because the latter
  breaks SQLAlchemy's psycopg2 parameter binding.
- Agents never touch the DB directly. Orchestrator nodes call `agent.ainvoke(...)` and persist the result.

---

## 4. Auth & User Management

### Flow

```
Signup:   POST /auth/signup  → hash password (bcrypt) → INSERT user → {access_token, refresh_token, user}
Login:    POST /auth/login   → verify password → issue new token pair
Refresh:  POST /auth/refresh → hash raw refresh token → look up → revoke old → issue rotated pair
Protected: Authorization: Bearer <access_token> → Depends(get_current_user) decodes JWT → injects user dict
```

### Token design

- **Access token**: HS256 JWT, 15-minute expiry, carries `sub=user_id`.
- **Refresh token**: cryptographically random string; only its SHA-256 hash is stored in `refresh_tokens`
  (the raw value is never persisted). 7-day expiry, rotated on every use — the old hash is revoked the
  moment a new pair is issued.
- **Password hashing**: bcrypt via passlib, pinned to `bcrypt==4.0.1` (bcrypt 5.x breaks passlib's wrapper).

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | — | Register, returns token pair |
| POST | `/api/v1/auth/login` | — | Login, returns token pair |
| POST | `/api/v1/auth/refresh` | — | Rotate refresh token |
| POST | `/api/v1/auth/logout` | — | Revoke one refresh token |
| POST | `/api/v1/auth/logout-all` | Bearer | Revoke all tokens for the user |
| GET | `/api/v1/auth/me` | Bearer | Current user profile |

---

## 5. Business Onboarding & BKO

A business is onboarded once; every campaign it runs consumes the same **Business Knowledge Object (BKO)** —
stored as a single JSONB column (`businesses.bko`), versioned (`bko_version`, bumped on every update).

### Onboarding paths

| Path | Status |
|---|---|
| **Form** (`bko_service.build_from_form`) | ✅ Built — 5 structured form sections map directly to BKO fields, no inference needed |
| URL scrape (Firecrawl + LLM structuring) | Documented, not yet implemented |
| Free-text extraction (LLM) | Documented, not yet implemented |

### Completeness scoring

`bko_service._compute_completeness()` checks 26 optional fields and stores the result at
`bko.meta.completeness_score` (0.0–1.0) plus a `missing_fields` list — agents can use this to judge how much
they can lean on a given field before treating it as absent.

### BKO shape (10 sections, as actually produced by `build_from_form`)

| Section | Contents |
|---|---|
| `identity` | company_name, business_type, industry, description, mission, tagline, brand_story, founded_year, headquarters |
| `offerings` | products_services[] (name, description, USPs, benefits, pricing, is_hero), hero_product, primary_cta, conversion_url |
| `audience` | `primary` segment: demographics, psychographics, behavioral, pain_points, objections, persona_name, emotional_state, desired_outcomes; `audience_awareness_level` |
| `brand` | personality_traits, voice (primary_tone, writing_style, pov, examples, humor_level), visual_identity (colors, fonts, imagery_style, dos/don'ts), dos/don'ts |
| `competitive_position` | market_position, positioning_statement, competitors[] (with `our_counter` rebuttals), differentiators |
| `marketing_context` | active_platforms, funnel_strategy (tofu/mofu/bofu one-liners), budget_tier, preferred_cta_styles, ad_style_preference |
| `social_proof` | key_stats, testimonials[], guarantees, awards, notable_clients |
| `messaging` | primary_value_propositions, emotional_hooks, headline_formulas, proof_points, forbidden_topics |
| `compliance` | restricted_claims, required_ad_disclosures, industry_regulations, certifications_to_mention |
| `meta` | version, completeness_score, missing_fields, onboarding_path |

> **Why the full BKO is injected directly into every agent prompt, no chunking:** the LLM in use has a large
> enough context window that the whole BKO fits comfortably. `pgvector` is reserved for retrieving *past
> campaign* similarity, not for querying the current BKO.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/businesses` | Bearer | Create business + BKO (form path) |
| GET | `/api/v1/businesses` | Bearer | List user's businesses |
| GET | `/api/v1/businesses/{id}` | Bearer | Business detail + BKO |
| PATCH | `/api/v1/businesses/{id}` | Bearer | Update sections → rebuild BKO, bump `bko_version` |
| DELETE | `/api/v1/businesses/{id}` | Bearer | Delete business (cascades to campaigns, embeddings) |

---

## 6. Campaign Layer

### Campaign brief (user input)

| Field | Type | Notes |
|---|---|---|
| `business_id` | UUID | Whose BKO to use |
| `campaign_name` | string, optional | Auto-generated from objective + platforms if omitted |
| `objective` | enum | `awareness` `traffic` `conversion` `lead_gen` `engagement` |
| `platforms` | string[] | `instagram` `facebook` `tiktok` `youtube` `google` `linkedin` |
| `asset_types` | string[] | `static_image` `video_ad` `email` |
| `funnel_stage` | enum | `tofu` `mofu` `bofu` `balanced` — a fixed stage pins every asset to it; only `balanced` lets the Strategist vary per asset |
| `num_variants` | int (1–10) | Exact number of assets to produce |
| `hero_products` | string[], optional | Specific SKUs to prioritize — when given, every asset must feature one of these, not just any BKO catalog product |
| `tone_override` | string, optional | Overrides the BKO's default brand tone for this campaign |
| `special_brief` | string, optional | Free-text editorial instruction — can override BKO defaults (e.g. audience awareness level) for this campaign specifically |

### Status lifecycle

```
pending ──► running ──► awaiting_review ──► running ──► ... ──► done
                              │                                    ▲
                              └──────────────► failed ─────────────┘
                                          (resumable=true/false, failed_node set)
```

- `pending` — row created, pipeline not yet started.
- `running` — a node is actively executing.
- `awaiting_review` — paused at a HITL `interrupt()`; frontend shows the review panel.
- `done` — all assets approved, `campaign_done` node reached.
- `failed` — a node exhausted its automatic retries (or a permanent error occurred). Two extra columns
  disambiguate what happened next — see §8:
  - `resumable: bool` — `true` only when the failure happened inside an agent node after automatic retries
    were exhausted (network/provider blip class). `false` for permanent errors (e.g. business not found).
  - `failed_node: str | null` — which orchestrator node failed, so `/retry` knows where to resume and the
    frontend can show *"Failed at: run_strategist"*.

### Endpoints

| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/campaigns` | Create campaign, schedules the pipeline as a `BackgroundTask`, returns immediately |
| GET | `/api/v1/campaigns?business_id=` | List campaigns for a business |
| GET | `/api/v1/campaigns/{id}` | Campaign detail incl. `strategy_doc`, status, `resumable`/`failed_node` |
| GET | `/api/v1/campaigns/{id}/events` | Full event log (`?after_seq=N` for reconnect catch-up) |
| GET | `/api/v1/campaigns/{id}/assets` | Generated assets for a campaign |
| POST | `/api/v1/campaigns/{id}/resume` | Answer a HITL `interrupt()` — `{approved, feedback}` |
| POST | `/api/v1/campaigns/{id}/retry` | Retry after a node failure — only when `status=failed AND resumable=true` (§8) |
| DELETE | `/api/v1/campaigns/{id}` | Delete campaign (cascades events, assets, audit logs) |

---

## 7. Orchestrator Architecture

The orchestrator (`orchestrator/`) is a LangGraph `StateGraph` over `CampaignState`. It contains **no LLM
calls** — it invokes agents and routes deterministically on the state they return.

### Graph shape

```
load_bko ──► run_researcher ──► hitl_research_review
                                        │ (approved)
                                        ▼
                    ┌────────────► run_strategist
                    │                   │
      (rejected +   │                   ▼
       feedback →    │           hitl_plan_approval
       re-plan)      │            │              │
                    └────────────┘   (approved)   
                                        │
                                        ▼
                                  run_producer ◄──────┐
                                        │              │ (assets_rejected
                                        ▼              │  and retry_count<=2)
                                  run_auditor ─────────┘
                                        │ (pass, or retries exhausted)
                                        ▼
                                  hitl_assets
                                        │
                                        ▼
                                 campaign_done ──► END

Any node exception (after RetryPolicy exhausts attempts) ──► campaign_failed (see §8)
```

### Node responsibilities

Each orchestrator node (`orchestrator/nodes.py`):
1. Emits an `agent_started` SSE event.
2. Calls `agent.ainvoke(...)` (or, for the Strategist, the Strategist's own internal pipeline — §9).
3. Persists the structured result to `campaigns` via a stored procedure.
4. Emits `agent_completed` / `tool_call` / `tool_result` SSE events as the agent works
   (`_run_agent_streaming()` taps `agent.astream_events()` for granular progress).
5. Returns a partial `CampaignState` update — LangGraph merges it into the shared state.

`CampaignState` (`orchestrator/state.py`) carries the campaign brief fields (§6), `bko`, `research_report`,
`strategy_doc`, `generated_assets`, `audit_results`/`assets_approved`/`assets_rejected`, `retry_count`,
`hitl_response`, and `error` — the single dict every node reads from and writes to.

### Routing (`orchestrator/edges.py`)

| Function | Decides |
|---|---|
| `route_after_strategist` | Strategist error → `campaign_failed`; otherwise → `hitl_plan_approval` |
| `route_after_plan_approval` | Human rejected the strategy → back to `run_strategist` (revision mode, §9); approved → `run_producer` |
| `route_after_audit` | `assets_rejected` and `retry_count <= 2` → `run_producer` again; otherwise → `hitl_assets` |
| `route_after_review` | Always → `campaign_done` (approval flag/feedback carried in `hitl_response` for the frontend) |

### Crash recovery via the checkpointer

`AsyncPostgresSaver` (keyed by `thread_id = campaign_id`) persists state after every successfully completed
node. A crashed process can be restarted and the same campaign resumed by invoking the graph again with the
same `thread_id` — LangGraph replays from the last completed node, not from the beginning. This is the
foundation §8 builds on.

---

## 8. Durable Execution — Retry & Resume

This is the mechanism that turns "an agent call failed" into "resume the one step that failed," instead of
relaunching the whole campaign. It follows the same pattern as AWS Step Functions' "Redrive" or Temporal's
activity retries: bounded automatic retry at the step level, durable state after every completed step, and
an explicit manual-resume action distinct from "start over."

### 1 — Automatic retry (`RetryPolicy`)

The four agent-calling nodes (`run_researcher`, `run_strategist`, `run_producer`, `run_auditor`) are
registered with a LangGraph `RetryPolicy(max_attempts=4, initial_interval=2.0, retry_on=is_transient)`.
`is_transient()` (`utils/retry.py`) recognizes connection errors, timeouts, and known kie.ai provider
hiccups. A transient failure retries the *entire node* up to 4 times with exponential backoff before the
graph gives up — no human involvement needed for a brief network blip.

### 2 — Nodes raise, they don't swallow

Every agent node catches its own exceptions only to emit an `agent_error` SSE event and log context, then
**re-raises** as a `NodeExecutionError(node_name, original_exception)` (`orchestrator/nodes.py`). This
matters for two reasons:
- `RetryPolicy` only engages on a raised exception — a node that swallows its error and returns
  `{"error": ...}` looks like a success to LangGraph and would never be retried.
- Raising also means a failure can never silently let the graph continue with broken state — the previous
  design let a failed researcher/producer/auditor step through to the next node with an `error` key nobody
  checked.

### 3 — Exhausted retries → persisted, resumable failure

If `RetryPolicy` exhausts its attempts, `NodeExecutionError` propagates out of `graph.ainvoke()` in
`tasks/campaign_runner.py`. `_persist_failure()` there sets `status="failed"`, and — only when the exception
is a `NodeExecutionError` — `resumable=True` and `failed_node=<node name>`. A permanent, non-node error
(e.g. business not found during `load_bko`) leaves `resumable=False`: relaunching is the only option.

### 4 — Manual retry re-enters the checkpoint

```
POST /campaigns/{id}/retry
   │  gated on status=="failed" AND resumable==True
   ▼
campaign_service.retry()
   │  flips status → "running" synchronously (prevents double-clicks;
   │  the stored procedure's CASE logic clears resumable/failed_node on this transition)
   ▼
tasks.campaign_runner.run_retry()
   │  graph.ainvoke(None, config={"configurable": {"thread_id": campaign_id}})
   │  passing None (not a fresh initial_state) tells LangGraph to continue from
   │  the thread's last checkpoint — NOT to start over
   ▼
LangGraph resumes exactly at the failed node.
Steps that already completed (research, an approved strategy) are never re-run.
```

This was verified end-to-end against a real failure: a campaign that failed at `run_strategist` after 4
automatic retries was resumed via `/retry`, and the retry re-entered *only* `run_strategist` — the prior
researcher output was untouched and not re-generated.

---

## 9. Agent Layer

Every agent is an instance of the same `AgentBuilder` factory (system prompt + tools + skills → a LangGraph
`create_react_agent`). That universal pattern — tool/skill layering, standalone execution, the LLM factory —
is documented in full in [AGENT_ARCHITECTURE.md](./AGENT_ARCHITECTURE.md); this section only tracks what
exists today and each agent's role in the pipeline.

| Agent | Status | Role |
|---|---|---|
| **Researcher** | ✅ Built | Single ReAct agent (`web_search`, `scrape_url`, `retrieve_past_campaigns` tools). Turns the BKO + campaign brief into a `ResearchReport`: competitor patterns, platform specs, audience intelligence, recommended angles. **Known gap:** no schema validation or repair loop yet — a malformed/fenced JSON response falls back to a raw-text wrapper rather than being retried, and platform coverage isn't checked (a requested platform can silently get no research). |
| **Strategist** | ✅ Built (v2) | Not a single ReAct agent — a 3-stage pipeline: a planning agent decides asset distribution and campaign narrative, three specialist skills (static/video/email) write copy in parallel with domain-specific playbooks, and a pure-code assembly stage validates the result against the campaign brief and repairs narrow violations before persisting. Full detail: [agents/STRATEGIST_AGENT_V2.md](./agents/STRATEGIST_AGENT_V2.md). |
| **Producer** | 🚧 Partially built | `ProducerPipeline` (`agents/producer/graph.py`) routes `strategy_doc.asset_plan` entries by `asset_type`. **static_image is built**: a 2-phase sub-agent — one LLM call writes a production-grade nano-banana prompt (superseding the Strategist's draft `image_prompt`), then pure code resolves the real logo/product image via `resolve_brand_assets()` and calls `utils/MediaGen` (`nano-banana-pro`). Full design: [agents/STATIC_AD_AGENT.md](./agents/STATIC_AD_AGENT.md). **video_ad and email sub-agents are not built** — no video/voice generation provider exists yet (see [agents/BUILDER_AGENT_DATA_AUDIT.md](./agents/BUILDER_AGENT_DATA_AUDIT.md)); those `asset_plan` entries are logged and omitted rather than faked. Each produced asset is persisted via `sp_create_asset` and its `storage_url` recorded. |
| **Auditor** | 🔜 Prospected | Scores every asset the Producer generates on three weighted dimensions — brand alignment (0.40, tone/visual style vs. BKO identity and `donts`), hook strength (0.35, first-frame/first-line attention capture), platform fit (0.25, format/pacing/aesthetic vs. platform norms) — via multimodal scoring for visual assets and text scoring for copy. Aggregates a weighted average per asset and decides: pass (`assets_approved`) or send back to the Producer with a structured critique (`assets_rejected`), bounded by `retry_count <= 2` before forcing the campaign to human review regardless of score. |

### Agent → orchestrator contract

The orchestrator calls `agent.ainvoke({"messages": [HumanMessage(...)]})` (or, for the Strategist,
`strategist_pipeline.ainvoke(state, on_event=...)`) and reads a single structured key back
(`research_report`, `strategy_doc`, `generated_assets`, `audit_results`). Nothing about how many tools an
agent uses, or whether it's a single ReAct loop vs. a multi-stage pipeline, is visible to the orchestrator —
this is what let the Strategist be rebuilt from a monolithic agent into a 3-stage pipeline without touching
`orchestrator/graph.py`'s node wiring at all, only the node body.

---

## 10. Memory System

Three tiers, no memory system lives outside PostgreSQL:

| Tier | What it is | Status |
|---|---|---|
| **Working memory** | `CampaignState`, auto-checkpointed by `AsyncPostgresSaver` after every node | ✅ Live — this is also what powers durable retry (§8) |
| **Episodic memory** | Past campaigns for a business, retrieved by similarity to the current objective | 🚧 Table exists (`business_embeddings`, `pgvector` column, dim 768), but `retrieve_past_campaigns` (the tool every agent that wants this calls) is currently a stub that always returns *"no past campaign data found"* — embeddings are never written or queried yet |
| **Business memory (BKO)** | The full BKO injected directly into every agent's prompt | ✅ Live — no retrieval step, no chunking; see §5 |

### Planned post-campaign write-back (not yet implemented)

The intended design: after a campaign is approved, append a summary (top hook, alignment score, platform) to
episodic memory and re-embed, so future campaigns for the same business can learn from what worked. This
does not happen today — there is no write path into `business_embeddings` anywhere in the codebase yet.

---

## 11. Human-in-the-Loop

Three real interrupt points, all implemented via LangGraph's native `interrupt()` / `Command(resume=...)` —
**not** the `human_reviews` table (that table and its model exist in the schema and migration but are not
read or written by any application code today; HITL state lives entirely in `campaign_events` +
the LangGraph checkpoint).

| Checkpoint | Node | User sees | Resume payload |
|---|---|---|---|
| Research review | `hitl_research_review` | Full `ResearchReport` | `{approved, feedback}` |
| Plan approval | `hitl_plan_approval` | Full `StrategyDoc` (all assets, copy, visual briefs) | `{approved, feedback}` — rejection re-enters `run_strategist` in **revision mode**: only the assets the feedback names are regenerated, everything else is kept verbatim |
| Asset review | `hitl_asset_review` | Generated assets + audit scores | `{approved, feedback}` |

### Mechanics

```
Node calls interrupt({"checkpoint": "..."})
   │  graph.ainvoke() pauses; the campaign's status is set to "awaiting_review"
   │  and a hitl_required SSE event carries the full review payload
   ▼
Frontend renders the appropriate review panel, user responds
   │
   ▼
POST /campaigns/{id}/resume {approved, feedback}
   │  campaign_service.resume() validates status == "awaiting_review",
   │  schedules tasks.campaign_runner.run_resume() as a BackgroundTask
   ▼
graph.ainvoke(Command(resume=hitl_response), config={"thread_id": campaign_id})
   │  the paused interrupt() call returns hitl_response; the node continues
   ▼
Graph proceeds to whatever comes next per the routing table in §7
```

---

## 12. Streaming & Real-Time Events

Server-Sent Events (`GET /api/v1/stream/campaigns/{id}`), not WebSocket. Backed by PostgreSQL
`LISTEN`/`NOTIFY`, with one deliberate design choice that fixed a real production bug: **`NOTIFY` carries
only a slim envelope, never the full event payload.**

### Why

`pg_notify()` payloads are hard-capped at 8000 bytes by PostgreSQL itself. Early on, a `hitl_required` event
carrying a full ~10KB research report inside the `NOTIFY` payload hit that cap and crashed the campaign with
`payload string too long` — the exact moment a real agent output first got large enough to matter.

### How it works now

```
Agent/orchestrator node ──► streaming_service.emit()
                                  │
                                  ▼
                    sp_insert_campaign_event(...)
                    INSERTs the full row into campaign_events (no size limit — JSONB)
                    NOTIFYs campaign_{id} with only {id, seq, event_type, agent}  (~100 bytes)
                                  │
                                  ▼
                    SSE endpoint, LISTEN-ing on campaign_{id}
                    on notification → re-reads full rows from the DB by seq
                    (also naturally de-dupes a burst of notifications into one fetch)
                                  │
                                  ▼
                    yields full event objects as `text/event-stream` to the client
```

Reconnects work the same way: the client passes `?after_seq=N` (the last `seq` it saw), and catch-up replay
uses the identical `get_events(after_seq=...)` query the live path uses — there is only one code path for
"give me events after N," used both for reconnect and for live delivery.

### Event vocabulary

`event_type` is DB-constrained to: `agent_started`, `agent_completed`, `agent_error`, `tool_call`,
`tool_result`, `status_changed`, `hitl_required`, `campaign_done`, `campaign_failed` (plus legacy aliases
`agent_start`/`agent_done`/`human_review_required` retained for backward compatibility). `agent` is
constrained to `researcher`, `strategist`, `producer`, `auditor`, `orchestrator`, `system`.

---

## 13. Database Schema

Single PostgreSQL 16 database (`adgen`), `pgvector` extension enabled. **3 Alembic migrations to date:**
`0fcc9913fd20` (initial schema), `4cb5eeb9d42f` (campaign brief fields: `campaign_name`, `objective`,
`funnel_stage`, `num_variants`, `special_brief`, `hero_products`, `tone_override`, `asset_types`; extended
`assets.asset_type` to include `email`), `7a3f9c2e5b1d` (durable-retry fields: `resumable`, `failed_node`).

| Table | Purpose | Key columns beyond `id`/timestamps |
|---|---|---|
| `users` | Accounts | email (unique), name, password_hash |
| `refresh_tokens` | Revocable refresh tokens | user_id, token_hash (unique), expires_at, revoked |
| `businesses` | BKO storage | user_id, name, `bko JSONB`, bko_version, onboarding_status |
| `business_embeddings` | Episodic memory (not yet populated) | business_id, campaign_id (nullable), content_type (`bko`\|`campaign_summary`), `embedding vector(768)`, metadata |
| `campaigns` | One row per campaign run | business_id, user_id, campaign_name, objective, platforms[], asset_types[], funnel_stage, num_variants, hero_products[], tone_override, special_brief, status, strategy_doc JSONB, retry_count, audit_score, error, **resumable, failed_node** |
| `campaign_events` | Append-only agent activity log | campaign_id, `seq` (`GENERATED ALWAYS AS IDENTITY` — guarantees ordering), event_type, agent, payload JSONB |
| `assets` | Generated files | campaign_id, platform, format, asset_type (`image`\|`video`\|`voice`\|`email`), storage_url, prompt_used, status |
| `audit_logs` | Per-asset score history | asset_id, campaign_id, iteration, brand_score, hook_score, platform_score, weighted_avg, critique |
| `human_reviews` | Defined but **unused** — HITL runs entirely on LangGraph's checkpoint + `campaign_events` instead (§11) | interrupt_type, payload, approved, feedback |

### Conventions

- All primary keys are `UUID DEFAULT gen_random_uuid()` — no sequential IDs, avoids enumeration.
- Status-like columns are `TEXT` + `CHECK` constraints, not native `ENUM` — easier to extend without a
  migration that touches the type itself.
- `campaigns.id` doubles as the LangGraph checkpointer's `thread_id` — a direct, one-to-one link between a
  DB row and its graph execution history.
- `sp_insert_campaign_event` does the `INSERT` and the `pg_notify()` in a single stored procedure call —
  see §12 for why the notify payload is deliberately minimal.

---

## 14. API Reference

**Base URL:** `/api/v1`. All routes except signup/login/refresh/logout/admin require `Authorization: Bearer <token>`.

**Error shape:** `{"error": "ERROR_CODE", "message": "...", "detail": null}` — a global exception handler
maps an `AppError` subclass hierarchy (`NotFoundError` → 404, `ConflictError` → 409, `UnauthorizedError` →
401, `ForbiddenError` → 403, `ValidationError` → 422, `ExternalServiceError` → 502) to this shape uniformly.

| Group | Endpoints |
|---|---|
| **Auth** | `POST /auth/{signup,login,refresh,logout,logout-all}`, `GET /auth/me` |
| **Businesses** | `POST /businesses`, `GET /businesses`, `GET /businesses/{id}`, `PATCH /businesses/{id}`, `DELETE /businesses/{id}` |
| **Campaigns** | `POST /campaigns`, `GET /campaigns?business_id=`, `GET /campaigns/{id}`, `GET /campaigns/{id}/events`, `GET /campaigns/{id}/assets`, `POST /campaigns/{id}/resume`, `POST /campaigns/{id}/retry`, `DELETE /campaigns/{id}` |
| **Streaming** | `GET /stream/campaigns/{id}?after_seq=` (SSE) |
| **Agents (standalone testing)** | `POST /agents/researcher`, `POST /agents/strategist` — each runs one agent in isolation, either `from_db` (loads a real business/campaign) or `inline` (raw BKO + research_report payload, no DB records needed) |
| **Admin** | `POST /admin/load-procedures` — idempotent reload of all stored procedures without restarting the app |

---

## 15. Directory Structure

```
adGen-agentic/
├── api/
│   ├── main.py                  # FastAPI app, lifespan (loads SPs, builds+compiles the LangGraph graph)
│   ├── dependencies.py          # get_current_user, get_db
│   ├── middleware/{auth,rate_limit}.py
│   └── routes/                  # auth, businesses, campaigns, stream, agents, admin — thin only
│
├── orchestrator/
│   ├── graph.py                 # build_graph() — nodes, RetryPolicy, conditional edges
│   ├── state.py                 # CampaignState TypedDict
│   ├── nodes.py                 # load_bko, run_*, hitl_*, campaign_done/failed, NodeExecutionError
│   ├── edges.py                 # route_after_strategist/plan_approval/audit/review
│   └── checkpointer.py          # AsyncPostgresSaver DSN helper
│
├── agents/
│   ├── researcher/               # agent.py, prompts.py, schemas.py, skills.py
│   ├── strategist/                # agent.py (planner), graph.py (3-stage pipeline),
│   │                              # prompts.py, playbooks.py, skills.py, schemas.py, validation.py
│   ├── producer/                 # asset-generation sub-agent routing (§9)
│   └── auditor/                  # asset scoring + retry decisioning (§9)
│
├── tools/                        # global @tool functions, registered in tools/__init__.py's lazy registry
├── utils/
│   ├── LLM/                      # LLMConfig, factory (provider dispatch), providers/{kie,gemini,openai,huggingface}.py
│   ├── MediaGen/                 # same provider-factory pattern for image/video generation
│   └── retry.py                  # is_transient(), call_with_retries() — shared transient-failure detection
│
├── services/                     # business logic — auth, business, bko, campaign, streaming
├── repos/                        # DB access — stored-procedure calls only
├── schemas/                      # Pydantic request/response models
├── sql/{auth,business,campaign}/ # all stored procedures, loaded at startup
├── db/
│   ├── models/                   # SQLAlchemy ORM models (schema definition + reflection, not used for writes)
│   ├── session.py
│   └── migrations/versions/      # 3 Alembic revisions
│
├── tasks/campaign_runner.py       # run_pipeline / run_resume / run_retry — BackgroundTask entry points
├── memory/                        # reserved for episodic-memory embedding logic (not yet implemented)
├── generations/{campaign_id}/     # local JSON artifacts per campaign (research_report, strategy_doc, ...)
├── frontend/                      # Next.js 16 app — REST + SSE client, no agent logic
├── examples/                      # sample BKO + campaign input payloads
└── docs/
    ├── ARCHITECTURE.md            # this file
    ├── AGENT_ARCHITECTURE.md      # universal agent pattern (AgentBuilder, tools/skills, LLM factory)
    ├── agents/STRATEGIST_AGENT_V2.md
    ├── agents/STATIC_AD_AGENT.md
    ├── agents/EMAIL_TEMPLATE_AGENT.md
    ├── agents/BUILDER_AGENT_DATA_AUDIT.md
    ├── DATABASE.md, CAMPAIGN_PIPELINE.md, BUILT_SO_FAR.md  # older reference docs — not all current
```

---

## 16. Build Status

- Auth (signup/login/refresh/logout), business onboarding (form path), BKO completeness scoring
- Campaign CRUD + full brief fields
- LangGraph orchestrator with all 3 HITL checkpoints wired, plan-rejection revision routing
- **Durable execution**: `RetryPolicy` on all 4 agent nodes, `NodeExecutionError` propagation,
  `resumable`/`failed_node` tracking, `/retry` endpoint — verified end-to-end against a real induced failure
- Researcher agent (single ReAct agent, 3 tools)
- Strategist agent v2 (plan → produce → assemble pipeline, per-domain copy playbooks, validation + repair
  loop, targeted HITL revision)
- SSE streaming with the slim-envelope fix (no more 8000-byte `NOTIFY` crashes)
- Stored-procedure-only DB access pattern, hot-reloadable via `/admin/load-procedures`
