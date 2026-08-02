"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
import { ChevronLeft, ChevronRight, Loader2, Send, Link2, ClipboardList, ArrowRight } from "lucide-react";
import { cn } from "@/shared/lib/utils";

const STEPS = [
  { label: "Company", short: "Co", component: StepCompany },
  { label: "Product", short: "Pr", component: StepProduct },
  { label: "Audience", short: "Au", component: StepAudience },
  { label: "Brand", short: "Br", component: StepBrand },
  { label: "Competitive", short: "Cm", component: StepCompetitive },
  { label: "Social Proof", short: "SP", component: StepSocialProof },
  { label: "Marketing", short: "Mk", component: StepMarketing },
  { label: "Review", short: "✓", component: StepReview },
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
type OnboardingMode = "choose" | "url" | "form";

/* ── URL import path ────────────────────────────────────────────────── */
function UrlImportPath({
  onStartManual,
  onClose,
}: {
  onStartManual: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState("");
  const [state, setState] = useState<"idle" | "analyzing" | "done">("idle");
  const [businessName, setBusinessName] = useState("");
  const createBusiness = useCreateBusiness();
  const router = useRouter();

  const steps = ["Reading site content", "Extracting company profile", "Analysing audience signals", "Building BKO"];
  const [stepIdx, setStepIdx] = useState(0);

  async function handleAnalyze() {
    if (!url.trim()) return;
    setState("analyzing");
    // Simulate extraction steps
    for (let i = 0; i < steps.length; i++) {
      setStepIdx(i);
      await new Promise((r) => setTimeout(r, 800));
    }
    setState("done");
  }

  async function handleConfirm() {
    if (!businessName.trim()) return;
    try {
      const result = await createBusiness.mutateAsync({
        ...EMPTY_FORM,
        onboarding_path: "url",
        company: { ...EMPTY_FORM.company, name: businessName, website: url },
      });
      toast.success("Business created! Fill in more details to improve your BKO.");
      onClose();
      router.push(`/businesses/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create business");
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">URL Import</p>
        <h3 className="text-lg font-bold text-slate-900">Paste your website URL</h3>
        <p className="text-sm text-slate-500 mt-1">
          AI will extract your business profile and build an initial BKO.
        </p>
      </div>

      {state === "idle" && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <div className="flex-1 flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2.5 focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-400 transition-all">
              <Link2 className="h-4 w-4 text-slate-400 shrink-0" />
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://yourwebsite.com"
                className="flex-1 text-sm text-slate-800 placeholder:text-slate-400 outline-none bg-transparent"
                onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              />
            </div>
            <button
              onClick={handleAnalyze}
              disabled={!url.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
              style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
            >
              Analyze
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
          <p className="text-xs text-slate-400 text-center">— or —</p>
          <button
            onClick={() => onStartManual(url)}
            className="w-full text-sm text-slate-500 hover:text-indigo-600 transition-colors font-medium py-1"
          >
            Fill in details manually →
          </button>
        </div>
      )}

      {state === "analyzing" && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 text-indigo-500 animate-spin" />
            <span className="text-sm font-semibold text-indigo-700">Extracting business intelligence…</span>
          </div>
          <div className="space-y-1.5">
            {steps.map((s, i) => (
              <div key={s} className={cn("flex items-center gap-2 text-sm transition-all", i <= stepIdx ? "text-indigo-600" : "text-indigo-300")}>
                <span className="text-xs">{i < stepIdx ? "✓" : i === stepIdx ? "⋯" : "○"}</span>
                {s}
              </div>
            ))}
          </div>
        </div>
      )}

      {state === "done" && (
        <div className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-4">
            <p className="text-sm font-semibold text-emerald-700 mb-3">✓ Profile extracted — confirm before saving</p>
            <div>
              <label className="text-xs font-semibold text-slate-600 block mb-1">Business name</label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Enter your business name"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-all"
              />
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={!businessName.trim() || createBusiness.isPending}
              className="flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-40 transition-opacity"
              style={{ background: "linear-gradient(135deg,#22c55e,#16a34a)" }}
            >
              {createBusiness.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Business →
            </button>
            <button
              onClick={() => onStartManual(url)}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Edit details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Path chooser ──────────────────────────────────────────────────── */
function PathChooser({
  onChooseUrl,
  onChooseForm,
}: {
  onChooseUrl: () => void;
  onChooseForm: () => void;
}) {
  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-500 mb-1">New Business</p>
        <h3 className="text-lg font-bold text-slate-900">How would you like to start?</h3>
        <p className="text-sm text-slate-500 mt-1">
          Both paths create the same Business Knowledge Object.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={onChooseUrl}
          className="group flex flex-col gap-3 p-5 rounded-2xl border-2 border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/40 transition-all text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 group-hover:bg-indigo-100 transition-colors">
            <Link2 className="h-5 w-5 text-indigo-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Import from URL</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              Paste your website — AI extracts your business profile automatically
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-500">
            Fastest <ArrowRight className="h-3 w-3" />
          </span>
        </button>
        <button
          onClick={onChooseForm}
          className="group flex flex-col gap-3 p-5 rounded-2xl border-2 border-slate-200 hover:border-violet-400 hover:bg-violet-50/40 transition-all text-left"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 group-hover:bg-violet-100 transition-colors">
            <ClipboardList className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <p className="font-semibold text-slate-800 text-sm">Fill manually</p>
            <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">
              8-step guided wizard to build a comprehensive BKO
            </p>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-violet-500">
            Most complete <ArrowRight className="h-3 w-3" />
          </span>
        </button>
      </div>
    </div>
  );
}

/* ── Main wizard shell ──────────────────────────────────────────────── */
export function OnboardingWizard({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mode, setMode] = useState<OnboardingMode>("choose");
  const [step, setStep] = useState(0);
  const [formData, setFormData] = useState<WizardFormData>({ ...EMPTY_FORM });
  const createBusiness = useCreateBusiness();
  const router = useRouter();

  const StepComponent = STEPS[step].component;
  const isLast = step === STEPS.length - 1;

  function updateSection<K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit() {
    try {
      const result = await createBusiness.mutateAsync(formData);
      toast.success("Business created successfully!");
      handleClose();
      router.push(`/businesses/${result.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create business");
    }
  }

  function handleClose() {
    onClose();
    setMode("choose");
    setStep(0);
    setFormData({ ...EMPTY_FORM });
  }

  function startManualWithUrl(url: string) {
    setFormData((prev) => ({
      ...prev,
      onboarding_path: "form",
      company: { ...prev.company, website: url },
    }));
    setMode("form");
    setStep(0);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col gap-0 p-0 border-slate-200 shadow-xl rounded-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-white px-6 py-4 border-b border-slate-100">
          <DialogTitle className="sr-only">Add New Business</DialogTitle>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {mode !== "choose" && (
                <button
                  onClick={() => mode === "form" && step === 0 ? setMode("choose") : mode === "url" ? setMode("choose") : setStep(Math.max(0, step - 1))}
                  className="flex items-center justify-center h-7 w-7 rounded-lg hover:bg-slate-100 transition-colors text-slate-400"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {mode === "choose" ? "Add Business" : mode === "url" ? "Import from URL" : `Step ${step + 1} of ${STEPS.length}: ${STEPS[step].label}`}
                </p>
                {mode === "form" && (
                  <p className="text-xs text-slate-400">Manual onboarding wizard</p>
                )}
              </div>
            </div>

            {/* Step dots for form mode */}
            {mode === "form" && (
              <div className="flex items-center gap-1">
                {STEPS.map((s, i) => (
                  <button
                    key={s.label}
                    onClick={() => i <= step && setStep(i)}
                    title={s.label}
                    className={cn(
                      "h-1.5 rounded-full transition-all",
                      i === step ? "w-5 bg-indigo-500" : i < step ? "w-1.5 bg-indigo-300" : "w-1.5 bg-slate-200"
                    )}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Progress bar for form mode */}
          {mode === "form" && (
            <div className="mt-3 h-0.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-violet-500 rounded-full transition-all duration-300"
                style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
              />
            </div>
          )}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {mode === "choose" && (
            <div className="px-6 py-5">
              <PathChooser
                onChooseUrl={() => setMode("url")}
                onChooseForm={() => { setMode("form"); setStep(0); }}
              />
            </div>
          )}
          {mode === "url" && (
            <div className="px-6 py-5">
              <UrlImportPath
                onStartManual={startManualWithUrl}
                onClose={handleClose}
              />
            </div>
          )}
          {mode === "form" && (
            <div className="px-6 py-5">
              <StepComponent data={formData} updateSection={updateSection} />
            </div>
          )}
        </div>

        {/* Footer — only in form mode */}
        {mode === "form" && (
          <div className="flex items-center justify-between border-t border-slate-100 bg-white px-6 py-4">
            <button
              onClick={() => step === 0 ? setMode("choose") : setStep(Math.max(0, step - 1))}
              className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              {step === 0 ? "Back to options" : "Back"}
            </button>

            <div className="flex items-center gap-2">
              {!isLast && step >= 4 && (
                <button
                  onClick={() => setStep(step + 1)}
                  className="text-sm text-slate-400 hover:text-slate-600 transition-colors px-3 py-2"
                >
                  Skip for now
                </button>
              )}

              {isLast ? (
                <button
                  onClick={handleSubmit}
                  disabled={createBusiness.isPending}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white disabled:opacity-50 transition-opacity"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                >
                  {createBusiness.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Create Business
                </button>
              ) : (
                <button
                  onClick={() => setStep(step + 1)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
                  style={{ background: "linear-gradient(135deg,#4f46e5,#7c3aed)" }}
                >
                  Continue
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
