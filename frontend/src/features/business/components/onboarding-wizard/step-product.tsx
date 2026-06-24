"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StringListField } from "./field-helpers";
import type { WizardFormData } from "./wizard-shell";

type Props = {
  data: WizardFormData;
  updateSection: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
};

export function StepProduct({ data, updateSection }: Props) {
  const p = data.product;
  const update = (field: string, value: unknown) =>
    updateSection("product", { ...p, [field]: value });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Product Name *</Label>
          <Input value={p.name} onChange={(e) => update("name", e.target.value)} placeholder="Product name" />
        </div>
        <div className="space-y-2">
          <Label>Product Type *</Label>
          <Select value={p.product_type} onValueChange={(v) => update("product_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="saas_product">SaaS</SelectItem>
              <SelectItem value="physical">Physical</SelectItem>
              <SelectItem value="service">Service</SelectItem>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="digital">Digital</SelectItem>
              <SelectItem value="marketplace">Marketplace</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description *</Label>
        <Textarea value={p.description} onChange={(e) => update("description", e.target.value)} placeholder="What does your product do?" rows={2} />
      </div>

      <StringListField label="Key Features *" values={p.key_features} onChange={(v) => update("key_features", v)} placeholder="e.g. Real-time analytics" />
      <StringListField label="Key Benefits *" values={p.key_benefits} onChange={(v) => update("key_benefits", v)} placeholder="e.g. Save 10 hours/week" />
      <StringListField label="Unique Selling Points *" values={p.unique_selling_points} onChange={(v) => update("unique_selling_points", v)} placeholder="e.g. Only AI-powered solution in market" max={5} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Pricing Model</Label>
          <Select value={p.pricing_model} onValueChange={(v) => update("pricing_model", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="one_time">One Time</SelectItem>
              <SelectItem value="subscription">Subscription</SelectItem>
              <SelectItem value="freemium">Freemium</SelectItem>
              <SelectItem value="pay_per_use">Pay Per Use</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
              <SelectItem value="free">Free</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Primary CTA *</Label>
          <Input value={p.primary_cta} onChange={(e) => update("primary_cta", e.target.value)} placeholder="e.g. Start free trial" />
        </div>
      </div>

      <div className="flex gap-6">
        <div className="flex items-center gap-2">
          <Checkbox checked={p.free_trial_available} onCheckedChange={(v) => update("free_trial_available", !!v)} />
          <Label>Free trial available</Label>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox checked={p.demo_available} onCheckedChange={(v) => update("demo_available", !!v)} />
          <Label>Demo available</Label>
        </div>
      </div>
    </div>
  );
}
