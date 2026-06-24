"use client";

import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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

export function StepBrand({ data, updateSection }: Props) {
  const b = data.brand;
  const update = (field: string, value: unknown) =>
    updateSection("brand", { ...b, [field]: value });

  return (
    <div className="space-y-5">
      <StringListField label="Brand Personality Traits *" values={b.personality_traits} onChange={(v) => update("personality_traits", v)} placeholder="e.g. Bold, Trustworthy" max={6} />

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Primary Tone *</Label>
          <Select value={b.primary_tone} onValueChange={(v) => update("primary_tone", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="casual">Casual</SelectItem>
              <SelectItem value="playful">Playful</SelectItem>
              <SelectItem value="authoritative">Authoritative</SelectItem>
              <SelectItem value="empathetic">Empathetic</SelectItem>
              <SelectItem value="bold">Bold</SelectItem>
              <SelectItem value="inspirational">Inspirational</SelectItem>
              <SelectItem value="professional_casual">Professional Casual</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Writing Style *</Label>
          <Select value={b.writing_style} onValueChange={(v) => update("writing_style", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="conversational">Conversational</SelectItem>
              <SelectItem value="formal">Formal</SelectItem>
              <SelectItem value="technical">Technical</SelectItem>
              <SelectItem value="punchy">Punchy</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Design Aesthetic</Label>
          <Select value={b.design_aesthetic ?? ""} onValueChange={(v) => update("design_aesthetic", v || undefined)}>
            <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="clean_minimal">Clean Minimal</SelectItem>
              <SelectItem value="bold_vibrant">Bold Vibrant</SelectItem>
              <SelectItem value="luxury">Luxury</SelectItem>
              <SelectItem value="playful">Playful</SelectItem>
              <SelectItem value="corporate">Corporate</SelectItem>
              <SelectItem value="dark_tech">Dark Tech</SelectItem>
              <SelectItem value="warm_earthy">Warm Earthy</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Imagery Style</Label>
          <Input value={b.imagery_style ?? ""} onChange={(e) => update("imagery_style", e.target.value || undefined)} placeholder="e.g. Flat illustration, Photography" />
        </div>
      </div>

      <TagInput label="Brand Colors (hex)" values={b.primary_colors} onChange={(v) => update("primary_colors", v)} placeholder="e.g. #6366F1" />
      <TagInput label="Do's" values={b.dos} onChange={(v) => update("dos", v)} placeholder="e.g. Use active voice" />
      <TagInput label="Don'ts" values={b.donts} onChange={(v) => update("donts", v)} placeholder="e.g. No jargon" />
    </div>
  );
}
