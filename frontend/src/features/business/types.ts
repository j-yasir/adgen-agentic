export type BusinessResponse = {
  id: string;
  user_id: string;
  name: string;
  website: string | null;
  industry: string | null;
  onboarding_path: string;
  onboarding_status: string;
  bko: Record<string, unknown> | null;
  bko_version: number;
  created_at: string;
  updated_at: string;
};

export type BusinessListResponse = {
  businesses: BusinessResponse[];
  total: number;
};

export type CompanyFormSection = {
  name: string;
  website?: string;
  industry: string;
  sub_industry?: string;
  business_type: "B2B" | "B2C" | "B2B2C" | "D2C" | "marketplace";
  company_size: "startup" | "smb" | "mid-market" | "enterprise";
  employee_range?: string;
  founded_year?: number;
  headquarters?: string;
  tagline?: string;
  description: string;
  mission?: string;
  brand_story?: string;
};

export type ProductFormSection = {
  name: string;
  product_type: "saas_product" | "physical" | "service" | "subscription" | "digital" | "marketplace";
  description: string;
  key_features: string[];
  key_benefits: string[];
  unique_selling_points: string[];
  pricing_model: "one_time" | "subscription" | "freemium" | "pay_per_use" | "enterprise" | "free";
  pricing_tier: "free" | "low" | "mid" | "premium" | "enterprise";
  pricing_details?: string;
  target_use_case?: string;
  primary_cta: string;
  conversion_url?: string;
  free_trial_available: boolean;
  demo_available: boolean;
};

export type AudienceFormSection = {
  age_range?: string;
  occupation: string[];
  company_size_target?: string;
  industry_vertical?: string;
  seniority?: string;
  geography: string;
  language: string;
  values: string[];
  interests: string[];
  personality_traits: string[];
  lifestyle?: string;
  online_platforms: string[];
  content_consumption: string[];
  purchase_behavior?: string;
  device_usage?: string;
  buying_trigger?: string;
  pain_points: string[];
  desired_outcomes: string[];
  objections: string[];
  emotional_state?: string;
  audience_awareness_level: "unaware" | "problem_aware" | "solution_aware" | "product_aware" | "most_aware";
  persona_name?: string;
};

export type BrandFormSection = {
  personality_traits: string[];
  primary_tone: "professional" | "casual" | "playful" | "authoritative" | "empathetic" | "bold" | "inspirational" | "professional_casual";
  writing_style: "conversational" | "formal" | "technical" | "punchy";
  pov: "first_person" | "second_person" | "third_person";
  language_complexity: "simple" | "moderate" | "technical";
  humor_level: "none" | "light" | "moderate" | "heavy";
  voice_examples: string[];
  dos: string[];
  donts: string[];
  primary_colors: string[];
  secondary_colors: string[];
  font_style?: "modern_sans" | "serif" | "bold" | "minimal" | "script" | "monospace";
  imagery_style?: string;
  design_aesthetic?: "clean_minimal" | "bold_vibrant" | "luxury" | "playful" | "corporate" | "dark_tech" | "warm_earthy";
  visual_do?: string;
  visual_dont?: string;
};

export type CompetitorFormEntry = {
  name: string;
  strengths: string[];
  weaknesses: string[];
  pricing_vs_us?: "cheaper" | "similar" | "pricier";
  our_differentiator: string;
};

export type CompetitiveFormSection = {
  market_position: "leader" | "challenger" | "niche" | "emerging";
  positioning_statement: string;
  primary_differentiators: string[];
  competitors: CompetitorFormEntry[];
  competitive_advantages_summary?: string;
};

export type SocialProofFormSection = {
  key_stats: string[];
  testimonials: { quote: string; author: string; title?: string; company?: string; use_in_ads: boolean }[];
  guarantees: string[];
  awards: string[];
  notable_clients: string[];
};

export type MarketingFormSection = {
  active_platforms: string[];
  target_platforms_for_campaigns: string[];
  preferred_cta_styles: string[];
  ad_style_preference?: "lifestyle" | "product_demo" | "testimonial" | "minimalist" | "bold_graphic" | "ugc_style" | "animated" | "comparison";
  primary_conversion_goal: "purchase" | "free_trial" | "demo_booking" | "lead_form" | "app_install" | "newsletter" | "call";
  budget_tier: "small" | "medium" | "large";
  average_sales_cycle?: string;
  best_performing_content_types: string[];
  emotional_hooks: string[];
  value_propositions: string[];
};

export type ComplianceFormSection = {
  industry_regulations: string[];
  restricted_claims: string[];
  required_disclaimers: string[];
  forbidden_topics: string[];
  certifications_to_mention: string[];
};

export type CreateBusinessRequest = {
  onboarding_path: "form";
  company: CompanyFormSection;
  product: ProductFormSection;
  audience: AudienceFormSection;
  brand: BrandFormSection;
  competitive: CompetitiveFormSection;
  social_proof: SocialProofFormSection;
  marketing: MarketingFormSection;
  compliance: ComplianceFormSection;
};
