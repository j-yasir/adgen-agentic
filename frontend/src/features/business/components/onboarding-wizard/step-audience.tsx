"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StringListField, TagInput } from "./field-helpers";
import type { WizardFormData } from "./wizard-shell";

type Props = {
  data: WizardFormData;
  updateSection: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
};

export function StepAudience({ data, updateSection }: Props) {
  const a = data.audience;
  const update = (field: string, value: unknown) =>
    updateSection("audience", { ...a, [field]: value });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Geography *</Label>
          <Input value={a.geography} onChange={(e) => update("geography", e.target.value)} placeholder="e.g. Pakistan, Middle East" />
        </div>
        <div className="space-y-2">
          <Label>Language</Label>
          <Input value={a.language} onChange={(e) => update("language", e.target.value)} placeholder="English" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Age Range</Label>
          <Input value={a.age_range ?? ""} onChange={(e) => update("age_range", e.target.value || undefined)} placeholder="e.g. 25-45" />
        </div>
        <div className="space-y-2">
          <Label>Awareness Level</Label>
          <Select value={a.audience_awareness_level} onValueChange={(v) => update("audience_awareness_level", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="unaware">Unaware</SelectItem>
              <SelectItem value="problem_aware">Problem Aware</SelectItem>
              <SelectItem value="solution_aware">Solution Aware</SelectItem>
              <SelectItem value="product_aware">Product Aware</SelectItem>
              <SelectItem value="most_aware">Most Aware</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <StringListField label="Pain Points *" values={a.pain_points} onChange={(v) => update("pain_points", v)} placeholder="e.g. Too expensive to run ads" max={6} />
      <StringListField label="Desired Outcomes *" values={a.desired_outcomes} onChange={(v) => update("desired_outcomes", v)} placeholder="e.g. Increase brand awareness" max={6} />

      <TagInput label="Interests" values={a.interests} onChange={(v) => update("interests", v)} placeholder="Type an interest and press Enter" />
      <TagInput label="Online Platforms" values={a.online_platforms} onChange={(v) => update("online_platforms", v)} placeholder="e.g. Instagram, TikTok" />
    </div>
  );
}
