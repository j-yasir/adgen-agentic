"use client";

import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TagInput } from "./field-helpers";
import type { WizardFormData } from "./wizard-shell";

type Props = {
  data: WizardFormData;
  updateSection: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
};

export function StepMarketing({ data, updateSection }: Props) {
  const m = data.marketing;
  const update = (field: string, value: unknown) =>
    updateSection("marketing", { ...m, [field]: value });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Conversion Goal</Label>
          <Select value={m.primary_conversion_goal} onValueChange={(v) => update("primary_conversion_goal", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="purchase">Purchase</SelectItem>
              <SelectItem value="free_trial">Free Trial</SelectItem>
              <SelectItem value="demo_booking">Demo Booking</SelectItem>
              <SelectItem value="lead_form">Lead Form</SelectItem>
              <SelectItem value="app_install">App Install</SelectItem>
              <SelectItem value="newsletter">Newsletter</SelectItem>
              <SelectItem value="call">Call</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Budget Tier</Label>
          <Select value={m.budget_tier} onValueChange={(v) => update("budget_tier", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="small">Small</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="large">Large</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Ad Style Preference</Label>
        <Select value={m.ad_style_preference ?? ""} onValueChange={(v) => update("ad_style_preference", v || undefined)}>
          <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
          <SelectContent>
            <SelectItem value="lifestyle">Lifestyle</SelectItem>
            <SelectItem value="product_demo">Product Demo</SelectItem>
            <SelectItem value="testimonial">Testimonial</SelectItem>
            <SelectItem value="minimalist">Minimalist</SelectItem>
            <SelectItem value="bold_graphic">Bold Graphic</SelectItem>
            <SelectItem value="ugc_style">UGC Style</SelectItem>
            <SelectItem value="animated">Animated</SelectItem>
            <SelectItem value="comparison">Comparison</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <TagInput label="Active Platforms" values={m.active_platforms} onChange={(v) => update("active_platforms", v)} placeholder="e.g. Instagram, Facebook" />
      <TagInput label="Emotional Hooks" values={m.emotional_hooks} onChange={(v) => update("emotional_hooks", v)} placeholder="e.g. FOMO, Relief, Confidence" />
      <TagInput label="Value Propositions" values={m.value_propositions} onChange={(v) => update("value_propositions", v)} placeholder="e.g. Save 50% on ad spend" />
    </div>
  );
}
