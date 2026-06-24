"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StringListField } from "./field-helpers";
import { Plus, Trash2 } from "lucide-react";
import type { WizardFormData } from "./wizard-shell";
import type { CompetitorFormEntry } from "../../types";

type Props = {
  data: WizardFormData;
  updateSection: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
};

export function StepCompetitive({ data, updateSection }: Props) {
  const c = data.competitive;
  const update = (field: string, value: unknown) =>
    updateSection("competitive", { ...c, [field]: value });

  function updateCompetitor(index: number, field: string, value: unknown) {
    const updated = [...c.competitors];
    updated[index] = { ...updated[index], [field]: value };
    update("competitors", updated);
  }

  function addCompetitor() {
    update("competitors", [
      ...c.competitors,
      { name: "", strengths: [], weaknesses: [], our_differentiator: "" } as CompetitorFormEntry,
    ]);
  }

  function removeCompetitor(index: number) {
    update("competitors", c.competitors.filter((_, i) => i !== index));
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Market Position *</Label>
          <Select value={c.market_position} onValueChange={(v) => update("market_position", v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="leader">Leader</SelectItem>
              <SelectItem value="challenger">Challenger</SelectItem>
              <SelectItem value="niche">Niche</SelectItem>
              <SelectItem value="emerging">Emerging</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Positioning Statement *</Label>
        <Textarea value={c.positioning_statement} onChange={(e) => update("positioning_statement", e.target.value)} placeholder="We are the only X that does Y for Z..." rows={2} />
      </div>

      <StringListField label="Primary Differentiators *" values={c.primary_differentiators} onChange={(v) => update("primary_differentiators", v)} placeholder="e.g. AI-powered automation" max={5} />

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Competitors</Label>
          {c.competitors.length < 5 && (
            <Button type="button" variant="ghost" size="sm" onClick={addCompetitor}>
              <Plus className="mr-1 h-3 w-3" /> Add Competitor
            </Button>
          )}
        </div>

        {c.competitors.map((comp, i) => (
          <div key={i} className="rounded-lg border border-border/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Competitor {i + 1}</span>
              <Button type="button" variant="ghost" size="icon-xs" onClick={() => removeCompetitor(i)}>
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Name</Label>
                <Input value={comp.name} onChange={(e) => updateCompetitor(i, "name", e.target.value)} placeholder="Competitor name" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Our Differentiator</Label>
                <Input value={comp.our_differentiator} onChange={(e) => updateCompetitor(i, "our_differentiator", e.target.value)} placeholder="Why we win" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
