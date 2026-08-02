# User Journey — Business → Products → Campaign → Builder Agent

> Purpose: trace exactly what happens, frontend and backend, at every step from "user creates a business"
> to "an asset is generated." Every claim is traced to a real file. Each section is explicitly marked
> **✅ Live today** or **🚧 Designed, not built** — this doc does not blur the two. Special attention is given
> to logo/product-image upload, since it's the piece most people assume is further along than it is.

---

## Table of Contents

1. [Journey Map](#1-journey-map)
2. [Stage 1 — Creating a Business](#2-stage-1--creating-a-business)
3. [Stage 2 — Logo & Product Image Upload (deep-dive)](#3-stage-2--logo--product-image-upload-deep-dive)
4. [Stage 3 — Managing Products](#4-stage-3--managing-products)
5. [Stage 4 — Creating a Campaign](#5-stage-4--creating-a-campaign)
6. [Stage 5 — Pipeline Execution](#6-stage-5--pipeline-execution)
7. [Stage 6 — The Builder Agent](#7-stage-6--the-builder-agent)
8. [Frontend: Watching It Happen Live](#8-frontend-watching-it-happen-live)
9. [Summary Table — Today vs Planned](#9-summary-table--today-vs-planned)

---

## 1. Journey Map

```
 1. Create Business  ──► BKO built, stored in businesses.bko (JSONB)
        │
 2. Upload logo / add products+images  ──► real files + real rows, NOT re-embedded into the BKO blob
        │
 3. Create Campaign  ──► references business_id, free-text hero_products, brief
        │
 4. Pipeline runs (background task):
        load_bko  →  Researcher  → [HITL] →  Strategist  → [HITL] →  Builder(Producer)  →  Auditor  → [HITL] →  done
        │
 5. Frontend watches live via SSE, shows generated assets when done
```

The key architectural fact that shapes everything below: **the BKO stored in `businesses.bko` never
contains real product data.** Products live in their own tables and get assembled into the BKO's shape
*at read time only* — every time a business is fetched, not once at write time. Keep this in mind; it
explains several things that would otherwise look like bugs.

---

## 2. Stage 1 — Creating a Business

### Frontend

`OnboardingWizard` ([wizard-shell.tsx](../frontend/src/features/business/components/onboarding-wizard/wizard-shell.tsx)) —
an 8-step modal wizard (Company → Product → Audience → Brand → Competitive → Social Proof → Marketing → Review).
Two entry paths: **Fill manually** (the 8 steps) or **Import from URL** (currently a simulated/mocked
extraction — no real scraping wired up yet, see `UrlImportPath` in the same file).

Each step writes into one `WizardFormData` section in local component state
(`CreateBusinessRequest` shape, [types.ts](../frontend/src/features/business/types.ts)). On the final
"Review" step, `handleSubmit()` fires `POST /businesses` with the whole object in one shot.

**Frontend gap, confirmed by reading the code**: [types.ts](../frontend/src/features/business/types.ts)
still types `product: ProductFormSection` as **required**, and `ProductFormSection` still has no `id`
field. The frontend has not yet been updated for the backend's move to an optional, multi-product model
(that's backend-only work so far, done deliberately without touching the frontend). Wiring the frontend
to the new optional-product + separate product-management flow is unstarted.

### Backend

`POST /businesses` → [businesses.py:27](../api/routes/businesses.py#L27) → `business_service.create()`
([business_service.py:32](../services/business_service.py#L32)):

1. `bko_service.build_from_form(data)` builds the 10-section `BKO` Pydantic object from the flat form
   sections. `offerings.products_services` is **always built as an empty list** — even if the request
   included a `product` section — because products are never written into the BKO blob (see
   [bko_service.py](../services/bko_service.py), the `products_services=[]` line in `build_from_form`).
2. `business_repo.create()` inserts the row, `bko` stored as JSONB in `businesses.bko`.
3. **If `data.product` was provided** (the convenience path — a business can be created with or without
   an initial product), `product_repo.create()` inserts a real row into the `products` table with
   `is_hero=True`. This is the *only* place a business-creation call touches the `products` table.
4. Before returning, `assemble_products_into_bko()` re-reads whatever products now exist for this business
   and injects them into the response's `bko.offerings.products_services` — so the API response looks
   complete even though the stored row's `bko` column has an empty list.

### What's stored where

| Data | Storage |
|---|---|
| Company, audience, brand, competitive, social proof, marketing, compliance sections | `businesses.bko` JSONB, written once per create/update |
| The convenience-created product (if any) | Real row in `products` table, **not** in `businesses.bko` |
| Everything else about products (added later, images, etc.) | See Stage 3 |

---

## 3. Stage 2 — Logo & Product Image Upload (deep-dive)

### The honest current state

**Backend: fully built and tested. Frontend: a static placeholder label, no working UI.**

Direct proof: [businesses/\[id\]/page.tsx:111](<../frontend/src/app/(dashboard)/businesses/[id]/page.tsx#L111>)
renders the literal text `logo` inside a placeholder box — there's no `<input type="file">`, no upload
button, no call to the upload endpoint anywhere in the frontend. A user cannot upload a logo or product
photo through the UI today, even though every backend piece needed to do so is live.

### Logo — backend flow

```
POST /businesses/{id}/logo   (multipart file upload)
   │
   ▼
api/routes/businesses.py :: upload_logo()
   │  reads raw bytes from the multipart body
   ▼
business_service.upload_logo(db, business_id, user_id, file_bytes)
   │
   ├─► utils/storage.py :: _validate_image_bytes()
   │      Decodes the bytes with Pillow and re-checks the format — never trusts
   │      the client's filename or Content-Type header. Only PNG/JPEG/WEBP pass;
   │      max 8MB.
   │
   ├─► utils/storage.py :: save_business_logo(business_id, data)
   │      Upsert: deletes any existing logo.* file first (a business has exactly
   │      one), writes to business_assets/{business_id}/logo.{ext}
   │
   └─► business_service._save_bko()
          Directly mutates bko["identity"]["logo_url"] = path and calls
          business_repo.update_bko() — deliberately bypassing build_from_form()/
          _merge_update() (see the comment block at business_service.py:126-134):
          rebuilding a whole form section just to change one URL risks the
          rebuild silently dropping fields the caller's payload didn't mention.
```

`DELETE /businesses/{id}/logo` does the mirror operation: deletes the on-disk file, sets
`identity.logo_url = None`.

**Note the asymmetry with products below**: the logo genuinely *is* written into the BKO JSONB
(`identity.logo_url`), because a business has exactly one logo and there's no separate "logos" table.
Products are different — see next.

### Product images — backend flow

```
POST /businesses/{business_id}/products/{product_id}/images   (multipart file upload)
   │
   ▼
api/routes/products.py :: upload_product_image()
   │
   ▼
product_service.upload_image(db, business_id, product_id, user_id, file_bytes)
   │
   ├─► ownership check: product must belong to business_id, business must belong to user_id
   │
   ├─► utils/storage.py :: save_product_image(business_id, product_id, data)
   │      Same Pillow validation as logo. Additive, not upsert — a product can
   │      have many photos. Path: business_assets/{business_id}/products/{product_id}/{uuid}.{ext}
   │      (keyed by the product's real UUID, not its name — a name can change or collide)
   │
   └─► product_repo.add_image()
          INSERT into product_images. sp_add_product_image.sql auto-sets
          is_primary=true if this is the product's FIRST image — every product's
          gallery always has exactly one primary once it has ≥1 image.
```

Deleting an image (`DELETE .../images/{image_id}`) is symmetric: if the deleted image was primary,
`sp_delete_product_image.sql` atomically promotes the oldest remaining image to primary in the same
transaction — a product with images never ends up with zero primary images. There's also
`POST .../images/{image_id}/primary` to explicitly re-pick which photo is primary.

**Critically: none of this ever touches `businesses.bko`.** Product images live entirely in the
`product_images` table, joined to `products`, joined to `businesses`. The BKO blob is never rewritten
when an image is uploaded.

### How product/image data gets back into the BKO

This is the part that makes the two flows above actually useful to an agent later. Every time a business
is read — `GET /businesses/{id}`, `GET /businesses` (list), immediately after `create`/`update` — the
service layer calls:

```python
# services/business_service.py
def assemble_products_into_bko(db, business_id, user_id, bko: dict) -> dict:
    rows = product_repo.list_with_images_for_business(db, business_id, user_id)
    # ...builds a plain-dict product list, images sorted primary-first...
    bko["offerings"]["products_services"] = products
    bko["offerings"]["hero_product"] = hero_name or ...
    bko["meta"] = bko_service.recompute_completeness_meta(bko)   # completeness recomputed fresh, not stale
    return bko
```

`sp_list_products_with_images_by_business.sql` does this in a **single query** using `jsonb_agg` to
pre-aggregate each product's images — not N+1 queries per business fetch, since this runs on every read.

The orchestrator's `load_bko` node ([nodes.py:145](../orchestrator/nodes.py#L145)) calls this exact same
function before handing `bko` to the Researcher/Strategist/Builder — so **every agent in the pipeline sees
real, current product+image data**, without any of them needing to know products live in separate tables.
As far as `agents/strategist/prompts.py` or a future Builder sub-agent is concerned,
`bko.offerings.products_services[i].image_urls` is just a list of strings, same as always.

### Why this design (storage vs. resolution are two different problems)

Storing the data and *using* it for generation are deliberately separate concerns. Today, storage is
fully solved — a product can have a real, primary-flagged photo gallery, reliably resolvable by any
consumer. What's **not** solved yet is a function that, given a specific asset being generated, decides
*which* image to actually hand to a generation call, with fallback logic when nothing exists. That's
`resolve_brand_assets()` — 🚧 designed (see the design discussion earlier in this conversation), not yet
written. It's the single missing link between "the data is stored" and "the Builder agent grounds
generation in it."

---

## 4. Stage 3 — Managing Products

**Backend: full CRUD, tested. Frontend: none** — no product list, no "add product" button, no image
gallery UI anywhere in the app today. A product can currently only be created two ways: the
convenience-path during business creation, or a raw API call.

| Endpoint | Purpose |
|---|---|
| `POST /businesses/{id}/products` | Create an additional product (business can have any number) |
| `GET /businesses/{id}/products` | List all products + their image galleries |
| `GET /businesses/{id}/products/{product_id}` | One product's full detail |
| `PATCH /businesses/{id}/products/{product_id}` | Update fields (`COALESCE`-style — omitted fields untouched) |
| `DELETE /businesses/{id}/products/{product_id}` | Deletes product + cascades images (DB) + deletes on-disk folder |
| `POST/GET/DELETE .../images`, `POST .../images/{id}/primary` | Gallery management, described above |

See [api/routes/products.py](../api/routes/products.py) / [services/product_service.py](../services/product_service.py).

---

## 5. Stage 4 — Creating a Campaign

### Frontend

`CampaignForm` ([campaign-form.tsx](../frontend/src/features/campaign/components/campaign-form.tsx)) —
a single-page form (not a wizard): business picker, free-text campaign brief, platform/asset-type pill
selectors, funnel stage, objective, a variant-count slider, and an "Advanced options" collapsible section
with campaign name, tone override, and **hero products**.

**Hero products today is a plain tag input** — type a name, press Enter, it's added to a string array,
max 5 (`addHeroProduct()` at [campaign-form.tsx:163](../frontend/src/features/campaign/components/campaign-form.tsx#L163)).
It is **not** a picker over the business's real `products` table — the frontend has no way to know what
real products exist for the selected business, since (per Stage 3) there's no product-listing UI yet.
The user just retypes a product name they remember, hoping it matches what's in the BKO closely enough.

On submit: `POST /campaigns` with `{business_id, objective, platforms, asset_types, funnel_stage,
num_variants, hero_products, tone_override, special_brief}`. The response navigates to `/campaigns/{id}`,
which is the live-view page (Stage 6).

### Backend

`POST /campaigns` → [campaigns.py] → `campaign_service.create()`:

1. Verifies the business exists and belongs to this user (`business_repo.get_by_id`).
2. `campaign_repo.create()` inserts the campaign row — `hero_products` stored as-is, a plain `TEXT[]`,
   free text, no FK to `products`.
3. Schedules `tasks.campaign_runner.run_pipeline()` as a FastAPI `BackgroundTask` — the HTTP response
   returns immediately with the created campaign; the pipeline runs asynchronously after.

**The cardinality note**: `hero_products` naming a product doesn't structurally guarantee that name
matches a real `products.name` row. In practice it mostly works because `agents/strategist/validation.py`'s
`_known_product_names` check constrains what the *Strategist* is allowed to call a hero product later in
the pipeline (it's pinned against the assembled BKO's real product list) — but the *campaign's own*
`hero_products` field, entered here at creation time, has no equivalent validation. This is a known,
accepted gap, not a crash risk.

---

## 6. Stage 5 — Pipeline Execution

`run_pipeline()` ([campaign_runner.py:46](../tasks/campaign_runner.py#L46)) invokes the compiled LangGraph
graph with `thread_id = campaign_id` (so checkpoints tie 1:1 to the DB row). Node order
([orchestrator/graph.py](../orchestrator/graph.py)):

```
load_bko
   │  fetches business + assembles real products/images into bko (Stage 2's bridge)
   │  fetches campaign row, hydrates CampaignState with objective/platforms/hero_products/etc.
   ▼
run_researcher            (LLM agent, web_search/scrape_url tools)
   ▼
hitl_research_review      interrupt() — pipeline pauses, waits for human approve/reject via /resume
   ▼
run_strategist             (LangGraph pipeline: plan → produce-per-asset → assemble StrategyDoc)
   ▼
hitl_plan_approval          interrupt() — human reviews the strategy doc
   ▼
run_producer                ← THE BUILDER AGENT. Currently a stub. See Stage 6.
   ▼
run_auditor                 Currently also a stub — scores/validates generated assets
   ▼
hitl_assets                 interrupt() — final human review of generated assets
   ▼
campaign_done  (or campaign_failed on unrecoverable error)
```

All four agent nodes (`load_bko` excluded) are wrapped in a `RetryPolicy` (4 attempts, exponential
backoff) that only engages on *raised* exceptions — see `NodeExecutionError` in
[orchestrator/nodes.py](../orchestrator/nodes.py). If retries exhaust, the campaign is marked
`resumable=True` with a `failed_node`, and `POST /campaigns/{id}/retry` re-enters the LangGraph checkpoint
at exactly that node — the already-completed Researcher/Strategist work is not re-run, no LLM spend is
wasted redoing work that already succeeded.

Each `HumanMessage`/tool-call/status change is persisted to `campaign_events` and `pg_notify`'d in the same
transaction, which is what powers the live frontend view (Stage 8).

---

## 7. Stage 6 — The Builder Agent

**This is the honest headline: `agents/producer/graph.py` is a 31-line hardcoded stub.**

```python
class _StubProducer:
    async def ainvoke(self, input, **_):
        # returns num_variants copies of {"headline": "Stub Headline 1", ...,
        # "storage_url": None} — no LLM call, no image generation, nothing real
```

It receives `num_variants` and `platforms` from state and returns fake text. `storage_url` is always
`None` — no file is ever produced. The Auditor downstream is in the same state (a stub scoring stub data).

### What reaches this node today, if it were real (per the earlier data audit)

By the time `run_producer` executes, `CampaignState` already carries, fully populated:
- `bko` — with real, assembled product data + logo/image URLs (Stage 2's bridge)
- `research_report` — competitor patterns, platform ad-specs, audience intelligence
- `strategy_doc` — per-asset creative direction: headline, body copy, hook, `image_prompt` (static),
  full timed script (video), or complete email copy — see
  [docs/agents/BUILDER_AGENT_DATA_AUDIT.md](agents/BUILDER_AGENT_DATA_AUDIT.md) for the exhaustive field-by-field trail.

Nothing structurally blocks a real Builder from seeing all of this — the plumbing is there. What's missing
is the agent itself.

### What's designed but not built, in the order it'd need to be tackled

1. **`resolve_brand_assets()`** — decides which real logo/product image (if any) to ground a specific
   asset in, with override precedence (`runtime override → campaign match → BKO default → flagged gap`).
   Pure function, no DB access needed (the assembled `bko` already has everything). Designed, not written.
2. **`utils/MediaGen` is broken**, not just unused — wrong import paths copy-pasted from a different
   project, wrong API key env var, and only an `image` provider exists (no video, no audio) despite
   `VideoRequest`/`AudioRequest` schemas already existing in that module.
3. **A prompt-engineering stage** — `StrategyDoc.image_prompt` is marketing creative direction written by
   a copywriter persona, not a production-grade generation prompt. Nothing turns one into the other yet.
4. **The three sub-agents** (static image / video ad / email), each its own standalone-invokable agent per
   the architecture decision made earlier — none written. Static is closest to buildable (least new
   capability needed); email needs an HTML templating layer (pure code); video needs generation capability
   that doesn't exist anywhere in this codebase yet (video gen, TTS, avatar consistency).
5. **Avatar generation** — no schema signal upstream for "does this asset need a presenter," no provider,
   no face-consistency mechanism across a video's beats.
6. **Per-asset HITL** — today's `hitl_assets` interrupt is campaign-wide, at the very end. A finer-grained,
   per-asset interrupt (distinct from the three existing campaign-level checkpoints) was discussed but not
   implemented.

---

## 8. Frontend: Watching It Happen Live

Once a campaign is created, `CampaignLiveView`
([campaign-live-view.tsx](../frontend/src/features/campaign/components/campaign-live-view.tsx)) takes over,
built and working end-to-end **for the pipeline shell** (independent of whether the agent behind each
step is real or a stub):

- Connects to `GET /stream/{campaign_id}` — a Server-Sent-Events endpoint
  ([stream.py](../api/routes/stream.py)) that `LISTEN`s on Postgres `pg_notify` and re-reads full event
  rows from `campaign_events` on each notification (not trusting the notify payload itself, which has an
  8000-byte hard limit — this was a real bug fixed earlier in this project's life).
- Renders a 4-agent pipeline sidebar (Researcher/Strategist/Producer/Auditor) with live "Running…" /
  "Complete" / "Paused" states, driven by parsing `agent_started`/`agent_completed`/`hitl_required` events.
- Shows a HITL review panel (`ReviewPanel`) whenever the pipeline is paused at one of the three
  `interrupt()` checkpoints, with approve/reject wired to `POST /campaigns/{id}/resume`.
- On `campaign_done`, renders `AssetGallery` — this will faithfully display whatever the Producer node
  returned, including today's stub data (fake headlines, `storage_url: null`), since the UI has no
  awareness that the agent behind it isn't real yet.
- On failure, shows a Retry button when `campaign.resumable` is true, wired to
  `POST /campaigns/{id}/retry`.

This means: **the entire live-execution UI is already a faithful window into the real pipeline** — the
only thing not real is what the Producer node itself produces. The day a real Builder agent replaces the
stub, no frontend changes are needed for this view to start showing genuine generated assets.

---

## 9. Summary Table — Today vs Planned

| Piece | Status |
|---|---|
| Business creation (form wizard, 8 steps) | ✅ Live |
| BKO built from form, stored as JSONB | ✅ Live |
| Business creation with optional convenience-product | ✅ Live (backend only — frontend still sends `product` as required) |
| Logo upload — backend (validate, store, resolve) | ✅ Live |
| Logo upload — frontend UI | 🚧 Placeholder only, no upload control |
| Multi-product backend (real tables, independent CRUD) | ✅ Live |
| Product image galleries (upload, auto-primary, auto-promote-on-delete) | ✅ Live |
| Product/image management — frontend UI | 🚧 Not built |
| BKO ↔ real product data bridge (`assemble_products_into_bko`) | ✅ Live, used on every business read + by `load_bko` |
| Campaign creation form | ✅ Live |
| Hero-product picker tied to real products | 🚧 Currently free-text tag input, no product lookup |
| Pipeline orchestration (LangGraph graph, HITL, retry) | ✅ Live |
| Researcher agent | ✅ Live |
| Strategist agent (v2 pipeline) | ✅ Live |
| Live SSE pipeline view, HITL review UI, retry UI | ✅ Live |
| **Builder / Producer agent** | 🚧 **Hardcoded stub — no real logic** |
| `resolve_brand_assets()` | 🚧 Designed, not written |
| Image generation provider (`MediaGen`) | 🔴 Broken (wrong imports, wrong API key var) |
| Video generation, TTS/voiceover, avatar consistency | 🔴 Do not exist anywhere in the codebase |
| Auditor agent | 🚧 Stub |
| Per-asset HITL | 🚧 Designed, not implemented |
