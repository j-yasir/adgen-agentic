"use client";

import { Suspense } from "react";
import { CampaignForm } from "@/features/campaign";

export default function NewCampaignPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Campaign</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure and launch an AI-powered ad campaign
        </p>
      </div>
      <Suspense>
        <CampaignForm />
      </Suspense>
    </div>
  );
}
