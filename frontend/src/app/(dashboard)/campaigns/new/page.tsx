"use client";

import { Suspense } from "react";
import { CampaignForm } from "@/features/campaign";

export default function NewCampaignPage() {
  return (
    <>
      {/* Syne — display weight for the headline only */}
      {/* eslint-disable-next-line @next/next/no-page-custom-font */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&display=swap"
      />

      {/* Full-viewport dark canvas — overrides the dashboard bg-slate-50 */}
      <div
        className="relative min-h-full overflow-x-hidden"
        style={{ background: "linear-gradient(145deg,#080b18 0%,#10082e 35%,#1a0a40 60%,#080b18 100%)" }}
      >
        <Suspense>
          <CampaignForm />
        </Suspense>
      </div>
    </>
  );
}
