# Builder Agent — Data Availability & Gap Analysis

> Purpose: before writing any Builder-agent code, establish precisely what data exists by the time a
> `static_image` / `video_ad` / `email` sub-agent would run, what each actually needs to deliver the asset
> being promised, and where the gap is. Every claim below is traced to a real file and field verified in
> this codebase — nothing here is aspirational. No implementation in this pass.

---

## Table of Contents

1. [The Pipeline So Far](#1-the-pipeline-so-far)
2. [Full Data Trail — Every Field, With Its Source](#2-full-data-trail--every-field-with-its-source)
3. [Static Ad Sub-Agent](#3-static-ad-sub-agent)
4. [Video Ad (UGC) Sub-Agent](#4-video-ad-ugc-sub-agent)
5. [Email Sub-Agent](#5-email-sub-agent)
6. [Cross-Cutting Gaps](#6-cross-cutting-gaps)
7. [Consolidated Gap Table](#7-consolidated-gap-table)

---

## 1. The Pipeline So Far

```
BKO (onboarding, once per business)
   │
   ▼
Campaign Brief (user input, once per campaign)
   │
   ▼
Researcher agent  ──►  ResearchReport
   │
   ▼
Strategist agent (v2 pipeline)  ──►  StrategyDoc
   │
   ▼
BUILDER AGENT  ◄── you are here — this doc audits what it has to work with
   ├── static_image sub-agent
   ├── video_ad sub-agent (UGC-style)
   └── email sub-agent
```

All four upstream objects (`bko`, the campaign brief fields, `research_report`, `strategy_doc`) live together
in `CampaignState` (`orchestrator/state.py`) and are technically all reachable by whatever node runs next —
nothing structurally prevents the Builder from seeing all of it. What's actually true today is that **no
Builder code exists yet** (`agents/producer/graph.py` is a hardcoded stub), so "what data reaches it" is not
yet a real question — this doc is answering "what data **would be available** to design against."

---

## 2. Full Data Trail — Every Field, With Its Source

### 2.1 BKO (`schemas/bko.py`, built by `services/bko_service.build_from_form()`)

| Field path | Source |
|---|---|
| `identity.company_name`, `.legal_name`, `.founded_year`, `.headquarters`, `.website`, `.business_type`, `.company_size`, `.employee_range`, `.industry`, `.sub_industry`, `.description`, `.mission`, `.tagline`, `.brand_story` | Onboarding form, `CompanyFormSection` |
| `identity.logo_url` | **New** (this session) — `POST /businesses/{id}/logo`, stored at `business_assets/{business_id}/logo.{ext}` |
| `offerings.products_services[]` — `name`, `type`, `is_hero`, `description`, `key_features`, `benefits`, `pricing_model`, `pricing_tier`, `pricing_details`, `unique_selling_points`, `target_use_case` | Onboarding form, `ProductFormSection`. **`build_from_form` always produces exactly ONE entry in this list** — the form has no way to submit more than one product today |
| `offerings.products_services[].image_urls` | **New** (this session) — `POST /businesses/{id}/products/{name}/images`, additive gallery at `business_assets/{business_id}/products/{slug}/{uuid}.{ext}` |
| `offerings.hero_product`, `.free_trial_available`, `.demo_available`, `.primary_cta`, `.conversion_url` | Onboarding form |
| `audience.primary.*` (demographics, psychographics, behavioral, pain_points, desired_outcomes, objections, emotional_state, persona_name), `audience.audience_awareness_level` | Onboarding form, `AudienceFormSection` |
| `brand.personality_traits`, `brand.voice.*` (tone, style, pov, examples, etc.), `brand.dos`, `brand.donts` | Onboarding form, `BrandFormSection` |
| `brand.visual_identity.*` — `primary_colors`, `secondary_colors`, `font_style`, `imagery_style`, `design_aesthetic`, `logo_style` (text description, not a file), `visual_do`, `visual_dont` | Onboarding form, `BrandFormSection`. **All text/descriptive — no visual reference file until this session's `logo_url` addition** |
| `competitive_position.*` | Onboarding form, `CompetitiveFormSection` |
| `marketing_context.*` (active_platforms, ad_style_preference, funnel_strategy, budget_tier, etc.) | Onboarding form, `MarketingFormSection` |
| `social_proof.*` (testimonials, key_stats, guarantees, awards) | Onboarding form, `SocialProofFormSection` |
| `messaging.*` (value_propositions, emotional_hooks, proof_points, headline_formulas, forbidden_topics) | Onboarding form, partly derived (`headline_formulas` is template-generated in `bko_service.py`, not user-submitted) |
| `compliance.*` (restricted_claims, required_ad_disclosures, industry_regulations) | Onboarding form, `ComplianceFormSection` |
| `meta.completeness_score`, `.missing_fields` | Computed by `bko_service._compute_completeness()` |

### 2.2 Campaign Brief (`orchestrator/state.py` `CampaignState`, populated by `load_bko` node)

| Field | Source |
|---|---|
| `campaign_id`, `business_id`, `user_id` | URL/auth |
| `campaign_name`, `objective`, `platforms`, `asset_types`, `funnel_stage`, `num_variants`, `hero_products`, `tone_override`, `special_brief` | User input at `POST /campaigns`, `schemas/campaign.py` |

> `hero_products` is a free-text list (e.g. `["Hunza Apricot Jam", "Sea Buckthorn Preserve"]`) entered per
> campaign — it does **not** structurally reference `bko.offerings.products_services[]` entries. Since that
> list only ever has one entry (see 2.1), a two-SKU campaign brief has no BKO catalog counterpart for the
> second SKU at all. Flagged again in §6.

### 2.3 Research Report (`agents/researcher/schemas.py` `ResearchReport`)

| Field | Source |
|---|---|
| `competitor_ad_patterns[]` (positioning, strengths, weaknesses_to_exploit, hooks_used) | Researcher agent (LLM, `web_search`/`scrape_url` tools) |
| `platform_insights[]` — `ad_specs[]` (format, aspect_ratio, max_duration, character_limit), `trending_formats`, `content_themes`, `dos`/`donts`, benchmarks | Researcher agent. **Not guaranteed complete** — a real run produced no entry at all for a requested platform (TikTok); no validation catches this today ([ARCHITECTURE.md §16](../ARCHITECTURE.md)) |
| `audience_intelligence` (purchase_triggers, common_objections, content_preferences) | Researcher agent |
| `asset_type_insights.static_image` / `.video_ad` / `.email_template` — per-type best practices, hook timing, script structure, subject line patterns | Researcher agent |
| `recommended_angles[]` (angle_name, rationale, target_emotion, best_platforms, funnel_fit, hook_direction) | Researcher agent |
| `seasonal_context`, `tone_recommendations`, `sources` | Researcher agent |

### 2.4 Strategy Doc (`agents/strategist/schemas.py` `StrategyDoc`)

Shared per-asset header (`AssetStrategy`, all three sub-types inherit it):

| Field | Source |
|---|---|
| `asset_id`, `platform`, `format`, `funnel_stage`, `role_in_campaign`, `angle`, `hero_product`, `target_emotion`, `key_message`, `copy_tone`, `hook`, `hook_alternatives`, `compliance_notes` | Strategist planner (Stage 1) |

**`StaticImagePlan`** adds: `headline`, `body_copy`, `cta`, `image_prompt`, `text_overlay` (`text`, `placement`, `style_note`), `visual_avoid` — from `write_static_ad` skill.

**`VideoAdPlan`** adds: `headline`, `caption`, `cta`, `duration_seconds`, `script[]` (`timing`, `visual`, `voiceover`, `on_screen_text`), `sound_direction`, `visual_style`, `visual_avoid` — from `write_video_script` skill.

**`EmailPlan`** adds: `subject_line`, `preview_text`, `headline`, `body_paragraphs`, `cta_text`, `cta_url`, `hero_image_brief`, `layout_notes`, `disclosures` — from `write_email` skill. `cta_url` is pinned post-hoc from `bko.offerings.conversion_url` by the pipeline itself, not LLM-written.

Also: `campaign_theme`, `target_emotion`, `narrative_arc`, `key_messages`, `what_to_avoid` at the document level.

---

## 3. Static Ad Sub-Agent

### What's available (with source)

| Data | Source | Present in practice? |
|---|---|---|
| Hook, headline, body_copy, cta, creative direction for image + overlay | `StrategyDoc.StaticImagePlan` | ✅ Yes — this is the richest, most reliable input |
| Brand colors, font style, imagery style, aesthetic, visual dos/don'ts | `bko.brand.visual_identity` | ✅ Yes, but descriptive text only |
| Real logo file | `bko.identity.logo_url` | ⚠️ Structurally available, **empty for virtually every business today** — no upload UI exists, backend just built this session |
| Real product photo | `bko.offerings.products_services[].image_urls` | ⚠️ Same as logo — structurally available, practically empty |
| Compliance constraints | `bko.compliance` + `StrategyDoc.what_to_avoid` + per-asset `compliance_notes` | ✅ Yes |
| Platform format/aspect-ratio constraints | `ResearchReport.platform_insights[].ad_specs` (pre-validated into `StrategyDoc.format` already) | ✅ Yes, for platforms the Researcher actually covered |

### What it actually needs to deliver the promise

A single/story/carousel image ad with brand-accurate product and logo, a correctly-composited text overlay, and a generation prompt built to real prompting standards — per the earlier design discussion:

1. Creative direction (headline/body/cta/hook) — **have it**.
2. Brand style grounding — **have it**, text-only.
3. A resolved, real reference image for the product (not a hallucinated approximation) — **schema exists, data usually doesn't**.
4. A resolved, real logo file to composite — **schema exists, data usually doesn't**.
5. A decision on `ad_format` (single/story/carousel) and frame count — **does not exist anywhere upstream**.
6. A decision on whether this specific ad needs a human figure — **does not exist anywhere upstream**.
7. An actual production-grade generation prompt (not marketing creative direction) — **does not exist**; `image_prompt` is direction, not a finished prompt.
8. A working image-generation provider to call — **broken** (see §6).

### Gaps specific to this sub-agent

- No `ad_format`/frame-count field anywhere in `StaticImagePlan` — the Strategist's schema only ever describes one image per asset. Story/carousel cannot happen in pipeline mode until this is added upstream.
- No avatar-need signal from the Strategist (angle/key_message text could imply it, but nothing structured says so).

---

## 4. Video Ad (UGC) Sub-Agent

### What's available (with source)

| Data | Source | Present in practice? |
|---|---|---|
| Full timed script (visual/voiceover/on-screen-text per beat), duration, sound direction, visual style, hook, caption, cta | `StrategyDoc.VideoAdPlan` | ✅ Yes — the richest schema of the three |
| Brand visual identity | `bko.brand.visual_identity` | ✅ Yes, text only |
| Real product photo / logo | `bko.offerings.products_services[].image_urls`, `bko.identity.logo_url` | ⚠️ Same practical-emptiness caveat as static |
| Platform duration/aspect-ratio limits | `ResearchReport.platform_insights[].ad_specs.max_duration` (already validated into `duration_seconds`) | ✅ Yes, when the Researcher covered that platform |
| Audience persona (age, geography, language) that a presenter should plausibly match | `bko.audience.primary.demographics`, `.persona_name` | ✅ Data exists, but **nothing consumes it for avatar casting today** |

### What it actually needs to deliver the promise

"UGC-style" specifically implies an authentic, handheld, presenter-led feel (this is explicit in the Strategist's own `VIDEO_AD_PLAYBOOK`: *"TikTok wants native, handheld, UGC-feel footage"*) — which makes avatar generation central to this sub-agent, not optional the way it is for static:

1. Script with real beat-level direction — **have it**.
2. A decision on who the presenter is (age/style/voice matched to the BKO's audience persona) — **no data path exists**; the raw demographic data is there, nothing turns it into a casting decision.
3. A consistent avatar face across every beat of one video — **no mechanism exists** to generate once and reuse a reference.
4. A voice for the avatar (accent, tone, language) — **BKO has no voice-persona field at all**, only `audience.demographics.language`.
5. Actual text-to-video (or image-per-beat) generation capability — **does not exist anywhere in this codebase**.
6. Actual voiceover/TTS generation capability — **does not exist**; `ELEVENLABS_API_KEY` is blank in the real `.env`, `tools/elevenlabs.py` is an empty file.
7. Beat-to-beat video assembly (if the beat-composite approach discussed earlier is used) — **no ffmpeg or equivalent integration exists anywhere in this codebase** (unverified whether ffmpeg is even installed on the host — not checked).

### Gaps specific to this sub-agent

This sub-agent has by far the largest gap between "promised" and "buildable today" of the three — every generation capability it needs (video, voice, avatar) is entirely absent, not just unreliable. Confirms the earlier decision to defer this scope.

---

## 5. Email Sub-Agent

### What's available (with source)

| Data | Source | Present in practice? |
|---|---|---|
| Subject line, preview text, headline, body paragraphs, CTA text, hero image brief, layout notes, disclosures | `StrategyDoc.EmailPlan` | ✅ Yes — the most complete schema of the three, essentially publication-ready copy |
| `cta_url` | Pinned directly from `bko.offerings.conversion_url` by the pipeline (not LLM-authored) | ✅ Yes, robust by construction |
| Brand visual identity for hero image styling | `bko.brand.visual_identity` | ✅ Yes, text only |
| Real product photo for the hero image | `bko.offerings.products_services[].image_urls` | ⚠️ Same practical-emptiness caveat |
| Real logo for header branding | `bko.identity.logo_url` | ⚠️ Same practical-emptiness caveat, **and** not referenced as a first-class field anywhere in `EmailPlan` — logo placement is left to freeform `layout_notes` prose, not guaranteed |
| Required disclosures | `bko.compliance.required_ad_disclosures` (already folded into `EmailPlan.disclosures`) | ✅ Yes |

### What it actually needs to deliver the promise

A fully rendered, mobile-first HTML email with a real hero image:

1. All copy — **have it**, and it's the strongest of the three sub-agents on this axis.
2. `cta_url` — **have it**, reliably.
3. A real hero image (not a hallucinated product) — **schema exists, data usually doesn't**, same as static/video.
4. Logo placement as a deliberate, structural decision — **not modeled**; currently would depend on the copywriter's freeform `layout_notes` text happening to mention it.
5. An actual HTML rendering/templating implementation — **does not exist**; no template file, no rendering code anywhere in the codebase.
6. Email-client-safe markup (inline CSS, table-based layout for Outlook, etc.) — **not addressed anywhere**; `layout_notes` is generic prose, not email-specific technical guidance.

### Gaps specific to this sub-agent

Of the three, this one is closest to buildable — it needs zero new generation capability beyond one hero image (reusing whatever the static sub-agent solves) and a templating layer, which is pure code, not AI.

---

## 6. Cross-Cutting Gaps

These block or degrade all three sub-agents equally, not just one:

1. **`utils/MediaGen` is broken, not just unused.** Confirmed by direct import test: `_kie_ai_base.py` imports `app.config` and `app.utilities.MediaGen` — paths from a different project, copy-pasted in — and authenticates via `SEEDREAM_API_KEY`, which doesn't exist in this project's `config.py` (the real key is `KIE_API_KEY`). Every image provider (`flux`, `nano-banana`, `seedream`, `gemini`) also only implements `SUPPORTED_MEDIA_TYPES = ["image"]` — there is no video or audio provider despite `VideoRequest`/`AudioRequest` schemas existing.

2. **No `resolve_brand_assets()` function exists.** The BKO can now *store* a logo and product images (this session's work), but nothing reads them back out with the override-precedence logic (`runtime override > BKO default > flagged gap`) designed in the prior conversation. Storage and resolution are two different pieces of work; only the first is done.

3. **BKO product-catalog cardinality doesn't match campaign `hero_products` cardinality.** The onboarding form only ever produces one `products_services[]` entry; a campaign can list multiple `hero_products`. There is structurally no way today to look up a specific product's image gallery for the second-or-later hero product in a campaign, because no second product exists in the BKO at all.

4. **No upload UI exists.** The backend for logo/product-image upload is real and tested (this session), but with no frontend calling it, `logo_url`/`image_urls` will be empty on essentially every real business until that UI is built — deferred deliberately, but worth restating as the reason "available" and "populated" mean different things throughout this doc.

5. **No prompt-engineering stage exists for any visual medium.** `image_prompt` (static) and `visual_style`/script `visual` fields (video) are marketing creative direction, written by a copywriter persona — not production-ready, provider-aware generation prompts. This was identified as needing its own dedicated stage; no code for it exists yet.

6. **No avatar-generation capability at all** — no schema field upstream signaling avatar need, no provider, no consistency mechanism.

7. **No fine-grained, per-asset HITL/interrupt mechanism.** Designed (an asset-scoped `interrupt()`/`Command(resume=...)` pair, distinct from the three campaign-level checkpoints) but not implemented.

8. **No standalone invocation exists for any of the three sub-agents** — designed for the static-ad case (own `AgentBuilder`/CLI runner/API endpoint mirroring `agents/researcher`, `agents/strategist`), not built.

9. **Nothing validates `asset_types` against actual build capability at campaign-creation time.** A user can request `video_ad` today and the campaign will accept it — there's no check anywhere that says "video generation doesn't exist yet, this will fail or silently skip."

---

## 7. Consolidated Gap Table

| Gap | Blocks | Severity |
|---|---|---|
| `MediaGen` broken (wrong imports, wrong API key var) | All image generation, for all 3 sub-agents | 🔴 Blocking |
| No video generation provider | Video sub-agent entirely | 🔴 Blocking (for video only) |
| No voiceover/TTS provider | Video sub-agent entirely | 🔴 Blocking (for video only) |
| No `resolve_brand_assets()` | Real product/logo grounding for all 3 | 🔴 Blocking for brand accuracy |
| No prompt-engineering stage | Generation quality for static + video | 🟠 Important |
| No `ad_format`/frame-count field in `StaticImagePlan` | Story/carousel formats in pipeline mode | 🟠 Important |
| No avatar decision signal or generation capability | Video (central to "UGC"), optional for static | 🟠 Important for video, 🟡 nice-to-have for static |
| No HTML templating implementation | Email sub-agent | 🟠 Important (but cheapest to close — pure code) |
| No logo field in `EmailPlan` / logo-in-header not modeled | Email brand consistency | 🟡 Minor |
| BKO product cardinality vs. campaign `hero_products` mismatch | Correct "which product image" resolution when a campaign names 2+ SKUs | 🟠 Important |
| No upload UI | Practical population of logo/product data (backend ready, unused) | 🟡 Deferred by choice |
| No fine-grained per-asset HITL | Graceful handling of missing-asset gaps | 🟡 Nice-to-have, safe default exists (fallback) |
| No standalone invocation for any sub-agent | The "generate one-off ad from a prompt" feature | 🟡 Deferred, not blocking pipeline mode |
| No capability-check at campaign creation | User experience only — campaigns can request the impossible today | 🟡 Minor |

**Reading this table plainly:** static and email are close to buildable once `MediaGen` is fixed and `resolve_brand_assets()` exists — the data they need is mostly already flowing through the pipeline. Video is not close — every generation capability it depends on (video, voice, avatar) is entirely absent, which is why deferring it was the right call.
