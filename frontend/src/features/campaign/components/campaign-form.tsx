"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useCreateCampaign } from "../hooks/use-campaigns";
import { useBusinesses } from "@/features/business/hooks/use-businesses";
import { toast } from "sonner";
import { Loader2, Rocket, X } from "lucide-react";
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

const TONE_OPTIONS = [
  { value: "", label: "Use BKO default" },
  { value: "urgent", label: "Urgent" },
  { value: "playful", label: "Playful" },
  { value: "bold", label: "Bold" },
  { value: "emotional", label: "Emotional" },
  { value: "professional", label: "Professional" },
  { value: "conversational", label: "Conversational" },
];

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
    asset_types: ["static_image", "video_ad", "email"],
    funnel_stage: "balanced",
    num_variants: 3,
    hero_products: [],
    special_brief: "",
  });

  const [heroInput, setHeroInput] = useState("");

  function toggleOption(field: "platforms" | "asset_types", value: string) {
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

  function removeHeroProduct(index: number) {
    setForm((prev) => ({
      ...prev,
      hero_products: prev.hero_products.filter((_, i) => i !== index),
    }));
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
    <form onSubmit={handleSubmit} className="max-w-2xl mx-auto space-y-6">
      <Card className="border-border/50 bg-card/50">
        <CardHeader>
          <CardTitle>Launch Campaign</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Business */}
          <div className="space-y-2">
            <Label>Business *</Label>
            <Select value={form.business_id} onValueChange={(v) => setForm({ ...form, business_id: v ?? "" })}>
              <SelectTrigger><SelectValue placeholder="Select a business..." /></SelectTrigger>
              <SelectContent>
                {businesses?.businesses.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Campaign Name */}
          <div className="space-y-2">
            <Label>Campaign Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={form.campaign_name}
              onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
              placeholder="e.g. Eid 2026 — Gifting Conversion Push"
            />
          </div>

          <Separator className="opacity-20" />

          {/* Objective + Funnel */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Objective *</Label>
              <Select value={form.objective} onValueChange={(v) => setForm({ ...form, objective: v as CreateCampaignRequest["objective"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="awareness">Awareness</SelectItem>
                  <SelectItem value="traffic">Traffic</SelectItem>
                  <SelectItem value="conversion">Conversion</SelectItem>
                  <SelectItem value="lead_gen">Lead Generation</SelectItem>
                  <SelectItem value="engagement">Engagement</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Funnel Stage</Label>
              <Select value={form.funnel_stage} onValueChange={(v) => setForm({ ...form, funnel_stage: v as CreateCampaignRequest["funnel_stage"] })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="tofu">Top of Funnel (TOFU)</SelectItem>
                  <SelectItem value="mofu">Middle of Funnel (MOFU)</SelectItem>
                  <SelectItem value="bofu">Bottom of Funnel (BOFU)</SelectItem>
                  <SelectItem value="balanced">Balanced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Platforms */}
          <div className="space-y-3">
            <Label>Platforms *</Label>
            <div className="grid grid-cols-3 gap-2">
              {PLATFORMS.map((p) => (
                <label
                  key={p.value}
                  className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={form.platforms.includes(p.value)}
                    onCheckedChange={() => toggleOption("platforms", p.value)}
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Asset Types */}
          <div className="space-y-3">
            <Label>Asset Types *</Label>
            <div className="grid grid-cols-3 gap-2">
              {ASSET_TYPES.map((a) => (
                <label
                  key={a.value}
                  className="flex items-center gap-2 rounded-lg border border-border/50 px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                >
                  <Checkbox
                    checked={form.asset_types.includes(a.value)}
                    onCheckedChange={() => toggleOption("asset_types", a.value)}
                  />
                  <span className="text-sm">{a.label}</span>
                </label>
              ))}
            </div>
          </div>

          <Separator className="opacity-20" />

          {/* Tone Override */}
          <div className="space-y-2">
            <Label>Tone Override <span className="text-muted-foreground text-xs">(optional — overrides BKO default)</span></Label>
            <Select value={form.tone_override ?? ""} onValueChange={(v) => setForm({ ...form, tone_override: (v || undefined) as CreateCampaignRequest["tone_override"] })}>
              <SelectTrigger><SelectValue placeholder="Use BKO default" /></SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Hero Products */}
          <div className="space-y-3">
            <Label>Hero Products <span className="text-muted-foreground text-xs">(optional, max 5 — should match BKO offerings)</span></Label>
            {form.hero_products.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.hero_products.map((p, i) => (
                  <Badge key={i} className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20 gap-1">
                    {p}
                    <button type="button" onClick={() => removeHeroProduct(i)}>
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {form.hero_products.length < 5 && (
              <Input
                value={heroInput}
                onChange={(e) => setHeroInput(e.target.value)}
                placeholder="Type product name and press Enter"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addHeroProduct();
                  }
                }}
              />
            )}
          </div>

          {/* Num Variants */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Number of Variants</Label>
              <span className="font-mono text-sm text-indigo-400">{form.num_variants}</span>
            </div>
            <Slider
              value={[form.num_variants]}
              onValueChange={(v) => setForm({ ...form, num_variants: Array.isArray(v) ? v[0] : v })}
              min={1}
              max={10}
              step={1}
            />
          </div>

          {/* Special Brief */}
          <div className="space-y-2">
            <Label>Special Brief <span className="text-muted-foreground text-xs">(optional, max 500 chars)</span></Label>
            <Textarea
              value={form.special_brief}
              onChange={(e) => setForm({ ...form, special_brief: e.target.value })}
              placeholder="Any specific instructions for the agents..."
              maxLength={500}
              rows={3}
            />
            {form.special_brief && (
              <p className="text-xs text-muted-foreground text-right">{form.special_brief.length}/500</p>
            )}
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20"
            disabled={createCampaign.isPending}
            size="lg"
          >
            {createCampaign.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Rocket className="mr-2 h-4 w-4" />
            )}
            Launch Campaign
          </Button>
        </CardContent>
      </Card>
    </form>
  );
}
