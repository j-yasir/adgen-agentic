"use client";

import { use } from "react";
import { CampaignLiveView } from "@/features/campaign";

export default function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <CampaignLiveView campaignId={id} />;
}
