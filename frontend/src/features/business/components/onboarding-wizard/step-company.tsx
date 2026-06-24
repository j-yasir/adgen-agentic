"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WizardFormData } from "./wizard-shell";

type Props = {
  data: WizardFormData;
  updateSection: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
};

export function StepCompany({ data, updateSection }: Props) {
  const c = data.company;
  const update = (field: string, value: unknown) =>
    updateSection("company", { ...c, [field]: value });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Company Name *</Label>
          <Input value={c.name} onChange={(e) => update("name", e.target.value)} placeholder="Acme Corp" />
        </div>
        <div className="space-y-2">
          <Label>Industry *</Label>
          <Input value={c.industry} onChange={(e) => update("industry", e.target.value)} placeholder="e.g. Food & Beverage" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Business Type *</Label>
          <Select value={c.business_type} onValueChange={(v) => update("business_type", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="B2B">B2B</SelectItem>
              <SelectItem value="B2C">B2C</SelectItem>
              <SelectItem value="B2B2C">B2B2C</SelectItem>
              <SelectItem value="D2C">D2C</SelectItem>
              <SelectItem value="marketplace">Marketplace</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Company Size *</Label>
          <Select value={c.company_size} onValueChange={(v) => update("company_size", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="startup">Startup</SelectItem>
              <SelectItem value="smb">SMB</SelectItem>
              <SelectItem value="mid-market">Mid-Market</SelectItem>
              <SelectItem value="enterprise">Enterprise</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Website</Label>
          <Input value={c.website ?? ""} onChange={(e) => update("website", e.target.value || undefined)} placeholder="https://example.com" />
        </div>
        <div className="space-y-2">
          <Label>Tagline</Label>
          <Input value={c.tagline ?? ""} onChange={(e) => update("tagline", e.target.value || undefined)} placeholder="Your snappy tagline" />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Description * <span className="text-xs text-muted-foreground">(min 30 chars)</span></Label>
        <Textarea
          value={c.description}
          onChange={(e) => update("description", e.target.value)}
          placeholder="Describe your company in one paragraph..."
          rows={3}
        />
      </div>

      <div className="space-y-2">
        <Label>Mission</Label>
        <Input value={c.mission ?? ""} onChange={(e) => update("mission", e.target.value || undefined)} placeholder="Our mission is to..." />
      </div>
    </div>
  );
}
