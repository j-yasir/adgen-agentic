"use client";

import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { WizardFormData } from "./wizard-shell";

type Props = {
  data: WizardFormData;
  updateSection: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-indigo-400">{title}</h4>
      <div className="rounded-lg border border-border/50 bg-muted/30 p-3 text-sm space-y-1">
        {children}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | undefined | null }) {
  if (!value) return null;
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function Tags({ label, values }: { label: string; values: string[] }) {
  if (!values.length) return null;
  return (
    <div>
      <span className="text-muted-foreground text-xs">{label}</span>
      <div className="flex flex-wrap gap-1 mt-1">
        {values.filter(Boolean).map((v, i) => (
          <Badge key={i} variant="outline" className="text-xs">{v}</Badge>
        ))}
      </div>
    </div>
  );
}

export function StepReview({ data }: Props) {
  const { company: c, product: p, audience: a, brand: b, competitive: comp } = data;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review your business information before submitting. You can go back to any step to make changes.
      </p>

      <Section title="Company">
        <Field label="Name" value={c.name} />
        <Field label="Industry" value={c.industry} />
        <Field label="Type" value={c.business_type} />
        <Field label="Size" value={c.company_size} />
        <Field label="Website" value={c.website} />
      </Section>

      <Separator className="opacity-30" />

      <Section title="Product">
        <Field label="Name" value={p.name} />
        <Field label="Type" value={p.product_type} />
        <Field label="CTA" value={p.primary_cta} />
        <Tags label="Features" values={p.key_features} />
        <Tags label="USPs" values={p.unique_selling_points} />
      </Section>

      <Separator className="opacity-30" />

      <Section title="Audience">
        <Field label="Geography" value={a.geography} />
        <Field label="Age Range" value={a.age_range} />
        <Field label="Awareness" value={a.audience_awareness_level} />
        <Tags label="Pain Points" values={a.pain_points} />
      </Section>

      <Separator className="opacity-30" />

      <Section title="Brand">
        <Field label="Tone" value={b.primary_tone} />
        <Field label="Style" value={b.writing_style} />
        <Field label="Aesthetic" value={b.design_aesthetic} />
        <Tags label="Personality" values={b.personality_traits} />
        <Tags label="Colors" values={b.primary_colors} />
      </Section>

      <Separator className="opacity-30" />

      <Section title="Competitive">
        <Field label="Position" value={comp.market_position} />
        <Tags label="Differentiators" values={comp.primary_differentiators} />
        {comp.competitors.length > 0 && (
          <Field label="Competitors" value={comp.competitors.map(c => c.name).filter(Boolean).join(", ")} />
        )}
      </Section>
    </div>
  );
}
