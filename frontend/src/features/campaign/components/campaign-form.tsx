"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  Loader2, Rocket, X, FlaskConical, Lightbulb, Palette, Shield,
  ChevronDown, ChevronUp, ArrowLeft, Minus, Plus, Check, Sparkles,
  AlertCircle, Image as ImageIcon, Video, Mail,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { useCreateCampaign } from "../hooks/use-campaigns";
import { useBusinesses } from "@/features/business/hooks/use-businesses";
import { AgentCanvas } from "./agent-canvas";
import type { CreateCampaignRequest } from "../types";
import { useBusinessDetail } from "@/features/business/hooks/use-businesses";
import { useProducts } from "@/features/product/hooks/use-products";

// ── Constants ─────────────────────────────────────────────────────────────────

const PLATFORMS = [
  { value: "instagram", label: "Instagram", icon: "IG", needsVideo: false },
  { value: "tiktok",    label: "TikTok",    icon: "TK", needsVideo: true  },
  { value: "facebook",  label: "Facebook",  icon: "FB", needsVideo: false },
  { value: "youtube",   label: "YouTube",   icon: "YT", needsVideo: true  },
  { value: "google",    label: "Google",    icon: "G",  needsVideo: false },
  { value: "linkedin",  label: "LinkedIn",  icon: "LI", needsVideo: false },
];

const VIDEO_REQUIRED_PLATFORMS = new Set(["tiktok", "youtube"]);

const ASSET_TYPES = [
  { value: "static_image", label: "Static Image", Icon: ImageIcon, color: "#6366f1" },
  { value: "video_ad",     label: "Video Ad",     Icon: Video,     color: "#ec4899" },
  { value: "email",        label: "Email",        Icon: Mail,      color: "#8b5cf6" },
];

const FUNNEL_STAGES = [
  { value: "tofu",     label: "ToFu",     sub: "Awareness" },
  { value: "mofu",     label: "MoFu",     sub: "Consideration" },
  { value: "bofu",     label: "BoFu",     sub: "Conversion" },
  { value: "balanced", label: "Balanced", sub: "All stages" },
];

const OBJECTIVES = [
  { value: "awareness",   label: "Awareness" },
  { value: "traffic",     label: "Traffic" },
  { value: "conversion",  label: "Conversion" },
  { value: "lead_gen",    label: "Lead Gen" },
  { value: "engagement",  label: "Engagement" },
];

const TONE_OPTIONS = [
  { value: "",               label: "BKO default" },
  { value: "urgent",         label: "Urgent" },
  { value: "playful",        label: "Playful" },
  { value: "bold",           label: "Bold" },
  { value: "emotional",      label: "Emotional" },
  { value: "professional",   label: "Professional" },
  { value: "conversational", label: "Conversational" },
];

const AGENTS: { key: "researcher"|"strategist"|"producer"|"auditor"; label: string; Icon: typeof FlaskConical; color: string }[] = [
  { key: "researcher", label: "Researcher", Icon: FlaskConical, color: "#6366f1" },
  { key: "strategist", label: "Strategist",  Icon: Lightbulb,   color: "#8b5cf6" },
  { key: "producer",   label: "Producer",    Icon: Palette,     color: "#ec4899" },
  { key: "auditor",    label: "Auditor",     Icon: Shield,      color: "#22c55e" },
];

const SUGGESTIONS = [
  "Drive Eid conversions on Instagram with emotional product storytelling",
  "Launch a new product with awareness-first TikTok content",
  "Email + static ads for a limited-time flash sale",
  "Build brand authority on LinkedIn with thought leadership posts",
];

function agentDesc(key: string, brief: string, platforms: string[], types: string[], variants: number) {
  switch (key) {
    case "researcher":
      return brief.length > 8
        ? `Researching context for: "${brief.slice(0, 40)}${brief.length > 40 ? "…" : ""}"`
        : "Analyzes industry, competitors & platform trends";
    case "strategist":
      return platforms.length
        ? `Crafts ${platforms.slice(0, 2).join(" + ")} strategy with hooks and CTAs`
        : "Builds your campaign strategy and content plan";
    case "producer":
      return `Produces ${variants} variant${variants !== 1 ? "s" : ""} × ${types.length || 1} format${types.length !== 1 ? "s" : ""}`;
    case "auditor":
      return "Scores brand fit, hook strength & platform compliance";
    default: return "";
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

/** Compact pre-flight grounding status beneath the composer */
function GroundingStrip({ businessId }: { businessId: string }) {
  const { data: biz } = useBusinessDetail(businessId);
  const { data: products } = useProducts(businessId);

  const bko = biz?.bko as Record<string, unknown> | null | undefined;
  const identity = bko?.identity as Record<string, unknown> | null | undefined;
  const hasLogo = !!identity?.logo_url;
  const productList = products?.products ?? [];
  const productCount = productList.length;
  const hasHero = productList.some((p) => p.is_hero);
  const hasImages = productList.some((p) => p.images && p.images.length > 0);
  const allGood = hasLogo && productCount > 0 && hasHero && hasImages;

  const items = [
    { ok: hasLogo,       label: "Brand logo" },
    { ok: productCount > 0, label: `${productCount} product${productCount !== 1 ? "s" : ""}` },
    { ok: hasHero,       label: "Hero product" },
    { ok: hasImages,     label: "Product images" },
  ];

  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-xs flex-wrap"
      style={{
        background: allGood ? "rgba(34,197,94,0.07)" : "rgba(245,158,11,0.07)",
        border: `1px solid ${allGood ? "rgba(34,197,94,0.2)" : "rgba(245,158,11,0.2)"}`,
      }}
    >
      <span className="font-semibold shrink-0" style={{ color: allGood ? "#22c55e" : "#f59e0b" }}>
        {allGood ? "✓ Pipeline ready" : "⚠ Pre-flight checks"}
      </span>
      {items.map(({ ok, label }) => (
        <span key={label} className="flex items-center gap-1" style={{ color: ok ? "rgba(255,255,255,0.45)" : "#f59e0b" }}>
          {ok ? <Check className="h-3 w-3 text-emerald-400" /> : <AlertCircle className="h-3 w-3" />}
          {label}
        </span>
      ))}
    </div>
  );
}

// ── Main form ─────────────────────────────────────────────────────────────────

export function CampaignForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const preselected  = searchParams.get("business_id") ?? "";

  const { data: businesses }   = useBusinesses();
  const createCampaign         = useCreateCampaign();

  const [form, setForm] = useState<CreateCampaignRequest>({
    business_id:  preselected,
    campaign_name: "",
    objective:    "awareness",
    platforms:    ["instagram"],
    asset_types:  ["static_image", "video_ad"],
    funnel_stage: "balanced",
    num_variants: 3,
    hero_products: [],
    special_brief: "",
  });

  const [heroInput,     setHeroInput]     = useState("");
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [focused,       setFocused]       = useState(false);
  const [showBizPicker, setShowBizPicker] = useState(!preselected);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const selectedBiz = businesses?.businesses.find((b) => b.id === form.business_id);
  const estAssets   = Math.max(form.platforms.length, 1) * form.asset_types.length * form.num_variants;

  // Auto-grow textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.max(el.scrollHeight, 100)}px`;
  }, [form.special_brief]);

  function toggle(field: "platforms" | "asset_types", value: string) {
    setForm((p) => {
      const current = p[field];
      const next = current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value];
      if (field === "platforms" && !current.includes(value) && VIDEO_REQUIRED_PLATFORMS.has(value)) {
        // Auto-include video_ad when selecting a video-first platform
        const assetTypes = p.asset_types.includes("video_ad")
          ? p.asset_types
          : [...p.asset_types, "video_ad"];
        return { ...p, platforms: next, asset_types: assetTypes };
      }
      return { ...p, [field]: next };
    });
  }

  function addHero() {
    const val = heroInput.trim();
    if (val && !form.hero_products.includes(val) && form.hero_products.length < 5) {
      setForm((p) => ({ ...p, hero_products: [...p.hero_products, val] }));
      setHeroInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_id)        { toast.error("Select a business first"); return; }
    if (!form.platforms.length)   { toast.error("Select at least one platform"); return; }
    if (!form.asset_types.length) { toast.error("Select at least one asset type"); return; }

    try {
      const payload: CreateCampaignRequest = {
        ...form,
        campaign_name: form.campaign_name || undefined,
        tone_override: form.tone_override || undefined,
        special_brief: form.special_brief || undefined,
      };
      const campaign = await createCampaign.mutateAsync(payload);
      toast.success("Campaign launched!");
      router.push(`/campaigns/${campaign.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create campaign");
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      {/* ── Ambient blobs ── */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div style={{ position:"absolute", width:700, height:700, borderRadius:"50%", background:"#4f46e5", filter:"blur(140px)", opacity:0.12, top:-200, left:-200, animation:"float-blob 20s ease-in-out infinite" }} />
        <div style={{ position:"absolute", width:600, height:600, borderRadius:"50%", background:"#7c3aed", filter:"blur(120px)", opacity:0.10, top:80, right:-150, animation:"float-blob 25s ease-in-out infinite", animationDelay:"-8s" }} />
        <div style={{ position:"absolute", width:500, height:500, borderRadius:"50%", background:"#1d4ed8", filter:"blur(130px)", opacity:0.08, bottom:-100, left:"40%", animation:"float-blob 22s ease-in-out infinite", animationDelay:"-15s" }} />
      </div>

      {/* ── Breadcrumb ── */}
      <div className="relative z-10 flex items-center gap-2 px-8 pt-6 pb-0">
        <Link
          href="/businesses"
          className="flex items-center justify-center h-7 w-7 rounded-lg transition-colors"
          style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.08)" }}
        >
          <ArrowLeft className="h-3.5 w-3.5 text-white/40" />
        </Link>
        <span className="text-white/20 text-sm">/</span>
        <span className="text-white/30 text-xs">Businesses</span>
        <span className="text-white/20 text-sm">/</span>
        <span className="text-white/50 text-xs font-medium">New Campaign</span>
      </div>

      {/* ── Hero ── */}
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-12 pb-10">

        {/* Business context pill */}
        {selectedBiz ? (
          <button
            type="button"
            onClick={() => setShowBizPicker(v => !v)}
            className="inline-flex items-center gap-2 mb-8 px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={{ background:"rgba(91,78,232,0.12)", border:"1px solid rgba(196,181,253,0.25)", color:"#c4b5fd" }}
          >
            <span
              className="h-5 w-5 rounded-full flex items-center justify-center text-white font-bold text-[9px]"
              style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)" }}
            >
              {selectedBiz.name.slice(0, 2).toUpperCase()}
            </span>
            {selectedBiz.name}
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <span className="text-white/30">BKO ready</span>
            <ChevronDown className="h-3 w-3 text-white/30" />
          </button>
        ) : (
          <div className="mb-8 text-xs text-white/30">
            No business selected —{" "}
            <button type="button" onClick={() => setShowBizPicker(true)} className="text-violet-400 underline underline-offset-2">
              choose one below
            </button>
          </div>
        )}

        {/* Headline */}
        <h1
          className="font-bold tracking-tight text-balance mb-4"
          style={{
            fontFamily:"'Syne', system-ui, sans-serif",
            fontSize: "clamp(34px, 5vw, 58px)",
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          <span className="text-white">Brief your agents.</span>
          <br />
          <span
            style={{
              background:"linear-gradient(100deg,#c4b5fd 0%,#ffffff 45%,#c4b5fd 100%)",
              backgroundSize:"200% 100%",
              WebkitBackgroundClip:"text",
              WebkitTextFillColor:"transparent",
              backgroundClip:"text",
              animation:"composer-shimmer 5s linear infinite",
            }}
          >
            They'll handle the rest.
          </span>
        </h1>
        <p className="text-sm font-light leading-relaxed max-w-md" style={{ color:"rgba(255,255,255,0.38)" }}>
          Describe what you need in plain language — Researcher, Strategist, Producer and Auditor take it from there.
        </p>
      </div>

      {/* ── Business picker (shown when needed) ── */}
      {showBizPicker && (
        <div className="relative z-10 mx-auto max-w-[760px] px-4 pb-4">
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)" }}
          >
            <div className="px-5 py-3 border-b" style={{ borderColor:"rgba(255,255,255,0.06)" }}>
              <p className="text-xs font-semibold" style={{ color:"rgba(255,255,255,0.35)", letterSpacing:"0.08em", textTransform:"uppercase" }}>
                Select business
              </p>
            </div>
            <div className="p-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
              {businesses?.businesses.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => { setForm(p => ({ ...p, business_id: b.id })); setShowBizPicker(false); }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all"
                  style={{
                    background: form.business_id === b.id ? "rgba(91,78,232,0.15)" : "transparent",
                    border: form.business_id === b.id ? "1px solid rgba(196,181,253,0.25)" : "1px solid transparent",
                  }}
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-[10px] font-bold shrink-0"
                    style={{ background:"linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                  >
                    {b.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white/80 truncate">{b.name}</p>
                    <p className="text-[10px]" style={{ color:"rgba(255,255,255,0.28)" }}>BKO v{b.bko_version}</p>
                  </div>
                  {form.business_id === b.id && <Check className="h-4 w-4 text-violet-400 ml-auto shrink-0" />}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Composer ── */}
      <div className="relative z-10 mx-auto max-w-[760px] px-4 pb-4">
        <div
          className={cn("composer-focused relative rounded-2xl", focused && "composer-focused")}
          style={{ borderRadius: 20 }}
        >
          <div className="composer-glow-ring" style={{ borderRadius: 20 }} />

          <div
            className="relative z-10 overflow-hidden"
            style={{
              borderRadius: 18,
              background: "rgba(13,16,38,0.95)",
              border: focused ? "1px solid rgba(91,78,232,0.4)" : "1px solid rgba(255,255,255,0.08)",
              boxShadow: focused
                ? "0 0 0 1px rgba(91,78,232,0.12), 0 40px 80px -20px rgba(0,0,0,0.7)"
                : "0 24px 48px -12px rgba(0,0,0,0.5)",
              transition: "border-color 0.3s, box-shadow 0.3s",
              backdropFilter: "blur(24px)",
            }}
          >

            {/* Brief textarea */}
            <div className="px-6 pt-5 pb-1">
              <label className="block text-[10px] font-semibold mb-2 tracking-widest uppercase" style={{ color:"rgba(255,255,255,0.22)" }}>
                Campaign brief
              </label>
              <textarea
                ref={textareaRef}
                value={form.special_brief ?? ""}
                onChange={(e) => setForm(p => ({ ...p, special_brief: e.target.value }))}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={`e.g. "Launch our Eid gift collection on Instagram and TikTok. Target 25–34 year-olds. Push conversion with emotional storytelling and a 10% off hook. Hero product is the Hunza Apricot Jam gift set."`}
                maxLength={500}
                rows={3}
                className="w-full bg-transparent border-none outline-none resize-none text-sm leading-relaxed"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  caretColor: "#c4b5fd",
                  fontFamily: "inherit",
                  minHeight: 100,
                }}
              />
            </div>

            {/* Suggestion chips */}
            {!(form.special_brief?.length ?? 0) && (
              <div className="flex flex-wrap gap-1.5 px-6 pb-3">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setForm(p => ({ ...p, special_brief: s }));
                      textareaRef.current?.focus();
                    }}
                    className="text-[11px] px-3 py-1 rounded-full transition-all"
                    style={{
                      color: "rgba(255,255,255,0.35)",
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "#c4b5fd";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(196,181,253,0.3)";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.35)";
                      (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.08)";
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}

            {(form.special_brief?.length ?? 0) > 0 && (
              <div className="flex justify-end px-6 pb-2">
                <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.2)" }}>
                  {form.special_brief?.length}/500
                </span>
              </div>
            )}

            {/* ── Separator ── */}
            <div style={{ height: 1, background: "rgba(255,255,255,0.05)", margin: "0 24px" }} />

            {/* Platform chips */}
            <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold tracking-widest uppercase shrink-0 mr-1" style={{ color:"rgba(255,255,255,0.22)" }}>
                Platforms
              </span>
              {PLATFORMS.map((p) => {
                const on = form.platforms.includes(p.value);
                const warnVideo = on && p.needsVideo && !form.asset_types.includes("video_ad");
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => toggle("platforms", p.value)}
                    className="relative text-xs px-3 py-1 rounded-full transition-all font-medium"
                    style={{
                      background: on ? "rgba(91,78,232,0.18)" : "transparent",
                      border: on ? "1px solid rgba(196,181,253,0.3)" : "1px solid rgba(255,255,255,0.08)",
                      color: on ? "#c4b5fd" : "rgba(255,255,255,0.35)",
                    }}
                    title={warnVideo ? `${p.label} works best with Video Ad selected` : undefined}
                  >
                    {p.label}
                    {warnVideo && (
                      <span className="ml-1 text-[9px] font-bold" style={{ color: "#f59e0b" }}>▲</span>
                    )}
                  </button>
                );
              })}
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 24px" }} />

            {/* Asset types + Funnel */}
            <div className="px-5 py-3 flex items-center gap-x-3 gap-y-2 flex-wrap">
              <span className="text-[9px] font-bold tracking-widest uppercase shrink-0 mr-1" style={{ color:"rgba(255,255,255,0.22)" }}>
                Assets
              </span>
              {ASSET_TYPES.map((a) => {
                const on = form.asset_types.includes(a.value);
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => toggle("asset_types", a.value)}
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full transition-all font-medium"
                    style={{
                      background: on ? `${a.color}18` : "transparent",
                      border: on ? `1px solid ${a.color}45` : "1px solid rgba(255,255,255,0.08)",
                      color: on ? a.color : "rgba(255,255,255,0.35)",
                    }}
                  >
                    <a.Icon className="h-3 w-3" />
                    {a.label}
                  </button>
                );
              })}

              <div className="ml-auto flex items-center gap-2 flex-wrap">
                <span className="text-[9px] font-bold tracking-widest uppercase shrink-0" style={{ color:"rgba(255,255,255,0.22)" }}>
                  Funnel
                </span>
                {FUNNEL_STAGES.map((f) => {
                  const on = form.funnel_stage === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, funnel_stage: f.value as CreateCampaignRequest["funnel_stage"] }))}
                      className="text-xs px-3 py-1 rounded-full transition-all font-medium"
                      style={{
                        background: on ? "rgba(139,92,246,0.18)" : "transparent",
                        border: on ? "1px solid rgba(167,139,250,0.35)" : "1px solid rgba(255,255,255,0.08)",
                        color: on ? "#a78bfa" : "rgba(255,255,255,0.35)",
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ height: 1, background: "rgba(255,255,255,0.04)", margin: "0 24px" }} />

            {/* Objective */}
            <div className="px-5 py-3 flex items-center gap-2 flex-wrap">
              <span className="text-[9px] font-bold tracking-widest uppercase shrink-0 mr-1" style={{ color:"rgba(255,255,255,0.22)" }}>
                Objective
              </span>
              {OBJECTIVES.map((o) => {
                const on = form.objective === o.value;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, objective: o.value as CreateCampaignRequest["objective"] }))}
                    className="text-xs px-3 py-1 rounded-full transition-all"
                    style={{
                      background: on ? "rgba(255,255,255,0.1)" : "transparent",
                      border: on ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
                      color: on ? "#fff" : "rgba(255,255,255,0.32)",
                      fontWeight: on ? 600 : 400,
                    }}
                  >
                    {o.label}
                  </button>
                );
              })}
            </div>

            {/* ── Footer ── */}
            <div
              className="flex items-center justify-between px-5 py-4 gap-4"
              style={{ borderTop: "1px solid rgba(255,255,255,0.05)" }}
            >
              {/* Variants */}
              <div className="flex items-center gap-2.5 shrink-0">
                <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color:"rgba(255,255,255,0.22)" }}>
                  Variants
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, num_variants: Math.max(1, p.num_variants - 1) }))}
                    className="h-6 w-6 rounded-lg flex items-center justify-center transition-all"
                    style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)" }}
                  >
                    <Minus className="h-3 w-3" />
                  </button>
                  <span className="text-sm font-bold font-mono tabular-nums w-4 text-center" style={{ color:"#c4b5fd" }}>
                    {form.num_variants}
                  </span>
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, num_variants: Math.min(10, p.num_variants + 1) }))}
                    className="h-6 w-6 rounded-lg flex items-center justify-center transition-all"
                    style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.08)", color:"rgba(255,255,255,0.4)" }}
                  >
                    <Plus className="h-3 w-3" />
                  </button>
                </div>
                <span className="text-[10px]" style={{ color:"rgba(255,255,255,0.2)" }}>
                  ≈ {estAssets} assets
                </span>
              </div>

              {/* Launch button */}
              <button
                type="submit"
                disabled={createCampaign.isPending}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all disabled:opacity-50"
                style={{
                  background: "linear-gradient(135deg,#4f46e5 0%,#7c3aed 60%,#a855f7 100%)",
                  boxShadow: "0 4px 20px rgba(91,78,232,0.4), inset 0 1px 0 rgba(255,255,255,0.12)",
                }}
                onMouseEnter={(e) => { if (!createCampaign.isPending) (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
              >
                {createCampaign.isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : <Rocket className="h-4 w-4" />}
                {createCampaign.isPending ? "Launching…" : "Launch — agents start immediately"}
              </button>
            </div>

          </div>
        </div>

        {/* Grounding strip */}
        {form.business_id && (
          <div className="mt-3">
            <GroundingStrip businessId={form.business_id} />
          </div>
        )}
      </div>

      {/* ── Advanced options (collapsible pill below composer) ── */}
      <div className="relative z-10 mx-auto max-w-[760px] px-4 pb-4">
        <button
          type="button"
          onClick={() => setShowAdvanced(v => !v)}
          className="flex items-center gap-2 text-xs transition-colors"
          style={{ color:"rgba(255,255,255,0.25)" }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.5)"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(255,255,255,0.25)"; }}
        >
          {showAdvanced ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {showAdvanced ? "Hide" : "Show"} advanced options
          <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.06)" }}>
            name · tone · hero products
          </span>
        </button>

        {showAdvanced && (
          <div
            className="mt-3 rounded-2xl overflow-hidden space-y-0"
            style={{ background:"rgba(13,16,38,0.9)", border:"1px solid rgba(255,255,255,0.07)", backdropFilter:"blur(24px)" }}
          >
            {/* Campaign name */}
            <div className="px-6 py-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-2" style={{ color:"rgba(255,255,255,0.22)" }}>
                Campaign name <span style={{ color:"rgba(255,255,255,0.12)", textTransform:"none", letterSpacing:0, fontWeight:400 }}>(optional — auto-generated if blank)</span>
              </label>
              <input
                type="text"
                value={form.campaign_name}
                onChange={(e) => setForm(p => ({ ...p, campaign_name: e.target.value }))}
                placeholder="e.g. Eid 2026 — Gifting Push"
                className="w-full bg-transparent outline-none text-sm"
                style={{ color:"rgba(255,255,255,0.75)", caretColor:"#c4b5fd" }}
              />
            </div>

            {/* Tone */}
            <div className="px-6 py-4" style={{ borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color:"rgba(255,255,255,0.22)" }}>
                Tone override <span style={{ color:"rgba(255,255,255,0.12)", textTransform:"none", letterSpacing:0, fontWeight:400 }}>(overrides BKO default)</span>
              </label>
              <div className="flex flex-wrap gap-1.5">
                {TONE_OPTIONS.map((t) => {
                  const on = (form.tone_override ?? "") === t.value;
                  return (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm(p => ({ ...p, tone_override: (t.value || undefined) as CreateCampaignRequest["tone_override"] }))}
                      className="text-xs px-3 py-1 rounded-full transition-all"
                      style={{
                        background: on ? "rgba(255,255,255,0.1)" : "transparent",
                        border: on ? "1px solid rgba(255,255,255,0.2)" : "1px solid rgba(255,255,255,0.07)",
                        color: on ? "#fff" : "rgba(255,255,255,0.32)",
                        fontWeight: on ? 600 : 400,
                      }}
                    >
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hero products */}
            <div className="px-6 py-4">
              <label className="block text-[10px] font-semibold uppercase tracking-widest mb-3" style={{ color:"rgba(255,255,255,0.22)" }}>
                Hero products <span style={{ color:"rgba(255,255,255,0.12)", textTransform:"none", letterSpacing:0, fontWeight:400 }}>(optional, max 5)</span>
              </label>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.hero_products.map((p, i) => (
                  <span
                    key={i}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
                    style={{ background:"rgba(91,78,232,0.15)", border:"1px solid rgba(196,181,253,0.25)", color:"#c4b5fd" }}
                  >
                    {p}
                    <button
                      type="button"
                      onClick={() => setForm(pr => ({ ...pr, hero_products: pr.hero_products.filter((_, ii) => ii !== i) }))}
                      className="ml-0.5 opacity-60 hover:opacity-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              {form.hero_products.length < 5 && (
                <input
                  type="text"
                  value={heroInput}
                  onChange={(e) => setHeroInput(e.target.value)}
                  placeholder="Type product name and press Enter"
                  className="w-full bg-transparent outline-none text-sm"
                  style={{ color:"rgba(255,255,255,0.75)", caretColor:"#c4b5fd" }}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addHero(); } }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Agent crew ── */}
      <div className="relative z-10 mx-auto max-w-[760px] px-4 pb-16 pt-4">
        <p className="text-center text-[10px] font-semibold uppercase tracking-widest mb-6" style={{ color:"rgba(255,255,255,0.18)" }}>
          Your AI crew — briefed and standing by
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {AGENTS.map((agent, i) => (
            <div
              key={agent.key}
              className="flex flex-col items-center gap-3 p-4 rounded-2xl transition-all"
              style={{
                background: "rgba(13,16,38,0.7)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(12px)",
              }}
            >
              {/* Avatar with pulse */}
              <div className="relative">
                <div
                  className="rounded-2xl overflow-hidden"
                  style={{ width:56, height:56, background:`${agent.color}12`, border:`1px solid ${agent.color}20` }}
                >
                  <AgentCanvas agent={agent.key} size={56} active />
                </div>
                {/* Pulse ring */}
                <div
                  className="absolute inset-[-4px] rounded-[20px] border pointer-events-none"
                  style={{
                    borderColor: agent.color,
                    animation: "agent-pulse-ring 2.5s ease-out infinite",
                    animationDelay: `${i * 0.55}s`,
                  }}
                />
              </div>

              <div className="text-center">
                <p className="text-xs font-semibold mb-0.5" style={{ color: agent.color }}>
                  {agent.label}
                </p>
                <p className="text-[10px] leading-relaxed" style={{ color:"rgba(255,255,255,0.28)" }}>
                  {agentDesc(agent.key, form.special_brief ?? "", form.platforms, form.asset_types, form.num_variants)}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Summary strip */}
        <div
          className="mt-4 flex items-center justify-center gap-6 py-3 px-5 rounded-2xl flex-wrap text-xs"
          style={{ background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.05)" }}
        >
          {[
            { label: "Platforms",   value: form.platforms.length || "—" },
            { label: "Asset types", value: form.asset_types.length || "—" },
            { label: "Variants",    value: form.num_variants },
            { label: "Est. assets", value: estAssets, accent: true },
          ].map(({ label, value, accent }) => (
            <div key={label} className="flex items-center gap-2">
              <span style={{ color:"rgba(255,255,255,0.25)" }}>{label}</span>
              <span
                className="font-bold tabular-nums"
                style={{ color: accent ? "#c4b5fd" : "rgba(255,255,255,0.6)" }}
              >
                {value}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-1.5" style={{ color:"rgba(255,255,255,0.25)" }}>
            <Sparkles className="h-3 w-3 text-violet-400" />
            <span>Pipeline ready in ~3 min</span>
          </div>
        </div>
      </div>

    </form>
  );
}
