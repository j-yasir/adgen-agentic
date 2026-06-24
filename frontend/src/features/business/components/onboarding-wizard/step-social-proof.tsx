"use client";

import { TagInput } from "./field-helpers";
import type { WizardFormData } from "./wizard-shell";

type Props = {
  data: WizardFormData;
  updateSection: <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => void;
};

export function StepSocialProof({ data, updateSection }: Props) {
  const s = data.social_proof;
  const update = (field: string, value: unknown) =>
    updateSection("social_proof", { ...s, [field]: value });

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        This section is optional but helps agents craft more persuasive ads.
      </p>

      <TagInput label="Key Stats" values={s.key_stats} onChange={(v) => update("key_stats", v)} placeholder="e.g. 10,000+ customers" />
      <TagInput label="Guarantees" values={s.guarantees} onChange={(v) => update("guarantees", v)} placeholder="e.g. 30-day money-back guarantee" />
      <TagInput label="Awards" values={s.awards} onChange={(v) => update("awards", v)} placeholder="e.g. Best SaaS 2025" />
      <TagInput label="Notable Clients" values={s.notable_clients} onChange={(v) => update("notable_clients", v)} placeholder="e.g. Google, Netflix" />
    </div>
  );
}
