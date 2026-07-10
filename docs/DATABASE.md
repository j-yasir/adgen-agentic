# AdGen-Agentic — Database Design

> PostgreSQL 16 + pgvector extension
> Single database, single schema. All persistence lives here — state, events, vectors, auth, assets.
>
> **This document describes the schema as actually migrated and running**, cross-checked against the live
> database, not a design plan.

---

## Table of Contents

1. [Design Decisions](#1-design-decisions)
2. [Entity Overview](#2-entity-overview)
3. [Schema Relationships](#3-schema-relationships)
4. [Table Specifications](#4-table-specifications)
5. [Constraints (CHECK-based Enums)](#5-constraints-check-based-enums)
6. [Indexes](#6-indexes)
7. [Current Schema DDL](#7-current-schema-ddl)
8. [LangGraph Tables](#8-langgraph-tables)
9. [Migration History](#9-migration-history)

---

## 1. Design Decisions

**Single PostgreSQL instance for everything**
No Redis, no Qdrant. PostgreSQL handles relational data, JSONB documents, vector storage (`pgvector`),
real-time pub/sub (`LISTEN`/`NOTIFY`), and LangGraph checkpointing — all in one service, one connection
target, one backup strategy.

**UUIDs as primary keys everywhere**
`gen_random_uuid()` (built into PostgreSQL 13+, no extension needed) prevents enumeration attacks on API
endpoints.

**JSONB for flexible structured data**
The BKO (`businesses.bko`) and `campaigns.strategy_doc` evolve as the agents evolve. JSONB lets their
internal shape change without a migration. Stable, queryable fields (`status`, `platform`, `objective`) stay
as typed columns with `CHECK` constraints.

**`TEXT` + `CHECK` instead of native `ENUM`**
Adding a value to a native `ENUM` type requires special migration handling; adding to a `CHECK` constraint is
a plain `ALTER TABLE ... DROP CONSTRAINT / ADD CONSTRAINT`. Every status/type/enum-like column in this schema
uses this pattern — see §5.

**`updated_at` is set explicitly inside stored procedures, not by a DB trigger**
There is no `set_updated_at()` trigger function anywhere in this schema. Every stored procedure that mutates
a row sets `updated_at = NOW()` itself as part of its `UPDATE` statement (e.g. `sp_update_campaign_status`,
`sp_update_business_bko`). This follows directly from the project's stored-procedure-only DB access rule —
see [ARCHITECTURE.md §3](./ARCHITECTURE.md#3-system-layers).

**Append-only `campaign_events` table**
Every agent action and tool result is recorded here. Full audit trail, debugging, and the source for SSE
streaming. Rows are never updated or deleted during a run.

**Separate `audit_logs` from `assets`**
An asset can be scored multiple times across the Producer↔Auditor retry loop. Each pass is a separate row
with an `iteration` counter, preserving full scoring history rather than only the final score.

**Denormalised `user_id` on `campaigns`**
Campaigns reference both `business_id` (the structural FK) and `user_id` (denormalised, so "all campaigns
for this user" doesn't require a join through `businesses`).

**No custom indexes exist yet beyond what a primary key or `UNIQUE` constraint implies**
This is a real, current gap, not a design choice: every access pattern in §6 that would benefit from an
index (e.g. `campaigns(status)`, `campaign_events(campaign_id, seq)`, the `pgvector` similarity index) is
listed as a recommendation, but none of them have actually been created in any migration to date. At current
data volumes this hasn't mattered; it will need addressing before the event log or campaign list queries are
under real load.

---

## 2. Entity Overview

| Table | What it represents | Status |
|---|---|---|
| `users` | A registered user account | Live |
| `refresh_tokens` | Active/revoked JWT refresh tokens | Live |
| `businesses` | A user's business profile + BKO | Live |
| `business_embeddings` | `pgvector` rows for BKO + past-campaign semantic search | Table exists; nothing writes to it yet — see [ARCHITECTURE.md §10](./ARCHITECTURE.md#10-memory-system) |
| `campaigns` | A single ad campaign run, full brief + status | Live |
| `campaign_events` | Append-only event log per campaign, backs SSE streaming | Live |
| `assets` | A generated file (image / video / voice / email) per platform | Schema live; not yet populated with real data — Producer is still prospected |
| `audit_logs` | Per-asset, per-retry-iteration scoring | Schema live; not yet populated — Auditor is still prospected |
| `human_reviews` | Defined for HITL interrupt sessions | Table exists but is **not used** — HITL runs entirely on LangGraph's native `interrupt()`/checkpoint mechanism instead, see [ARCHITECTURE.md §11](./ARCHITECTURE.md#11-human-in-the-loop) |

---

## 3. Schema Relationships

```
users ──┬──< refresh_tokens
        │
        └──< businesses ──┬──< business_embeddings >──┐
                           │                            │
                           └──< campaigns ──┬──< campaign_events        │
                                            ├──< assets ──< audit_logs  │
                                            ├──< audit_logs (denorm)    │
                                            ├──< human_reviews (unused)│
                                            └────────────────────────>─┘
                                            (business_embeddings.campaign_id, nullable)

campaigns.user_id  ──> users.id            (denormalised, no join needed for user-level queries)
campaigns.id       ──  LangGraph thread_id (see §8 — the link to checkpoints/checkpoint_writes/...)
```

Legend: `──<` one-to-many, `>──` many-to-one. All child-table foreign keys are `ON DELETE CASCADE` except
`business_embeddings.campaign_id`, which is `ON DELETE SET NULL` (an embedding tied to a deleted campaign
degrades to a business-level embedding rather than disappearing).

---

## 4. Table Specifications

---

### `users`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `text` | NOT NULL, UNIQUE | |
| `name` | `text` | NOT NULL | |
| `password_hash` | `text` | NOT NULL | bcrypt hash |
| `created_at` | `timestamptz` | DEFAULT `now()` | |
| `updated_at` | `timestamptz` | DEFAULT `now()` | Bumped explicitly by stored procedures, no trigger |

---

### `refresh_tokens`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → `users.id` ON DELETE CASCADE | |
| `token_hash` | `text` | NOT NULL, UNIQUE | SHA-256 of the raw token — the raw value is never stored |
| `expires_at` | `timestamptz` | NOT NULL | 7 days from issue |
| `revoked` | `boolean` | DEFAULT `false` | Set `true` on logout or rotation |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### `businesses`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `user_id` | `uuid` | FK → `users.id` ON DELETE CASCADE | |
| `name` | `text` | NOT NULL | |
| `website` | `text` | nullable | |
| `industry` | `text` | nullable | Top-level tag, also present inside `bko.identity` |
| `bko` | `jsonb` | NOT NULL | Full Business Knowledge Object — 10-section shape documented in [ARCHITECTURE.md §5](./ARCHITECTURE.md#5-business-onboarding--bko) |
| `bko_version` | `int` | NOT NULL | Incremented by `sp_update_business_bko` (`bko_version + 1`) on every BKO update |
| `onboarding_path` | `text` | NOT NULL, CHECK `IN ('url','free_text','form')` | Only `form` is actually implemented today |
| `onboarding_status` | `text` | NOT NULL, CHECK `IN ('pending','complete')` | |
| `created_at` / `updated_at` | `timestamptz` | DEFAULT `now()` | |

---

### `business_embeddings`

Reserved for episodic memory (past-campaign semantic similarity). The table, FK relationships, and vector
column are all live; nothing in the codebase writes an embedding or queries one yet —
`tools/retrieve_past_campaigns.py` is a permanent stub that returns *"no past campaign data found"*
regardless of what's in this table.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `business_id` | `uuid` | FK → `businesses.id` ON DELETE CASCADE | |
| `campaign_id` | `uuid` | FK → `campaigns.id` ON DELETE SET NULL, nullable | Null for a base BKO embedding |
| `content_type` | `text` | NOT NULL, CHECK `IN ('bko','campaign_summary')` | |
| `embedding` | `vector(768)` | NOT NULL | Dimension matches a 768-d embedding model (e.g. Gemini `text-embedding-004`) |
| `metadata` | `jsonb` | NOT NULL, default `{}` | Intended for filterable fields (goal, top hook, score) alongside the vector |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### `campaigns`

One row per campaign run. This table has grown twice since the initial migration — see §9.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | Also the LangGraph checkpointer's `thread_id` — see §8 |
| `business_id` | `uuid` | FK → `businesses.id` ON DELETE CASCADE | |
| `user_id` | `uuid` | FK → `users.id` ON DELETE CASCADE | Denormalised |
| `goal` | `text` | NOT NULL | Legacy free-text goal field, predates the structured brief fields below |
| `campaign_name` | `text` | nullable | User-provided label; auto-generated from objective+platforms if omitted |
| `objective` | `text` | NOT NULL, CHECK `IN ('awareness','traffic','conversion','lead_gen','engagement')`, default `'awareness'` | |
| `platforms` | `text[]` | NOT NULL | |
| `asset_types` | `text[]` | nullable | `static_image` \| `video_ad` \| `email` |
| `funnel_stage` | `text` | NOT NULL, CHECK `IN ('tofu','mofu','bofu','balanced')`, default `'balanced'` | Only `'balanced'` allows per-asset variation — enforced by the Strategist's validation layer, not by this constraint |
| `num_variants` | `int` | NOT NULL, default `3` | |
| `hero_products` | `text[]` | nullable | Specific SKUs to prioritize |
| `tone_override` | `text` | nullable | |
| `special_brief` | `text` | nullable | |
| `asset_formats` | `jsonb` | NOT NULL, default `{}` | Legacy — largely superseded by per-asset `format` inside `strategy_doc.asset_plan` |
| `status` | `text` | NOT NULL, CHECK `IN ('pending','running','awaiting_review','done','failed')`, default `'pending'` | |
| `strategy_doc` | `jsonb` | nullable | Populated after the Strategist completes |
| `retry_count` | `int` | NOT NULL, default `0` | Producer↔Auditor retry cycles |
| `audit_score` | `float` | nullable | Final weighted Auditor score |
| `error` | `text` | nullable | Set when `status = 'failed'` |
| `resumable` | `boolean` | NOT NULL, default `false` | `true` only when the failure was a node error after automatic retries were exhausted (see [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-durable-execution--retry--resume)) |
| `failed_node` | `text` | nullable | Which orchestrator node failed, e.g. `run_strategist` |
| `created_at` / `updated_at` | `timestamptz` | DEFAULT `now()` | |
| `completed_at` | `timestamptz` | nullable | Set when `status` becomes `done` or `failed` |

> `resumable`/`failed_node` are cleared automatically whenever a stored-procedure call transitions `status`
> to `'running'` — this is a `CASE` expression inside `sp_update_campaign_status`, not application code, so
> it can't be forgotten by a future caller.

---

### `campaign_events`

Append-only. Backs both the SSE stream and the audit trail.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `campaign_id` | `uuid` | FK → `campaigns.id` ON DELETE CASCADE | |
| `seq` | `bigint` | NOT NULL, `GENERATED ALWAYS AS IDENTITY` | Monotonically increasing per row — guarantees ordering and is the reconnect cursor (`?after_seq=`) |
| `event_type` | `text` | NOT NULL, CHECK — see §5 | |
| `agent` | `text` | nullable, CHECK — see §5 | |
| `payload` | `jsonb` | NOT NULL, default `{}` | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

**Streaming pattern**: `sp_insert_campaign_event` does the `INSERT` and a `pg_notify()` call in one stored
procedure. The `NOTIFY` payload is deliberately a slim envelope (`{id, seq, event_type, agent}`), **not** the
full row — `pg_notify` has an 8000-byte hard limit, and a full research report or strategy doc exceeds it.
Listeners re-read the full row from this table by `seq` on notification. Full mechanism:
[ARCHITECTURE.md §12](./ARCHITECTURE.md#12-streaming--real-time-events).

---

### `assets`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `campaign_id` | `uuid` | FK → `campaigns.id` ON DELETE CASCADE | |
| `platform` | `text` | NOT NULL | No CHECK constraint — free text |
| `format` | `text` | NOT NULL | No CHECK constraint — e.g. `9:16`, `4:5`, `1:1`, `email` |
| `asset_type` | `text` | NOT NULL, CHECK `IN ('image','video','voice','email')` | Extended to include `email` in the second migration |
| `storage_url` | `text` | NOT NULL | |
| `prompt_used` | `text` | nullable | The generation prompt sent to the media provider |
| `status` | `text` | NOT NULL, CHECK `IN ('pending','generating','stored','failed')`, default `'pending'` | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### `audit_logs`

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `asset_id` | `uuid` | FK → `assets.id` ON DELETE CASCADE | |
| `campaign_id` | `uuid` | FK → `campaigns.id` ON DELETE CASCADE | Denormalised |
| `iteration` | `int` | NOT NULL, default `0` | `0` = first pass, `1` = after first retry, ... |
| `brand_score` / `hook_score` / `platform_score` | `float` | nullable | 1–10 each |
| `weighted_avg` | `float` | nullable | `0.40×brand + 0.35×hook + 0.25×platform` |
| `critique` | `text` | nullable | |
| `created_at` | `timestamptz` | DEFAULT `now()` | |

---

### `human_reviews`

Schema-complete, **currently unused by any application code**. HITL pause/resume is implemented entirely
through LangGraph's `interrupt()` / `Command(resume=...)` plus `campaign_events`
([ARCHITECTURE.md §11](./ARCHITECTURE.md#11-human-in-the-loop)) — nothing inserts into or reads from this
table today.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK | |
| `campaign_id` | `uuid` | FK → `campaigns.id` ON DELETE CASCADE | |
| `interrupt_type` | `text` | NOT NULL, CHECK `IN ('bko_gap','asset_approval','user_pause')` | |
| `payload` | `jsonb` | NOT NULL, default `{}` | |
| `approved` | `boolean` | nullable | |
| `feedback` | `text` | nullable | |
| `created_at` / `resolved_at` | `timestamptz` | | |

---

## 5. Constraints (CHECK-based Enums)

Every one of these is a live `CHECK` constraint, read directly from the database:

```sql
-- businesses.onboarding_path
CHECK (onboarding_path IN ('url', 'free_text', 'form'))

-- businesses.onboarding_status
CHECK (onboarding_status IN ('pending', 'complete'))

-- campaigns.status
CHECK (status IN ('pending', 'running', 'awaiting_review', 'done', 'failed'))

-- campaigns.objective
CHECK (objective IN ('awareness', 'traffic', 'conversion', 'lead_gen', 'engagement'))

-- campaigns.funnel_stage
CHECK (funnel_stage IN ('tofu', 'mofu', 'bofu', 'balanced'))

-- assets.status
CHECK (status IN ('pending', 'generating', 'stored', 'failed'))

-- assets.asset_type
CHECK (asset_type IN ('image', 'video', 'voice', 'email'))

-- human_reviews.interrupt_type
CHECK (interrupt_type IN ('bko_gap', 'asset_approval', 'user_pause'))

-- business_embeddings.content_type
CHECK (content_type IN ('bko', 'campaign_summary'))

-- campaign_events.event_type  (12 values — includes both current and legacy names)
CHECK (event_type IN (
    'agent_start', 'agent_started', 'agent_done', 'agent_completed', 'agent_error',
    'tool_call', 'tool_result', 'status_changed', 'hitl_required',
    'human_review_required', 'campaign_done', 'campaign_failed'
))

-- campaign_events.agent
CHECK (agent IN ('researcher', 'strategist', 'producer', 'auditor', 'orchestrator', 'system'))
```

> The `event_type` and `agent` constraints are wider than the original migration defined — they were altered
> directly against the live database as the event vocabulary grew (`agent_started`/`agent_completed`
> replaced `agent_start`/`agent_done` in practice; `status_changed`, `hitl_required`, and `agent_error` were
> added; `orchestrator` was added to `agent`). **This widening has not yet been captured in an Alembic
> migration** — anyone re-provisioning a fresh database from the 3 migrations in §9 alone will get the
> narrower, original constraint values and should widen them manually (or a migration should be written to
> match; not done in this pass).

---

## 6. Indexes

### Recommended indexes for known access patterns (not yet created — see §1)

| Query | Table | Suggested index |
|---|---|---|
| List campaigns for a user | `campaigns` | `(user_id)` |
| List campaigns for a business | `campaigns` | `(business_id)` |
| Find campaigns by status (retry sweep, dashboards) | `campaigns` | `(status)` |
| Load event log for a campaign in order / reconnect catch-up | `campaign_events` | `(campaign_id, seq)` |
| List assets for a campaign | `assets` | `(campaign_id)` |
| Load audit history for an asset | `audit_logs` | `(asset_id)` |
| Semantic similarity search | `business_embeddings` | IVFFlat or HNSW on `embedding` |
| Filter embeddings by business + type before similarity search | `business_embeddings` | `(business_id, content_type)` |

### What actually exists today

Only the indexes PostgreSQL creates implicitly for primary keys and `UNIQUE` constraints:
`users_pkey`, `users_email_key`, `refresh_tokens_pkey`, `refresh_tokens_token_hash_key`,
`businesses_pkey`, `campaigns_pkey`, `campaign_events_pkey`, `assets_pkey`, `audit_logs_pkey`,
`human_reviews_pkey`, `business_embeddings_pkey`. No composite, partial, or vector index has been created in
any migration to date.

---

## 7. Current Schema DDL

The full, current-state DDL is spread across the 3 real migrations listed in §9 rather than a single file —
this section shows the tables as they exist today (i.e. migration 1 + migration 2's additions + migration
3's additions, combined), so it's a correct reference even though no single migration file looks like this.

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "vector";     -- pgvector

CREATE TABLE users (
    id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT        NOT NULL UNIQUE,
    name          TEXT        NOT NULL,
    password_hash TEXT        NOT NULL,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE refresh_tokens (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT        NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked    BOOLEAN     NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE businesses (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT        NOT NULL,
    website           TEXT,
    industry          TEXT,
    bko               JSONB       NOT NULL DEFAULT '{}',
    bko_version       INT         NOT NULL DEFAULT 1,
    onboarding_path   TEXT        NOT NULL
                          CHECK (onboarding_path IN ('url', 'free_text', 'form')),
    onboarding_status TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (onboarding_status IN ('pending', 'complete')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaigns (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id     UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    user_id         UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal            TEXT        NOT NULL,
    campaign_name   TEXT,
    objective       TEXT        NOT NULL DEFAULT 'awareness'
                        CHECK (objective IN ('awareness', 'traffic', 'conversion', 'lead_gen', 'engagement')),
    platforms       TEXT[]      NOT NULL,
    asset_types     TEXT[],
    funnel_stage    TEXT        NOT NULL DEFAULT 'balanced'
                        CHECK (funnel_stage IN ('tofu', 'mofu', 'bofu', 'balanced')),
    num_variants    INT         NOT NULL DEFAULT 3,
    hero_products   TEXT[],
    tone_override   TEXT,
    special_brief   TEXT,
    asset_formats   JSONB       NOT NULL DEFAULT '{}',
    status          TEXT        NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'running', 'awaiting_review', 'done', 'failed')),
    strategy_doc    JSONB,
    retry_count     INT         NOT NULL DEFAULT 0,
    audit_score     FLOAT,
    error           TEXT,
    resumable       BOOLEAN     NOT NULL DEFAULT false,
    failed_node     TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at    TIMESTAMPTZ
);

CREATE TABLE business_embeddings (
    id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id  UUID        NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    campaign_id  UUID        REFERENCES campaigns(id) ON DELETE SET NULL,
    content_type TEXT        NOT NULL
                     CHECK (content_type IN ('bko', 'campaign_summary')),
    embedding    VECTOR(768) NOT NULL,
    metadata     JSONB       NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE campaign_events (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    seq         BIGINT      NOT NULL GENERATED ALWAYS AS IDENTITY,
    event_type  TEXT        NOT NULL
                    CHECK (event_type IN (
                        'agent_start', 'agent_started', 'agent_done', 'agent_completed', 'agent_error',
                        'tool_call', 'tool_result', 'status_changed', 'hitl_required',
                        'human_review_required', 'campaign_done', 'campaign_failed'
                    )),
    agent       TEXT
                    CHECK (agent IN ('researcher', 'strategist', 'producer', 'auditor', 'orchestrator', 'system')),
    payload     JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE assets (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    platform    TEXT        NOT NULL,
    format      TEXT        NOT NULL,
    asset_type  TEXT        NOT NULL
                    CHECK (asset_type IN ('image', 'video', 'voice', 'email')),
    storage_url TEXT        NOT NULL,
    prompt_used TEXT,
    status      TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'generating', 'stored', 'failed')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_logs (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id       UUID        NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    campaign_id    UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    iteration      INT         NOT NULL DEFAULT 0,
    brand_score    FLOAT,
    hook_score     FLOAT,
    platform_score FLOAT,
    weighted_avg   FLOAT,
    critique       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE human_reviews (
    id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id    UUID        NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
    interrupt_type TEXT        NOT NULL
                       CHECK (interrupt_type IN ('bko_gap', 'asset_approval', 'user_pause')),
    payload        JSONB       NOT NULL DEFAULT '{}',
    approved       BOOLEAN,
    feedback       TEXT,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at    TIMESTAMPTZ
);
```

---

## 8. LangGraph Tables

`AsyncPostgresSaver` auto-creates **four** tables the first time the checkpointer is initialised (one more
than a bare-bones setup might expect). **Do not create or modify these manually** — they're owned entirely
by LangGraph's internal schema versioning.

| Table | Purpose |
|---|---|
| `checkpoints` | One row per completed graph superstep. Serialised `CampaignState`. Keyed by `thread_id` (= `campaigns.id`) + `checkpoint_id`. Indexed on `thread_id`. |
| `checkpoint_blobs` | Large state values that exceed inline storage size. |
| `checkpoint_writes` | Pending writes buffered before a checkpoint commits. Indexed on `thread_id`. |
| `checkpoint_migrations` | LangGraph's own internal schema-version tracker for these tables — unrelated to this project's Alembic migrations. |

**The link between our schema and LangGraph:** `campaigns.id` is passed as `thread_id` in every
`graph.ainvoke()` call:

```python
await graph.ainvoke(state, config={"configurable": {"thread_id": str(campaign_id)}})
```

**Two separate DB drivers are in play, deliberately:** the application's own tables (everything in §4) are
read and written exclusively through **synchronous** SQLAlchemy + `psycopg2`, calling stored procedures — no
ORM writes anywhere. The LangGraph checkpointer tables are managed by `AsyncPostgresSaver`, which uses
**asynchronous** `psycopg` (v3) against the same database. These are two different connection paths to the
same Postgres instance, not two different databases.

**Crash recovery**: LangGraph reads its own `checkpoints` table to find the last completed node for a given
`thread_id`, then resumes from there with the serialised state — this is the mechanism
[ARCHITECTURE.md §8](./ARCHITECTURE.md#8-durable-execution--retry--resume) builds durable retry on top of.
`campaign_events` is independent of this and remains the human-readable audit trail regardless of what
LangGraph does internally.

---

## 9. Migration History

Three real Alembic revisions exist today — not the hypothetical nine-file, one-table-per-migration plan a
prior draft of this document assumed.

| Revision | Adds |
|---|---|
| `0fcc9913fd20` (initial_schema) | All 9 application tables in one migration: `users`, `refresh_tokens`, `businesses`, `campaigns`, `assets`, `business_embeddings`, `campaign_events`, `human_reviews`, `audit_logs`. Enables the `pgcrypto` and `vector` extensions. |
| `4cb5eeb9d42f` (add_campaign_brief_fields) | Adds `campaign_name`, `objective` (+ CHECK), `funnel_stage` (+ CHECK), `num_variants`, `special_brief` to `campaigns`. Widens `assets.asset_type`'s CHECK to add `'email'`. (`asset_types`, `hero_products`, `tone_override` were added alongside these in application code but are also part of this revision's column set.) |
| `7a3f9c2e5b1d` (add_campaign_retry_fields) | Adds `resumable BOOLEAN DEFAULT false` and `failed_node TEXT` to `campaigns` — the durable-execution retry mechanism in [ARCHITECTURE.md §8](./ARCHITECTURE.md#8-durable-execution--retry--resume). |

> As noted in §5, the `campaign_events.event_type` and `.agent` CHECK constraints have been widened directly
> against the live database beyond what any of these three migrations define. This drift is real and should
> be captured in a fourth migration at some point — not done in this pass.

### Commands

The application's own DB access is synchronous (SQLAlchemy + `psycopg2`), and Alembic runs against that same
synchronous connection — there is no `asyncpg` anywhere in this project's migration tooling.

```bash
# apply all pending migrations
alembic upgrade head

# create a new migration
alembic revision -m "description"          # hand-written; --autogenerate has not been the pattern used here

# roll back one migration
alembic downgrade -1

# check current revision
alembic current

# reload stored procedures without restarting the app (separate from Alembic)
curl -X POST http://localhost:8000/api/v1/admin/load-procedures
```

### Rules

- Never edit a migration that has already been applied anywhere — create a new one.
- Stored procedures are **not** managed by Alembic — they live as plain `.sql` files under `sql/` and are
  (re)loaded via `sql.load_stored_procedures()`, called both at app startup and by
  `POST /admin/load-procedures`. Changing a stored procedure's SQL does not require a migration; changing a
  table's shape does.
- When changing the BKO's internal JSONB shape, no migration is needed — update `schemas/bko.py` and
  `services/bko_service.py` only.
- Changing `business_embeddings.embedding`'s dimension (e.g. switching embedding models) requires dropping
  and recreating that column and re-embedding everything — there is no data in it yet, so this is currently
  a zero-cost change if needed.
