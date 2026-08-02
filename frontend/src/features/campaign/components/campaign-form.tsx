"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateCampaign } from "../hooks/use-campaigns";
import { useBusinesses } from "@/features/business/hooks/use-businesses";
import { toast } from "sonner";
import {
  Loader2,
  Rocket,
  X,
  FlaskConical,
  Lightbulb,
  Palette,
  Shield,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { CreateCampaignRequest } from "../types";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
];

const ASSET_TYPES = [
  { value: "static_image", label: "Static Image" },
  { value: "video_ad", label: "Video Ad" },
  { value: "email", label: "Email" },
];

const FUNNEL_STAGES = [
  { value: "tofu", label: "TOFU", sub: "Awareness" },
  { value: "mofu", label: "MOFU", sub: "Consideration" },
  { value: "bofu", label: "BOFU", sub: "Conversion" },
  { value: "balanced", label: "Balanced", sub: "All stages" },
];

const OBJECTIVES = [
  { value: "awareness", label: "Awareness" },
  { value: "traffic", label: "Traffic" },
  { value: "conversion", label: "Conversion" },
  { value: "lead_gen", label: "Lead Generation" },
  { value: "engagement", label: "Engagement" },
];

const TONE_OPTIONS = [
  { value: "", label: "BKO default" },
  { value: "urgent", label: "Urgent" },
  { value: "playful", label: "Playful" },
  { value: "bold", label: "Bold" },
  { value: "emotional", label: "Emotional" },
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
];

const AGENT_CONFIGS = [
  {
    key: "researcher",
    label: "Researcher",
    Icon: FlaskConical,
    color: "#6366f1",
    bg: "rgba(99,102,241,0.08)",
  },
  {
    key: "strategist",
    label: "Strategist",
    Icon: Lightbulb,
    color: "#8b5cf6",
    bg: "rgba(139,92,246,0.08)",
  },
  {
    key: "producer",
    label: "Producer",
    Icon: Palette,
    color: "#ec4899",
    bg: "rgba(236,72,153,0.08)",
  },
  {
    key: "auditor",
    label: "Auditor",
    Icon: Shield,
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
  },
];

function getAgentDesc(
  agentKey: string,
  brief: string,
  platforms: string[],
  assetTypes: string[],
  numVariants: number
): string {
  switch (agentKey) {
    case "researcher":
      return brief.length > 10
        ? `Will research context around: "${brief.slice(0, 45)}${brief.length > 45 ? "…" : ""}"`
        : "Will analyse your industry, competitors & platform trends";
    case "strategist":
      return platforms.length > 0
        ? `Will craft a ${platforms.slice(0, 2).join(" + ")} strategy with hooks and CTAs`
        : "Will build a campaign strategy and content plan";
    case "producer":
      return `Will produce ${numVariants} variant${numVariants !== 1 ? "s" : ""} × ${assetTypes.length || 1} format${assetTypes.length !== 1 ? "s" : ""}`;
    case "auditor":
      return "Will score every asset — brand fit, hook strength, platform compliance";
    default:
      return "";
  }
}

export function CampaignForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedBusiness = searchParams.get("business_id") ?? "";

  const { data: businesses } = useBusinesses();
  const createCampaign = useCreateCampaign();

  const [form, setForm] = useState<CreateCampaignRequest>({
    business_id: preselectedBusiness,
    campaign_name: "",
    objective: "awareness",
    platforms: ["instagram"],
    asset_types: ["static_image", "video_ad"],
    funnel_stage: "balanced",
    num_variants: 3,
    hero_products: [],
    special_brief: "",
  });

  const [heroInput, setHeroInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);

  const selectedBusiness = businesses?.businesses.find((b) => b.id === form.business_id);

  function togglePill(field: "platforms" | "asset_types", value: string) {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].includes(value)
        ? prev[field].filter((v) => v !== value)
        : [...prev[field], value],
    }));
  }

  function addHeroProduct() {
    const val = heroInput.trim();
    if (val && !form.hero_products.includes(val) && form.hero_products.length < 5) {
      setForm((prev) => ({ ...prev, hero_products: [...prev.hero_products, val] }));
      setHeroInput("");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.business_id) {
      toast.error("Please select a business");
      return;
    }
    if (form.platforms.length === 0) {
      toast.error("Select at least one platform");
      return;
    }
    if (form.asset_types.length === 0) {
      toast.error("Select at least one asset type");
      return;
    }

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
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-6 items-start">

        {/* ── Left: form ── */}
        <div className="space-y-4">

          {/* Business selector (only when not pre-selected) */}
          {!preselectedBusiness && (
            <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
              <Label className="text-sm font-semibold text-slate-700">Business *</Label>
              <Select
                value={form.business_id}
                onValueChange={(v) => setForm({ ...form, business_id: v ?? "" })}
              >
                <SelectTrigger className="border-slate-200 bg-slate-50">
                  <SelectValue placeholder="Choose a business…" />
                </SelectTrigger>
                <SelectContent>
                  {businesses?.businesses.map((b) => (
                    <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Business context strip */}
          {selectedBusiness && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.15)" }}
            >
              <div
                className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0"
                style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
              >
                {selectedBusiness.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800 truncate">{selectedBusiness.name}</p>
                <p className="text-xs text-slate-500">BKO v{selectedBusiness.bko_version} loaded · Researcher ready</p>
              </div>
              <span
                className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full"
                style={{ background: "rgba(34,197,94,0.1)", color: "#16a34a" }}
              >
                ✓ Ready
              </span>
            </div>
          )}

          {/* Hero: Campaign Brief */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <div>
              <p className="text-base font-bold text-slate-800">Campaign Brief</p>
              <p className="text-xs text-slate-400 mt-0.5">
                Tell the agents what you want — the more detail, the better the output
              </p>
            </div>
            <Textarea
              value={form.special_brief ?? ""}
              onChange={(e) => setForm({ ...form, special_brief: e.target.value })}
              placeholder="e.g. Launching a limited summer collection. Target 25–34 year olds who value sustainability. Push conversion on Instagram and TikTok with emotional storytelling…"
              maxLength={500}
              rows={5}
              className="border-slate-200 bg-slate-50 placeholder:text-slate-300 text-sm resize-none"
              style={{ outline: "none" }}
            />
            {(form.special_brief?.length ?? 0) > 0 && (
              <p className="text-xs text-slate-400 text-right">{form.special_brief?.length ?? 0}/500</p>
            )}
          </div>

          {/* Platforms */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Platforms *</p>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map((p) => {
                const active = form.platforms.includes(p.value);
                return (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => togglePill("platforms", p.value)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all",
                      active
                        ? "text-white border-transparent shadow-sm"
                        : "text-slate-500 border-slate-200 bg-slate-50 hover:border-slate-300"
                    )}
                    style={active ? { background: "linear-gradient(135deg,#4f46e5,#7c3aed)" } : {}}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Asset Types */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-sm font-semibold text-slate-700">Asset Types *</p>
            <div className="flex flex-wrap gap-2">
              {ASSET_TYPES.map((a) => {
                const active = form.asset_types.includes(a.value);
                return (
                  <button
                    key={a.value}
                    type="button"
                    onClick={() => togglePill("asset_types", a.value)}
                    className={cn(
                      "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all",
                      active
                        ? "text-white border-transparent shadow-sm"
                        : "text-slate-500 border-slate-200 bg-slate-50 hover:border-slate-300"
                    )}
                    style={active ? { background: "linear-gradient(135deg,#ec4899,#8b5cf6)" } : {}}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Funnel + Objective */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Funnel Stage</p>
              <div className="grid grid-cols-4 gap-2">
                {FUNNEL_STAGES.map((f) => {
                  const active = form.funnel_stage === f.value;
                  return (
                    <button
                      key={f.value}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, funnel_stage: f.value as CreateCampaignRequest["funnel_stage"] })
                      }
                      className={cn(
                        "flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl border text-center transition-all",
                        active
                          ? "border-indigo-300 bg-indigo-50"
                          : "border-slate-200 bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      <span className={cn("text-xs font-bold", active ? "text-indigo-600" : "text-slate-600")}>
                        {f.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{f.sub}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700">Objective</p>
              <div className="flex flex-wrap gap-2">
                {OBJECTIVES.map((o) => {
                  const active = form.objective === o.value;
                  return (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() =>
                        setForm({ ...form, objective: o.value as CreateCampaignRequest["objective"] })
                      }
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-sm font-medium border transition-all",
                        active
                          ? "bg-slate-800 text-white border-slate-800"
                          : "text-slate-500 border-slate-200 bg-slate-50 hover:border-slate-300"
                      )}
                    >
                      {o.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Variants */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Number of Variants</p>
              <span className="font-mono text-xl font-bold" style={{ color: "#6366f1" }}>
                {form.num_variants}
              </span>
            </div>
            <Slider
              value={[form.num_variants]}
              onValueChange={(v) =>
                setForm({ ...form, num_variants: Array.isArray(v) ? v[0] : v })
              }
              min={1}
              max={10}
              step={1}
            />
            <p className="text-xs text-slate-400">
              Each variant gets a unique hook, angle, and copy treatment
            </p>
          </div>

          {/* Advanced toggle */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <button
              type="button"
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              Advanced options
              {showAdvanced ? (
                <ChevronUp className="h-4 w-4 text-slate-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-400" />
              )}
            </button>

            {showAdvanced && (
              <div className="px-5 pb-5 space-y-5 border-t border-slate-100 pt-4">
                {/* Campaign name */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    Campaign Name <span className="text-slate-400 font-normal">(optional)</span>
                  </p>
                  <input
                    type="text"
                    value={form.campaign_name}
                    onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
                    placeholder="e.g. Eid 2026 — Gifting Push"
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300"
                  />
                </div>

                {/* Tone override */}
                <div className="space-y-2">
                  <p className="text-sm font-semibold text-slate-700">
                    Tone Override <span className="text-slate-400 font-normal">(overrides BKO default)</span>
                  </p>
                  <Select
                    value={form.tone_override ?? ""}
                    onValueChange={(v) =>
                      setForm({
                        ...form,
                        tone_override: (v || undefined) as CreateCampaignRequest["tone_override"],
                      })
                    }
                  >
                    <SelectTrigger className="border-slate-200 bg-slate-50">
                      <SelectValue placeholder="Use BKO default" />
                    </SelectTrigger>
                    <SelectContent>
                      {TONE_OPTIONS.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Hero products */}
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-700">
                    Hero Products <span className="text-slate-400 font-normal">(optional, max 5)</span>
                  </p>
                  {form.hero_products.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.hero_products.map((p, i) => (
                        <Badge
                          key={i}
                          className="bg-indigo-50 text-indigo-600 border-indigo-200 gap-1 pr-1"
                        >
                          {p}
                          <button
                            type="button"
                            className="hover:text-indigo-800 ml-0.5"
                            onClick={() =>
                              setForm((prev) => ({
                                ...prev,
                                hero_products: prev.hero_products.filter((_, ii) => ii !== i),
                              }))
                            }
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                  {form.hero_products.length < 5 && (
                    <input
                      type="text"
                      value={heroInput}
                      onChange={(e) => setHeroInput(e.target.value)}
                      placeholder="Type product name and press Enter"
                      className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-indigo-300"
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addHeroProduct();
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Launch button */}
          <button
            type="submit"
            disabled={createCampaign.isPending}
            className="w-full flex items-center justify-center gap-2.5 py-4 rounded-2xl text-white text-base font-bold shadow-lg transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ background: "linear-gradient(135deg,#1e1048,#3b1078,#7c3aed,#a855f7)" }}
          >
            {createCampaign.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Rocket className="h-5 w-5" />
            )}
            {createCampaign.isPending ? "Launching…" : "Launch Campaign — Agents start immediately"}
          </button>
        </div>

        {/* ── Right: agent preview + summary ── */}
        <div className="lg:sticky lg:top-6 space-y-3">
          {/* AI Crew */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
              Your AI Crew
            </p>
            <div className="space-y-3">
              {AGENT_CONFIGS.map(({ key, label, Icon, color, bg }) => (
                <div
                  key={key}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: bg }}
                >
                  <div
                    className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0"
                    style={{ background: color }}
                  >
                    <Icon className="h-4 w-4 text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold" style={{ color }}>
                      {label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                      {getAgentDesc(key, form.special_brief ?? "", form.platforms, form.asset_types, form.num_variants)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
              Summary
            </p>
            <div className="space-y-2.5">
              {[
                { label: "Platforms", value: form.platforms.length > 0 ? `${form.platforms.length} selected` : "—" },
                { label: "Asset types", value: form.asset_types.length > 0 ? `${form.asset_types.length} selected` : "—" },
                { label: "Variants", value: form.num_variants },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">{label}</span>
                  <span className="font-semibold text-slate-800">{value}</span>
                </div>
              ))}
              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">Est. total assets</span>
                <span className="font-bold text-lg" style={{ color: "#6366f1" }}>
                  {form.platforms.length * form.asset_types.length * form.num_variants}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </form>
  );
}
