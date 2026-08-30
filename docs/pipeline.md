# Pipeline Reference — Business Data → Researcher → Strategist

> Scope: everything produced from business/product creation through the end of the Strategist stage
> (the `hitl_plan_approval` pause, right before the Builder/Producer node runs). This is the reference
> for architecting the Builder agent's sub-agents — it enumerates every field that exists by the time a
> sub-agent would receive an asset to build, and exactly where each one comes from. Every field listed is
> traced to a real schema file; nothing here is aspirational. The Builder/Producer stage itself is
> **out of scope** — see [USER_JOURNEY.md](USER_JOURNEY.md) §7 and
> [agents/BUILDER_AGENT_DATA_AUDIT.md](agents/BUILDER_AGENT_DATA_AUDIT.md) for that.

---

## Table of Contents

1. [Pipeline Shape](#1-pipeline-shape)
2. [Stage 0 — Inputs Assembled Before the Pipeline Runs](#2-stage-0--inputs-assembled-before-the-pipeline-runs)
3. [Node 1 — `load_bko`](#3-node-1--load_bko)
4. [Node 2 — `run_researcher`](#4-node-2--run_researcher)
5. [Node 3 — `hitl_research_review`](#5-node-3--hitl_research_review)
6. [Node 4 — `run_strategist`](#6-node-4--run_strategist)
7. [Node 5 — `hitl_plan_approval`](#7-node-5--hitl_plan_approval)
8. [Full State Handed to the Builder/Producer](#8-full-state-handed-to-the-builderproducer)
9. [Deep-Dive: Logo & Product Data](#9-deep-dive-logo--product-data)
10. [Quick Reference — Field → Source](#10-quick-reference--field--source)

---

## 1. Pipeline Shape

```
load_bko  →  run_researcher  →  hitl_research_review  →  run_strategist  →  hitl_plan_approval  →  [Builder/Producer starts here]
```

Node order and wiring: [orchestrator/graph.py](../orchestrator/graph.py). Node bodies: [orchestrator/nodes.py](../orchestrator/nodes.py).
All state flows through one `CampaignState` TypedDict ([orchestrator/state.py](../orchestrator/state.py)) —
every field any node writes is visible to every later node, including the Builder.

---

## 2. Stage 0 — Inputs Assembled Before the Pipeline Runs

Two things exist before `load_bko` ever runs: the **BKO** (built once at business creation/update,
re-assembled on every read) and the **campaign row** (built once at campaign creation).

### 2.1 The BKO — full field list

Built by `bko_service.build_from_form()` ([schemas/bko.py](../schemas/bko.py)), 10 sections:

**`identity`** (`BKOIdentity`)

| Field | Type | Notes |
|---|---|---|
| `company_name` | str | required |
| `legal_name`, `founded_year`, `headquarters`, `website`, `employee_range`, `sub_industry`, `mission`, `tagline`, `brand_story` | optional | |
| `business_type` | `B2B｜B2C｜B2B2C｜D2C｜marketplace` | |
| `company_size` | `startup｜smb｜mid-market｜enterprise` | |
| `industry` | str | required |
| `description` | str | required |
| `logo_url` | str \| None | **See §9** — real file path, resolved by asset-producing agents |

**`offerings`** (`BKOOfferings`)

| Field | Type | Notes |
|---|---|---|
| `products_services` | `list[Product]` | **See §9** — assembled from real DB tables at read time, never stored in the BKO blob |
| `hero_product` | str \| None | Name of whichever product is flagged `is_hero`, projected here by the assembly step |
| `free_trial_available`, `demo_available` | bool | |
| `primary_cta` | str | e.g. "Start free trial" |
| `conversion_url` | str \| None | |

Each `Product` in `products_services[]`: `id`, `name`, `type` (`saas_product｜physical｜service｜subscription｜digital｜marketplace`),
`is_hero`, `description`, `key_features[]`, `benefits[]`, `pricing_model` (`one_time｜subscription｜freemium｜pay_per_use｜enterprise｜free`),
`pricing_tier` (`free｜low｜mid｜premium｜enterprise`), `pricing_details`, `unique_selling_points[]`, `target_use_case`, `image_urls[]`.

**`audience`** (`BKOAudience`) — `primary: AudienceSegment` (required), `secondary: AudienceSegment | None`,
`audience_awareness_level` (`unaware｜problem_aware｜solution_aware｜product_aware｜most_aware`).
Each `AudienceSegment`: `persona_name`, `demographics` (age_range, gender, income_level, education, occupation[],
company_size, industry_vertical, seniority, geography, language), `psychographics` (values[], interests[],
personality[], lifestyle), `behavioral` (online_platforms[], content_consumption[], purchase_behavior,
device_usage, buying_trigger), `pain_points[]`, `desired_outcomes[]`, `objections[]`, `emotional_state`.

**`brand`** (`BKOBrand`) — `personality_traits[]`, `dos[]`, `donts[]`,
`voice` (`primary_tone`: professional/casual/playful/authoritative/empathetic/bold/inspirational/professional_casual,
`writing_style`: conversational/formal/technical/punchy, `pov`, `language_complexity`, `sentence_style`,
`humor_level`, `examples[]`),
`visual_identity` (`primary_colors[]`, `secondary_colors[]`, `font_style`, `imagery_style`, `design_aesthetic`,
`logo_style` — text description, not a file, `visual_do`, `visual_dont`).

**`competitive_position`** (`BKOCompetitivePosition`) — `market_position` (leader/challenger/niche/emerging),
`positioning_statement`, `primary_differentiators[]`, `competitive_advantages_summary`,
`competitors[]` (each: `name`, `type`, `strengths[]`, `weaknesses[]`, `pricing_vs_us`, `positioning`, `our_counter`).

**`marketing_context`** (`BKOMarketingContext`) — `active_platforms[]`, `target_platforms_for_campaigns[]`,
`best_performing_content_types[]`, `ad_style_preference` (lifestyle/product_demo/testimonial/minimalist/bold_graphic/ugc_style/animated/comparison),
`preferred_cta_styles[]`, `past_campaign_themes[]`, `funnel_strategy` (tofu/mofu/bofu text),
`seasonal_peaks[]` (period, reason), `budget_tier` (small/medium/large), `average_sales_cycle`,
`primary_conversion_goal` (purchase/free_trial/demo_booking/lead_form/app_install/newsletter/call).

**`social_proof`** (`BKOSocialProof`) — `key_stats[]`, `review_platforms[]` (platform, rating, review_count),
`testimonials[]` (quote, author, title, company, use_in_ads), `notable_clients[]`, `awards[]`,
`press_mentions[]`, `guarantees[]`.

**`messaging`** (`BKOMessaging`) — `primary_value_propositions[]`, `emotional_hooks[]`, `proof_points[]`,
`headline_formulas[]` (template-generated, not user-submitted), `key_messages_by_funnel` (awareness/consideration/conversion),
`forbidden_topics[]`, `required_disclaimers[]`, `localization` (primary_language, regional_variants).

**`compliance`** (`BKOCompliance`) — `industry_regulations[]`, `restricted_claims[]`, `required_ad_disclosures[]`,
`content_policy_flags[]`, `certifications_to_mention[]`.

**`meta`** (`BKOMeta`) — `version`, `onboarding_path`, `completeness_score`, `missing_fields[]`, `generated_by`.
Recomputed fresh on every read against the *assembled* BKO (real products included) — see
`bko_service.recompute_completeness_meta()`.

### 2.2 The campaign row

Built at `POST /campaigns` from `CreateCampaignRequest` ([schemas/campaign.py](../schemas/campaign.py)):
`business_id`, `campaign_name`, `objective` (awareness/traffic/conversion/lead_gen/engagement),
`platforms[]` (instagram/facebook/tiktok/youtube/google/linkedin), `asset_types[]` (static_image/video_ad/email,
defaults to all three), `funnel_stage` (tofu/mofu/bofu/balanced), `num_variants` (1-10), `hero_products[]`
(free text, max 5, **not FK-linked to `products`** — see §9), `tone_override` (urgent/playful/bold/emotional/professional/conversational, optional),
`special_brief` (free text, max 500 chars).

---

## 3. Node 1 — `load_bko`

[orchestrator/nodes.py:118](../orchestrator/nodes.py#L118)

Fetches the business, fetches the campaign, calls `business_service.assemble_products_into_bko()` (real
products/images merged in — see §9), and writes these `CampaignState` keys:

```
bko, campaign_name, objective, platforms, asset_types, funnel_stage,
num_variants, hero_products, tone_override, special_brief, retry_count, error
```

Also writes `generations/{campaign_id}/campaign_overview.json` to disk (a flat summary, not part of pipeline
state) and flips `campaigns.status → "running"`.

---

## 4. Node 2 — `run_researcher`

[orchestrator/nodes.py:186](../orchestrator/nodes.py#L186) runs `agents/researcher/agent.py` (a `create_react_agent`
with `web_search`/`scrape_url` tools) and writes `state["research_report"]`, schema-validated against
`ResearchReport` ([agents/researcher/schemas.py](../agents/researcher/schemas.py)):

| Field | Type | Contents |
|---|---|---|
| `competitor_ad_patterns[]` | `CompetitorPattern` | `competitor_name`, `ad_formats[]`, `hooks_used[]` (hook_text, format, platform), `positioning`, `strengths[]`, `weaknesses_to_exploit[]` |
| `platform_insights[]` | `PlatformInsight` | `platform`, `ad_specs[]` (format, aspect_ratio, max_duration, character_limit, notes), `trending_formats[]`, `optimal_posting_times`, `benchmark_ctr`, `benchmark_engagement_rate`, `content_themes[]`, `dos[]`, `donts[]` |
| `audience_intelligence` | `AudienceIntelligence` | `current_behavior_trends[]`, `purchase_triggers[]`, `common_objections[]`, `content_preferences[]` |
| `asset_type_insights` | `AssetTypeInsights` | per-type best practices — `static_image` (best_practices, visual_patterns, cta_patterns), `video_ad` (best_practices, hook_timing, script_structure, sound_trends), `email_template` (subject_line_patterns, layout_best_practices, optimal_send_times, benchmark_open_rate, benchmark_click_rate) |
| `seasonal_context[]` | str | upcoming events/holidays relevant to the campaign |
| `recommended_angles[]` | `RecommendedAngle` | `angle_name`, `rationale`, `target_emotion`, `best_platforms[]`, `suggested_formats[]`, `funnel_fit`, `hook_direction` |
| `tone_recommendations[]` | str | |
| `sources[]` | str | URLs/sources consulted |

**Not guaranteed complete** — a real run has produced no entry at all for a requested platform before; no
validation catches this today. Also persisted to `generations/{campaign_id}/research_report.json`.

---

## 5. Node 3 — `hitl_research_review`

[orchestrator/nodes.py:239](../orchestrator/nodes.py#L239) — `interrupt()` pause. Emits `hitl_required` with
`{"checkpoint": "research_review", "data": research_report}`. Resumes via `POST /campaigns/{id}/resume`
with `{"approved": bool, "feedback": str | None}`, written to `state["hitl_response"]`. No new data fields
produced here — pure gate.

---

## 6. Node 4 — `run_strategist`

[orchestrator/nodes.py:275](../orchestrator/nodes.py#L275) runs `agents/strategist/graph.py`'s internal
plan → produce-per-asset → assemble pipeline and writes `state["strategy_doc"]`, schema-validated against
`StrategyDoc` ([agents/strategist/schemas.py](../agents/strategist/schemas.py)). **This is the direct
contract with the Builder** — every plan is fully specified; no creative decisions are meant to remain
downstream except production (image generation, prompt engineering, video/voice synthesis).

### `StrategyDoc` — document level

`campaign_theme`, `target_emotion`, `narrative_arc`, `key_messages[]`, `what_to_avoid[]`, and
`asset_plan: list[AssetPlan]` — one entry per variant, `num_variants` entries total.

### `AssetPlan` — discriminated union on `asset_type`

Every variant shares this header (`AssetStrategy`):

`asset_id`, `platform`, `format` (aspect ratio, or `"email"`), `funnel_stage` (resolved per-asset even when
campaign-level is "balanced"), `role_in_campaign` (attention/consideration/conversion), `angle`,
`hero_product` (**exact product name from the BKO** — see §9), `target_emotion`, `key_message`, `copy_tone`,
`hook`, `hook_alternatives[]`, `compliance_notes`.

**`StaticImagePlan`** (`asset_type: "static_image"`) adds:

| Field | Notes |
|---|---|
| `headline`, `body_copy`, `cta` | finished copy |
| `image_prompt` | **pure visual scene for the image model — explicitly no text, no logos** per the schema's own field description |
| `text_overlay` | `{text, placement, style_note}` — composited onto the image *after* generation, never baked into the generation prompt |
| `visual_avoid[]` | |

**`VideoAdPlan`** (`asset_type: "video_ad"`) adds:

| Field | Notes |
|---|---|
| `headline`, `caption`, `cta` | |
| `duration_seconds` | 1-120 |
| `script[]` | `ScriptBeat`: `timing` (e.g. "0-2s"), `visual`, `voiceover` (nullable), `on_screen_text` — min 3 beats (hook/story/cta) |
| `sound_direction`, `visual_style` | |
| `visual_avoid[]` | |

**`EmailPlan`** (`asset_type: "email"`) adds:

| Field | Notes |
|---|---|
| `subject_line` (≤50 chars), `preview_text` (≤90 chars), `headline` | |
| `body_paragraphs[]` | min 2, short/scannable |
| `cta_text`, `cta_url` | `cta_url` is **pinned post-hoc from `bko.offerings.conversion_url` by the pipeline itself**, not LLM-authored — see `agents/strategist/graph.py` |
| `hero_image_brief`, `layout_notes` | |
| `disclosures[]` | folded in from `bko.compliance.required_ad_disclosures` |

`strategy_doc` is also persisted to `campaigns.strategy_doc` (DB column) and
`generations/{campaign_id}/strategy_doc.json`.

---

## 7. Node 5 — `hitl_plan_approval`

[orchestrator/nodes.py:330](../orchestrator/nodes.py#L330) — same interrupt pattern as §5, gates the
`strategy_doc` before it reaches the Builder. On rejection, `run_strategist` re-enters in **revision mode**
(`RevisionPlan`: `keep[]` asset_ids + `regenerate[]` revised briefs) and only regenerates what the
feedback touched — approved assets are never silently redone.

**This is the pipeline's last checkpoint before the Builder/Producer node runs.**

---

## 8. Full State Handed to the Builder/Producer

By the time `run_producer` executes, `CampaignState` carries, fully populated:

```
campaign_id, business_id, user_id
bko                 — full assembled BKO (§2.1, real products/images merged in — §9)
campaign_name, objective, platforms, asset_types, funnel_stage, num_variants,
hero_products, tone_override, special_brief
research_report      — full ResearchReport (§4)
strategy_doc          — full StrategyDoc (§6) — the direct per-asset build spec
hitl_response         — the most recent HITL response (cleared to None after run_strategist consumes it)
retry_count
```

Nothing structurally prevents a Builder sub-agent from reading all of it — the plumbing is a plain dict,
not scoped per-node.

---

## 9. Deep-Dive: Logo & Product Data

This is the part most load-bearing for sub-agent architecture, since it determines what a sub-agent can
ground image/video generation in versus what it must hallucinate.

### Where it physically lives

- **Logo**: one file per business, upserted at `business_assets/{business_id}/logo.{ext}`. The URL is
  written directly into `bko.identity.logo_url` (mutated in place by `business_service.upload_logo()`,
  bypassing the form-rebuild path entirely — see [USER_JOURNEY.md §3](USER_JOURNEY.md#3-stage-2--logo--product-image-upload-deep-dive)).
- **Product images**: real gallery per product, in the `product_images` table, files at
  `business_assets/{business_id}/products/{product_id}/{uuid}.{ext}`. **Never stored in the BKO blob.**
  Each product's gallery always has exactly one image flagged `is_primary` once it has ≥1 image
  (enforced by a partial unique DB index, not just application logic); primary-first ordering is
  guaranteed by `sp_list_products_with_images_by_business.sql`.

### How it reaches the BKO shape a Builder sub-agent would read

`business_service.assemble_products_into_bko()` runs on **every** business read, including inside
`load_bko` (§3) — so by pipeline time, `bko.offerings.products_services[i]` is a plain dict:

```json
{
  "id": "‹real product UUID›",
  "name": "Widget Pro",
  "type": "saas_product",
  "is_hero": true,
  "description": "...",
  "key_features": ["..."],
  "benefits": ["..."],
  "pricing_model": "subscription",
  "pricing_tier": "mid",
  "pricing_details": null,
  "unique_selling_points": ["..."],
  "target_use_case": null,
  "image_urls": ["business_assets/{id}/products/{product_id}/a.png", "...more, primary first..."]
}
```

`bko.offerings.hero_product` is the name of whichever product is `is_hero=True`, projected here by the same
assembly step. `bko.identity.logo_url` is a plain string path, or `None`.

### The hero_product name-matching problem (relevant to every sub-agent equally)

Two independent free-text fields both claim to name "the product this is about," and neither is an FK:

1. **Campaign-level** `hero_products: list[str]` — typed by the user at campaign creation (§2.2), no
   validation against real product names at write time.
2. **Asset-level** `AssetStrategy.hero_product: str` — written by the Strategist, but validated
   (`agents/strategist/validation.py::_known_product_names`) to loosely match a real `products_services[]`
   name (case-insensitive substring, either direction) before the strategy doc is accepted.

**Practical consequence for Builder architecture**: `AssetStrategy.hero_product` (asset-level, already
validated) is the reliable key to resolve a real product's image from — not the campaign-level
`hero_products` list, which is closer to a hint than a guarantee. This is exactly what
`agents/producer/brand_assets.py::resolve_brand_assets()` (already implemented) does: it takes
`hero_product` from the *asset*, matches it case-insensitively against `bko.offerings.products_services`,
and falls back to whichever product is `is_hero=True` if nothing matches or nothing was given. It returns
`logo_url`, `product_id`, `product_image_url` (primary), `product_image_gallery` (full list, for sub-agents
that want more than one angle — e.g. video beats), and an explicit `gaps[]` list (`no_logo`,
`no_product_match`, `no_product_image`) so a sub-agent can make an informed fallback decision instead of
silently proceeding as if brand grounding didn't matter.

### What's real vs. still a gap, as of this pipeline

| | Status |
|---|---|
| Logo/product image storage, galleries, primary-image logic | ✅ Real, tested |
| BKO ↔ real product data bridge (`assemble_products_into_bko`) | ✅ Real, runs on every read |
| `resolve_brand_assets()` — per-asset image/logo resolution with gap signaling | ✅ Real, tested (`agents/producer/brand_assets.py`) |
| Frontend upload UI for logo/product images | 🚧 Not built — data will be empty on most real businesses until this exists |
| `EmailPlan` referencing the logo as a first-class field | 🚧 Not modeled — logo placement in email currently depends on freeform `layout_notes` prose |
| `StaticImagePlan`/`VideoAdPlan` referencing which specific product image to use | 🚧 Not modeled at the Strategist level — `hero_product` is a name, resolving it to an actual file is entirely the Builder's job via `resolve_brand_assets()` |

---

## 10. Quick Reference — Field → Source

| A Builder sub-agent needs... | Read from |
|---|---|
| What copy to write on the asset | `StrategyDoc.asset_plan[i]` (the type-specific fields — headline/body_copy/cta, or script[], or subject_line/body_paragraphs) |
| What image to generate (creative direction) | `StaticImagePlan.image_prompt` — direction, not a finished generation prompt (no prompt-engineering stage exists yet) |
| What real product photo to ground it in | `resolve_brand_assets(bko, asset.hero_product).product_image_url` |
| What real logo to composite | `resolve_brand_assets(bko, asset.hero_product).logo_url` |
| Brand visual style (colors, aesthetic, imagery style) | `bko.brand.visual_identity` — text/descriptive only |
| Platform technical constraints (aspect ratio, duration, char limits) | `ResearchReport.platform_insights[].ad_specs[]`, already resolved into `AssetStrategy.format` / `VideoAdPlan.duration_seconds` |
| Compliance constraints | `bko.compliance` + `StrategyDoc.what_to_avoid` + `AssetStrategy.compliance_notes` |
| Tone/voice | `AssetStrategy.copy_tone` (already resolved: campaign `tone_override` → BKO `brand.voice.primary_tone` → fallback) |
| Which funnel stage / role this asset plays | `AssetStrategy.funnel_stage`, `.role_in_campaign` |
