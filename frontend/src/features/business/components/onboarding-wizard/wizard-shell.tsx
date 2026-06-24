"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/shared/lib/utils";
import { useCreateBusiness } from "../../hooks/use-businesses";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { StepCompany } from "./step-company";
import { StepProduct } from "./step-product";
import { StepAudience } from "./step-audience";
import { StepBrand } from "./step-brand";
import { StepCompetitive } from "./step-competitive";
import { StepSocialProof } from "./step-social-proof";
import { StepMarketing } from "./step-marketing";
import { StepReview } from "./step-review";
import type { CreateBusinessRequest } from "../../types";
import { ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react";

const STEPS = [
  { label: "Company", component: StepCompany },
  { label: "Product", component: StepProduct },
  { label: "Audience", component: StepAudience },
  { label: "Brand", component: StepBrand },
  { label: "Competitive", component: StepCompetitive },
  { label: "Social Proof", component: StepSocialProof },
  { label: "Marketing", component: StepMarketing },
  { label: "Review", component: StepReview },
];

const EMPTY_FORM: CreateBusinessRequest = {
  onboarding_path: "form",
  company: {
    name: "",
    industry: "",
    business_type: "B2C",
    company_size: "startup",
    description: "",
  },
  product: {
    name: "",
    product_type: "saas_product",
    description: "",
    key_features: [""],
    key_benefits: [""],
    unique_selling_points: [""],
    pricing_model: "subscription",
    pricing_tier: "mid",
    primary_cta: "Get Started",
    free_trial_available: false,
    demo_available: false,
  },
  audience: {
    geography: "",
    language: "English",
    occupation: [],
    values: [],
    interests: [],
    personality_traits: [],
    online_platforms: [],
    content_consumption: [],
    pain_points: [""],
    desired_outcomes: [""],
    objections: [],
    audience_awareness_level: "problem_aware",
  },
  brand: {
    personality_traits: [""],
    primary_tone: "professional",
    writing_style: "conversational",
    pov: "second_person",
    language_complexity: "moderate",
    humor_level: "none",
    voice_examples: [],
    dos: [],
    donts: [],
    primary_colors: [],
    secondary_colors: [],
  },
  competitive: {
    market_position: "challenger",
    positioning_statement: "",
    primary_differentiators: [""],
    competitors: [],
  },
  social_proof: {
    key_stats: [],
    testimonials: [],
    guarantees: [],
    awards: [],
    notable_clients: [],
  },
  marketing: {
    active_platforms: [],
    target_platforms_for_campaigns: [],
    preferred_cta_styles: [],
    primary_conversion_goal: "free_trial",
    budget_tier: "medium",
    best_performing_content_types: [],
    emotional_hooks: [],
    value_propositions: [],
  },
  compliance: {
    industry_regulations: [],
    restricted_claims: [],
    required_disclaimers: [],
    forbidden_topics: [],
    certifications_to_mention: [],
  },
};

export type WizardFormData = CreateBusinessRequest;

export function OnboardingWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<WizardFormData>({ ...EMPTY_FORM });
  const createBusiness = useCreateBusiness();
  const router = useRouter();

  const progress = ((step + 1) / STEPS.length) * 100;
  const StepComponent = STEPS[step].component;
  const isLast = step === STEPS.length - 1;

  function updateSection<K extends keyof WizardFormData>(
    key: K,
    value: WizardFormData[K]
  ) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    try {
      const result = await createBusiness.mutateAsync(formData);
      toast.success("Business created successfully!");
      onClose();
      setStep(0);
      setFormData({ ...EMPTY_FORM });
      router.push(`/businesses/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create business");
    }
  }

  function handleClose() {
    onClose();
    setStep(0);
    setFormData({ ...EMPTY_FORM });
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 border-border/50">
        <div className="flex items-center justify-between border-b border-border/50 px-6 py-4">
          <div>
            <DialogTitle className="text-lg font-semibold">
              Add New Business
            </DialogTitle>
            <p className="text-sm text-muted-foreground">
              Step {step + 1} of {STEPS.length}: {STEPS[step].label}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {STEPS.map((s, i) => (
              <button
                key={s.label}
                onClick={() => setStep(i)}
                className={cn(
                  "h-2 w-2 rounded-full transition-all",
                  i === step
                    ? "w-6 bg-indigo-500"
                    : i < step
                    ? "bg-indigo-500/50"
                    : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>

        <div className="px-1">
          <Progress value={progress} className="h-0.5 rounded-none" />
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <StepComponent data={formData} updateSection={updateSection} />
        </div>

        <div className="flex items-center justify-between border-t border-border/50 px-6 py-4">
          <Button
            variant="ghost"
            onClick={() => setStep(Math.max(0, step - 1))}
            disabled={step === 0}
          >
            <ChevronLeft className="mr-1 h-4 w-4" />
            Back
          </Button>

          <div className="flex gap-2">
            {!isLast && step >= 4 && (
              <Button
                variant="ghost"
                className="text-muted-foreground"
                onClick={() => setStep(step + 1)}
              >
                Skip for now
              </Button>
            )}

            {isLast ? (
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={handleSubmit}
                disabled={createBusiness.isPending}
              >
                {createBusiness.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Create Business
              </Button>
            ) : (
              <Button
                className="bg-indigo-600 text-white hover:bg-indigo-500"
                onClick={() => setStep(step + 1)}
              >
                Continue
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
