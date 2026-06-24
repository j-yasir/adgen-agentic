"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCreateCampaign } from "../hooks/use-campaigns";
import { useBusinesses } from "@/features/business/hooks/use-businesses";
import { toast } from "sonner";
import { Loader2, Rocket } from "lucide-react";
import type { CreateCampaignRequest } from "../types";

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "facebook", label: "Facebook" },
  { value: "tiktok", label: "TikTok" },
  { value: "youtube", label: "YouTube" },
  { value: "google", label: "Google" },
  { value: "linkedin", label: "LinkedIn" },
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
    funnel_stage: "balanced",
    num_variants: 3,
    special_brief: "",
  });

  function togglePlatform(platform: string) {
    setForm((prev) => ({
      ...prev,
      platforms: prev.platforms.includes(platform)
        ? prev.platforms.filter((p) => p !== platform)
        : [...prev.platforms, platform],
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

    try {
      const campaign = await createCampaign.mutateAsync({
        ...form,
        campaign_name: form.campaign_name || undefined,
        special_brief: form.special_brief || undefined,
      });
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
        <CardContent className="space-y-5">
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

          <div className="space-y-2">
            <Label>Campaign Name <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Input
              value={form.campaign_name}
              onChange={(e) => setForm({ ...form, campaign_name: e.target.value })}
              placeholder="e.g. Summer Sale Push"
            />
          </div>

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
                    onCheckedChange={() => togglePlatform(p.value)}
                  />
                  <span className="text-sm">{p.label}</span>
                </label>
              ))}
            </div>
          </div>

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

          <div className="space-y-2">
            <Label>Special Brief <span className="text-muted-foreground text-xs">(optional, max 300 chars)</span></Label>
            <Textarea
              value={form.special_brief}
              onChange={(e) => setForm({ ...form, special_brief: e.target.value })}
              placeholder="Any specific instructions for the agents..."
              maxLength={300}
              rows={3}
            />
          </div>

          <Button
            type="submit"
            className="w-full bg-indigo-600 text-white hover:bg-indigo-500"
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
