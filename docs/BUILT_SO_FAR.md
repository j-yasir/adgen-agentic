# AdGen-Agentic — What's Built So Far

> Implementation reference. Documents only what has been **fully coded and tested**.  
> For the full system design (including unbuilt parts), see [ARCHITECTURE.md](../ARCHITECTURE.md) and [DATABASE.md](./DATABASE.md).  
> For the campaign pipeline plan, see [CAMPAIGN_PIPELINE.md](./CAMPAIGN_PIPELINE.md).

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Architecture Pattern](#3-architecture-pattern)
4. [Directory Structure](#4-directory-structure)
5. [Database & Models](#5-database--models)
6. [Authentication System](#6-authentication-system)
7. [Business Onboarding & BKO](#7-business-onboarding--bko)
8. [Campaign Layer](#8-campaign-layer)
9. [API Endpoints Reference](#9-api-endpoints-reference)
10. [Stored Procedures](#10-stored-procedures)
11. [Error Handling & Logging](#11-error-handling--logging)
12. [Configuration](#12-configuration)
13. [Build Status](#13-build-status)

---

## 1. Project Overview

AdGen-Agentic is an autonomous multi-agent ad generation system. A user registers their business once through an onboarding form — this creates a **Business Knowledge Object (BKO)**, a rich structured document capturing everything about their business. When the user launches a campaign, a four-agent LangGraph pipeline (Researcher → Strategist → Producer → Auditor) uses the BKO to generate ad assets automatically, with the user staying in the loop at three HITL checkpoints.

**Core principle:** The user describes their business once. Every campaign is generated from that knowledge — no copy-writing required.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| API Framework | FastAPI 0.110+ |
| Language | Python 3.11+ |
| Database | PostgreSQL 16 + pgvector extension |
| ORM | SQLAlchemy 2.0 (psycopg2 driver) |
| Migrations | Alembic |
| Auth | JWT (HS256 access tokens) + bcrypt password hashing |
| Data validation | Pydantic v2 |
| Settings | pydantic-settings (`.env` file) |
| Agent framework | LangGraph (structure in place, not yet wired) |
| AI Provider | Google Gemini (configured, not yet called) |
| Storage | Local `generations/` folder (R2 later) |
| Dev server | Uvicorn with `--reload` |

> **Database:** `adgen` on `localhost:5432`. Never modify `sawain_db` — it is a separate, unrelated database on the same PostgreSQL instance.

---

## 3. Architecture Pattern

Every feature follows the same strict four-layer pattern:

```
Request
   │
   ▼
Router  (api/routes/)       ← thin; only calls one service method, returns response
   │
   ▼
Service (services/)         ← all business logic; raises AppError subclasses on failure
   │
   ▼
Repo    (repos/)            ← DB calls only; calls stored procedures via SQLAlchemy text()
   │
   ▼
Stored Procedure (sql/)     ← PL/pgSQL functions; all SQL lives here, never in Python
```

**Rules enforced throughout:**
- Routers never contain logic — one line per endpoint body.
- Services never write raw SQL — always call repo methods.
- Repos never contain business logic — only execute stored procs and return dicts.
- All SQL is in `.sql` files under `sql/`, not inline strings in Python.
- Stored procs use `CAST(:param AS JSONB)` for JSONB parameters — never `::jsonb` (breaks SQLAlchemy parameter binding with psycopg2).

---

## 4. Directory Structure

```
adGen-agentic/
├── api/
│   ├── main.py                   ← FastAPI app, lifespan, global exception handlers
│   ├── dependencies.py           ← get_current_user dependency (JWT → DB → user dict)
│   ├── middleware/
│   │   ├── auth.py
│   │   └── rate_limit.py
│   └── routes/
│       ├── auth.py               ← /api/v1/auth/* (6 endpoints) ✅
│       ├── businesses.py         ← /api/v1/businesses/* (5 endpoints) ✅
│       ├── campaigns.py          ← /api/v1/campaigns/* (7 endpoints) ✅
│       ├── admin.py              ← /api/v1/admin/load-procedures ✅
│       └── stream.py             ← (stub — Phase 2)
│
├── services/
│   ├── auth_service.py           ← signup, login, refresh, logout, logout_all ✅
│   ├── business_service.py       ← create, get_one, get_all, update, delete ✅
│   ├── bko_service.py            ← build_from_form(), completeness scoring ✅
│   ├── campaign_service.py       ← create, get_one, get_all, delete, resume, get_events, get_assets ✅
│   └── streaming_service.py      ← (stub — Phase 2)
│
├── repos/
│   ├── user_repo.py              ← create, get_by_email, get_by_id ✅
│   ├── refresh_token_repo.py     ← create, get_by_hash, revoke, revoke_all ✅
│   ├── business_repo.py          ← create, get_by_id, get_all_for_user, update_bko, delete ✅
│   └── campaign_repo.py          ← create, get_by_id, get_by_business, update_status, ✅
│                                    delete, insert_event, get_events, create_asset,
│                                    update_asset_status, get_assets
│
├── schemas/
│   ├── auth.py                   ← SignupRequest, LoginRequest, TokenResponse, etc. ✅
│   ├── bko.py                    ← Full BKO model (10 sections) ✅
│   ├── business.py               ← Form input sections + CreateBusinessRequest ✅
│   ├── campaign.py               ← CreateCampaignRequest, ResumeRequest, ✅
│   │                                CampaignResponse, AssetResponse, CampaignEventResponse
│   ├── asset.py                  ← (stub)
│   └── events.py                 ← (stub)
│
├── db/
│   ├── session.py                ← engine, SessionLocal, get_db() ✅
│   └── models/
│       ├── base.py               ✅
│       ├── user.py               ✅
│       ├── refresh_token.py      ✅
│       ├── business.py           ✅
│       ├── campaign.py           ✅
│       ├── campaign_event.py     ✅
│       ├── asset.py              ✅
│       ├── audit_log.py          ✅
│       ├── human_review.py       ✅
│       └── business_embedding.py ✅
│
├── sql/
│   ├── __init__.py               ← load_stored_procedures(): globs all *.sql on startup ✅
│   ├── auth/                     ← 7 stored procs ✅
│   ├── business/                 ← 5 stored procs ✅
│   └── campaign/                 ← 8 stored procs ✅
│
├── utils/
│   ├── logger.py                 ← get_logger(name) factory ✅
│   ├── exceptions.py             ← AppError hierarchy ✅
│   ├── jwt.py                    ← create/decode access token, refresh token helpers ✅
│   └── password.py               ← hash_password, verify_password (bcrypt) ✅
│
├── agents/                       ← Directory structure in place, files empty
│   ├── researcher/
│   ├── strategist/
│   ├── producer/
│   └── auditor/
│
├── orchestrator/                 ← Directory structure in place, files empty
├── memory/                       ← Directory structure in place, files empty
│
├── config.py                     ← Settings (pydantic-settings) ✅
├── scripts/backend_dev.sh        ← Activate venv + alembic upgrade head + uvicorn ✅
├── examples/
│   ├── bko_input_form.json       ← Sample BKO payload (Karakoram Kitchen, GB jams) ✅
│   └── campaign_input_form.json  ← Sample campaign payload (Eid 2026 push) ✅
└── docs/
    ├── DATABASE.md               ← Full DB schema reference ✅
    ├── CAMPAIGN_PIPELINE.md      ← Full campaign pipeline plan ✅
    └── BUILT_SO_FAR.md           ← This file
```

---

## 5. Database & Models

Full schema reference is in [DATABASE.md](./DATABASE.md).

### Migrations

| Revision | Description |
|---|---|
| `0fcc9913fd20` | Initial schema — all 9 tables, pgvector, indexes |
| `4cb5eeb9d42f` | Added `campaign_name`, `objective`, `funnel_stage`, `num_variants`, `special_brief` to `campaigns`; added `email` to `assets.asset_type` CHECK |

### Tables

| Table | Purpose | Status |
|---|---|---|
| `users` | User accounts | ✅ Live |
| `refresh_tokens` | JWT refresh token store | ✅ Live |
| `businesses` | Business profiles + BKO (JSONB) | ✅ Live |
| `business_embeddings` | pgvector rows (768-dim) | ✅ Live (empty) |
| `campaigns` | Campaign runs | ✅ Live |
| `campaign_events` | Append-only agent event log | ✅ Live |
| `assets` | Generated files (image/video/email) | ✅ Live (empty) |
| `audit_logs` | Per-asset audit scores per iteration | ✅ Live (empty) |
| `human_reviews` | HITL interrupt sessions | ✅ Live (empty) |

### Key design decisions
- All PKs are `UUID` (`gen_random_uuid()`) — prevents enumeration attacks.
- Status fields use `TEXT` + `CHECK` constraints, not PostgreSQL `ENUM` — easier to extend.
- `campaign_events.seq` uses `GENERATED ALWAYS AS IDENTITY` — monotonically increasing, guarantees ordering.
- `bko` stored as `JSONB` — schema evolves without migrations.
- `campaigns.id` doubles as LangGraph `thread_id` — direct link between our DB and LangGraph checkpoints.
- `asset_type` supports `image`, `video`, `voice`, `email`.

```mermaid
erDiagram
    users ||--o{ refresh_tokens : "has"
    users ||--o{ businesses : "owns"
    businesses ||--o{ campaigns : "runs"
    businesses ||--o{ business_embeddings : "embedded in"
    campaigns ||--o{ campaign_events : "logs to"
    campaigns ||--o{ assets : "produces"
    campaigns ||--o{ audit_logs : "scored in"
    campaigns ||--o{ human_reviews : "gated by"
    assets ||--o{ audit_logs : "scored per asset"

    users {
        uuid id PK
        text email UK
        text name
        text password_hash
    }
    businesses {
        uuid id PK
        uuid user_id FK
        text name
        jsonb bko
        int bko_version
        text onboarding_status
    }
    campaigns {
        uuid id PK
        uuid business_id FK
        uuid user_id FK
        text objective
        text[] platforms
        text funnel_stage
        int num_variants
        text special_brief
        text status
        jsonb strategy_doc
        float audit_score
    }
    assets {
        uuid id PK
        uuid campaign_id FK
        text platform
        text format
        text asset_type
        text storage_url
        text status
    }
    campaign_events {
        uuid id PK
        uuid campaign_id FK
        bigint seq
        text event_type
        text agent
        jsonb payload
    }
```

---

## 6. Authentication System

### Flow

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Router
    participant S as AuthService
    participant Rp as Repo
    participant DB as PostgreSQL

    Note over C,DB: Signup
    C->>R: POST /api/v1/auth/signup
    R->>S: signup(db, data)
    S->>Rp: get_by_email → None
    S->>S: hash_password()
    S->>Rp: user_repo.create()
    Rp->>DB: sp_create_user()
    R-->>C: 201 {user, access_token, refresh_token}

    Note over C,DB: Login
    C->>R: POST /api/v1/auth/login
    S->>S: verify_password() → JWT (15min) + refresh_token (7d)
    S->>Rp: refresh_token_repo.create(hash)
    R-->>C: 200 {access_token, refresh_token}

    Note over C,DB: Protected Request
    C->>R: Any protected endpoint [Bearer token]
    R->>R: get_current_user → decode JWT → user dict
    R-->>C: 200 response

    Note over C,DB: Token Refresh
    C->>R: POST /api/v1/auth/refresh
    S->>S: hash(raw) → lookup → revoke old → issue new pair
    R-->>C: 200 rotated token pair
```

### Token strategy
- **Access token:** HS256 JWT, 15-minute expiry.
- **Refresh token:** Cryptographically random → SHA-256 hash stored in DB. Raw sent to client, never stored. 7-day expiry with rotation on use.
- **Password hashing:** bcrypt via passlib. Pinned to `bcrypt==4.0.1` — version 5.x breaks passlib.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/auth/signup` | None | Register new user |
| POST | `/api/v1/auth/login` | None | Login, returns token pair |
| POST | `/api/v1/auth/refresh` | None | Rotate refresh token |
| POST | `/api/v1/auth/logout` | None | Revoke one refresh token |
| POST | `/api/v1/auth/logout-all` | Bearer | Revoke all tokens for user |
| GET | `/api/v1/auth/me` | Bearer | Get current user |

### Swagger examples
Both `SignupRequest` and `LoginRequest` have `json_schema_extra` examples prefilled with `yasir@example.com` / `Adgen@2026#Secure`.

---

## 7. Business Onboarding & BKO

### What is a BKO?

A **Business Knowledge Object** is a rich, structured JSONB document stored in `businesses.bko` — the single source of truth consumed by all four agents when generating a campaign.

### BKO Structure (10 sections)

| Section | Key fields |
|---|---|
| `identity` | company_name, business_type, industry, description, mission, tagline, brand_story |
| `offerings` | products_services[], hero_product, primary_cta, conversion_url, pricing |
| `audience` | primary segment (demographics, psychographics, behavioral, pain_points, objections) |
| `brand` | personality_traits, voice (tone, style, pov, examples), visual_identity (colors, fonts) |
| `competitive_position` | market_position, positioning_statement, competitors[], differentiators |
| `marketing_context` | platforms, funnel_strategy (tofu/mofu/bofu), budget_tier, preferred_cta_styles |
| `social_proof` | key_stats, testimonials[], guarantees, awards, notable_clients |
| `messaging` | value_propositions, emotional_hooks, headline_formulas, key_messages_by_funnel |
| `compliance` | industry_regulations, restricted_claims, forbidden_topics, certifications |
| `meta` | version, completeness_score (0.0–1.0), missing_fields[], onboarding_path |

### Completeness Scoring

`bko_service._compute_completeness()` checks 26 optional fields. Score stored in `bko.meta.completeness_score`. Agents use this to decide if enrichment is needed.

```
completeness_score = 1.0 - (missing_field_count / 26)
```

### Form Onboarding Flow

```mermaid
flowchart TD
    U([User]) -->|POST /api/v1/businesses| A[Router]
    A -->|CreateBusinessRequest| B[BusinessService.create]
    B --> C[BKOService.build_from_form]

    subgraph BKO_BUILD["BKO Construction"]
        C --> D1[Map company → BKOIdentity]
        C --> D2[Map product → BKOOfferings]
        C --> D3[Map audience → BKOAudience]
        C --> D4[Map brand → BKOBrand]
        C --> D5[Map competitive → BKOCompetitivePosition]
        C --> D6[Derive funnel strategy]
        C --> D7[Map social_proof → BKOSocialProof]
        C --> D8[Build messaging + headline_formulas]
        C --> D9[Map compliance → BKOCompliance]
        C --> D10[Compute completeness score]
    end

    D1 & D2 & D3 & D4 & D5 & D6 & D7 & D8 & D9 & D10 --> E[BKO object]
    E --> F[business_repo.create]
    F -->|CAST bko AS JSONB| G[(sp_create_business)]
    G --> H[BusinessResponse]
    H --> U
```

### User provides vs AI generates

| Source | Fields |
|---|---|
| **User fills in form** | Product features, audience pain points, competitor names, brand colors, testimonials, compliance rules |
| **Derived by code** | `funnel_strategy.tofu/mofu/bofu`, `messaging.headline_formulas` (templates), `messaging.proof_points` |
| **AI enriches (Phase 4–5)** | `seasonal_peaks`, secondary audience segment, real ad copy, localization, expanded competitive analysis |

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/businesses` | Bearer | Create business + BKO |
| GET | `/api/v1/businesses` | Bearer | List all businesses for user |
| GET | `/api/v1/businesses/{id}` | Bearer | Get single business |
| PATCH | `/api/v1/businesses/{id}` | Bearer | Update sections → regenerate BKO, bump version |
| DELETE | `/api/v1/businesses/{id}` | Bearer | Delete business |

---

## 8. Campaign Layer

### What a Campaign Is

A campaign is a user's request to generate a set of ad assets for a specific objective, platform, and funnel stage. The user provides a short brief (5 fields); the agents do the rest using the BKO as their knowledge base.

### Campaign Brief Fields

| Field | Type | Description |
|---|---|---|
| `business_id` | UUID | Which business's BKO to use |
| `campaign_name` | string (optional) | Label — auto-generated if blank |
| `objective` | enum | `awareness` `traffic` `conversion` `lead_gen` `engagement` |
| `platforms` | string[] | `instagram` `facebook` `tiktok` `youtube` `google` `linkedin` |
| `funnel_stage` | enum | `tofu` `mofu` `bofu` `balanced` |
| `num_variants` | int (1–10) | How many ad units to produce |
| `special_brief` | string (optional, max 300) | User's editorial override |

### Campaign Status Lifecycle

```
pending → running → awaiting_review → done
                                    ↘ failed
```

- `pending` — created, pipeline not yet started
- `running` — agents are executing
- `awaiting_review` — HITL interrupt fired, waiting for user
- `done` — all assets approved
- `failed` — unrecoverable error (stored in `campaigns.error`)

### Campaign Flow

```mermaid
flowchart TD
    U([User]) -->|POST /api/v1/campaigns| R[Router]
    R --> S[CampaignService.create]
    S -->|verify business ownership| B[(businesses)]
    S --> C[campaign_repo.create]
    C -->|sp_create_campaign| DB[(campaigns table)]
    DB --> RESP[CampaignResponse\nstatus: pending]
    RESP --> U

    note1[/"Background task triggered here\n(Phase 3 — orchestrator not yet wired)"/]
    S -.-> note1
```

### Event System (ready for Phase 2 streaming)

`sp_insert_campaign_event` inserts a row into `campaign_events` **and fires `pg_notify`** in a single stored procedure call. The SSE endpoint (Phase 2) will listen on this channel. All agent activity will be streamed to the frontend through this pipe.

```sql
-- Inside sp_insert_campaign_event:
PERFORM pg_notify(
    'campaign_' || p_campaign_id::TEXT,
    json_build_object(...)::TEXT
);
```

### HITL Resume

`POST /api/v1/campaigns/{id}/resume` validates the campaign is in `awaiting_review` status and accepts `{approved: bool, feedback: string}`. The orchestrator hook (`graph.invoke(Command(resume=...))`) is a TODO stub — wired in Phase 3.

### Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/v1/campaigns` | Bearer | Create campaign (triggers pipeline) |
| GET | `/api/v1/campaigns?business_id=` | Bearer | List campaigns for a business |
| GET | `/api/v1/campaigns/{id}` | Bearer | Get single campaign |
| POST | `/api/v1/campaigns/{id}/resume` | Bearer | Resume after HITL interrupt |
| GET | `/api/v1/campaigns/{id}/events` | Bearer | Get event log (`?after_seq=N` for catch-up) |
| GET | `/api/v1/campaigns/{id}/assets` | Bearer | List generated assets |
| DELETE | `/api/v1/campaigns/{id}` | Bearer | Delete campaign |

### Key files
- [`api/routes/campaigns.py`](../api/routes/campaigns.py) — 7 thin route handlers
- [`services/campaign_service.py`](../services/campaign_service.py) — business logic + resume stub
- [`repos/campaign_repo.py`](../repos/campaign_repo.py) — all DB calls incl. events + assets
- [`schemas/campaign.py`](../schemas/campaign.py) — request/response models
- [`sql/campaign/`](../sql/campaign/) — 8 stored procedures
- [`examples/campaign_input_form.json`](../examples/campaign_input_form.json) — sample Eid 2026 campaign for Karakoram Kitchen

---

## 9. API Endpoints Reference

**Base URL:** `http://localhost:8000/api/v1`  
**Auth:** All endpoints except signup, login, refresh, logout, and admin require `Authorization: Bearer <access_token>`

**Error format:**
```json
{ "error": "ERROR_CODE", "message": "Human-readable message", "detail": null }
```

### Auth `/api/v1/auth`
| Method | Path | Response |
|---|---|---|
| POST | `/signup` | `201 {user, access_token, refresh_token}` |
| POST | `/login` | `200 {access_token, refresh_token}` |
| POST | `/refresh` | `200 {access_token, refresh_token}` |
| POST | `/logout` | `204` |
| POST | `/logout-all` | `204` |
| GET | `/me` | `200 UserResponse` |

### Businesses `/api/v1/businesses`
| Method | Path | Response |
|---|---|---|
| POST | `/` | `201 BusinessResponse` |
| GET | `/` | `200 {businesses[], total}` |
| GET | `/{id}` | `200 BusinessResponse` |
| PATCH | `/{id}` | `200 BusinessResponse` |
| DELETE | `/{id}` | `204` |

### Campaigns `/api/v1/campaigns`
| Method | Path | Response |
|---|---|---|
| POST | `/` | `201 CampaignResponse` |
| GET | `/?business_id=` | `200 {campaigns[], total}` |
| GET | `/{id}` | `200 CampaignResponse` |
| POST | `/{id}/resume` | `200 CampaignResponse` |
| GET | `/{id}/events` | `200 CampaignEventResponse[]` |
| GET | `/{id}/assets` | `200 AssetResponse[]` |
| DELETE | `/{id}` | `204` |

### Admin `/api/v1/admin`
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/load-procedures` | None | Reload all stored procs (idempotent) |

---

## 10. Stored Procedures

All 20 SQL functions auto-load on startup and reload via `POST /admin/load-procedures`.

### Auth (`sql/auth/`) — 7 procedures

| Procedure | Returns |
|---|---|
| `sp_create_user(email, name, password_hash)` | user row |
| `sp_get_user_by_email(email)` | user row or empty |
| `sp_get_user_by_id(user_id)` | user row or empty |
| `sp_create_refresh_token(user_id, token_hash, expires_at)` | token row |
| `sp_get_refresh_token_by_hash(token_hash)` | token row or empty |
| `sp_revoke_refresh_token(token_hash)` | void |
| `sp_revoke_all_user_tokens(user_id)` | void |

### Business (`sql/business/`) — 5 procedures

| Procedure | Returns |
|---|---|
| `sp_create_business(user_id, name, website, industry, bko JSONB, path, status)` | business row |
| `sp_get_business_by_id(business_id, user_id)` | row or empty (ownership in SQL) |
| `sp_get_businesses_by_user(user_id)` | rows ordered by `created_at DESC` |
| `sp_update_business_bko(business_id, user_id, bko JSONB, status)` | updated row (bumps `bko_version`) |
| `sp_delete_business(business_id, user_id)` | `BOOLEAN` |

### Campaign (`sql/campaign/`) — 8 procedures

| Procedure | Returns |
|---|---|
| `sp_create_campaign(user_id, business_id, name, objective, platforms, funnel_stage, num_variants, brief)` | campaign row |
| `sp_get_campaign_by_id(campaign_id, user_id)` | row or empty (ownership in SQL) |
| `sp_get_campaigns_by_business(business_id, user_id)` | rows ordered by `created_at DESC` |
| `sp_update_campaign_status(campaign_id, status, strategy_doc, audit_score, error)` | updated row |
| `sp_insert_campaign_event(campaign_id, event_type, agent, payload JSONB)` | event row + fires `pg_notify` |
| `sp_get_campaign_events(campaign_id, after_seq)` | event rows ordered by `seq ASC` |
| `sp_create_asset(campaign_id, platform, format, asset_type, storage_url, prompt_used)` | asset row |
| `sp_update_asset_status(asset_id, status)` | updated asset row |

**Critical pattern:**
```python
# ✅ Always use CAST() for JSONB — never ::jsonb
"SELECT * FROM sp_create_campaign(..., CAST(:payload AS JSONB))"
```

---

## 11. Error Handling & Logging

### Exception Hierarchy

```
AppError (base, 500)
├── NotFoundError        404  NOT_FOUND
├── ConflictError        409  CONFLICT
├── UnauthorizedError    401  UNAUTHORIZED
├── ForbiddenError       403  FORBIDDEN
├── ValidationError      422  VALIDATION_ERROR
└── ExternalServiceError 502  EXTERNAL_SERVICE_ERROR
```

Three global handlers in `api/main.py`:
1. `AppError` → structured JSON `{error, message, detail}`
2. `RequestValidationError` → 422 with per-field list
3. `Exception` (catch-all) → 500, logs traceback, never exposes internals

### Logging

`logger = get_logger(__name__)` in every module.

Format: `2026-06-21 11:34:06 | INFO | services.campaign_service | Campaign created id=... status=pending`

| Level | When |
|---|---|
| `INFO` | Business events — campaign created, BKO completeness %, asset stored |
| `DEBUG` | DB call details, IDs |
| `WARNING` | Expected failures — not found, wrong password, invalid token, wrong status for resume |
| `ERROR` | Unexpected failures — DB errors, unhandled exceptions |

**Never logged:** passwords, raw tokens, token hashes.

---

## 12. Configuration

All config via `config.py` (pydantic-settings, reads `.env`):

```python
DATABASE_URL                    = "postgresql+psycopg2://postgres:...@localhost:5432/adgen"
GOOGLE_API_KEY                  = ""   # Gemini — configured, not yet called
ELEVENLABS_API_KEY              = ""   # ElevenLabs — not yet called
FIRECRAWL_API_KEY               = ""   # Firecrawl — not yet called
R2_ACCOUNT_ID / R2_BUCKET_NAME  = ""   # Cloudflare R2 — not yet called
JWT_SECRET_KEY                  = "..."
JWT_ACCESS_TOKEN_EXPIRE_MINUTES = 15
JWT_REFRESH_TOKEN_EXPIRE_DAYS   = 7
APP_ENV                         = "development"
LOG_LEVEL                       = "INFO"
```

### Dev server

```bash
./scripts/backend_dev.sh
# activates venv → alembic upgrade head → uvicorn api.main:app --reload --port 8000
```

Swagger UI: `http://localhost:8000/docs`

---

## 13. Build Status

```mermaid
flowchart LR
    subgraph DONE["✅ Built & Tested"]
        A1[Database schema\n9 tables + pgvector\n2 migrations]
        A2[Auth system\nsignup · login · refresh · logout\nJWT + bcrypt]
        A3[Business onboarding\nform path only\nBKO 10 sections]
        A4[BKO completeness scoring\n26-field check]
        A5[Business CRUD\n5 endpoints]
        A6[Campaign CRUD\n7 endpoints]
        A7[20 stored procedures\nauth · business · campaign]
        A8[Event system\nsp_insert_campaign_event\npg_notify ready]
        A9[Global error handling\nlogging · exception hierarchy]
        A10[Admin reload endpoint]
        A11[Swagger examples\nprefilled credentials]
    end

    subgraph NEXT["🔜 Next to Build"]
        B1[Phase 2: SSE Streaming\npg_notify → SSE endpoint\nreconnect support]
        B2[Phase 3: LangGraph Orchestrator\nCampaignState · graph · checkpointer\nbackground task wiring]
        B3[Phase 4: Researcher Agent\nweb search · platform trends\nresearch report]
        B4[Phase 5: Strategist Agent\ncampaign plan · asset blueprint]
        B5[Phase 6: Producer Agent\nstatic image · video · email\nlocal generations/ storage]
        B6[Phase 7: Auditor Agent\nscoring · retry loop · HITL]
        B7[Phase 8: HITL Wiring\ninterrupt · resume · human_reviews]
    end

    subgraph FUTURE["⏳ Future"]
        C1[URL onboarding\nFirecrawl + Gemini]
        C2[Free-text onboarding\nGemini]
        C3[pgvector semantic memory\npast campaign similarity]
        C4[Cloudflare R2\nreplace local storage]
        C5[Frontend\nReact / Next.js]
    end

    DONE --> NEXT --> FUTURE
```
