"use client";

import { useBusinesses } from "../hooks/use-businesses";
import { BusinessCard } from "./business-card";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { useState } from "react";
import { OnboardingWizard } from "./onboarding-wizard/wizard-shell";

export function BusinessList() {
  const { data, isLoading } = useBusinesses();
  const [wizardOpen, setWizardOpen] = useState(false);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="border-border/50 bg-card/50">
            <CardContent className="p-5">
              <div className="h-24 animate-pulse rounded bg-muted" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.businesses.map((biz) => (
          <BusinessCard key={biz.id} business={biz} />
        ))}

        <Card
          className="group cursor-pointer border-2 border-dashed border-border/50 bg-transparent transition-all hover:border-indigo-500/30"
          onClick={() => setWizardOpen(true)}
        >
          <CardContent className="flex flex-col items-center justify-center gap-3 p-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-indigo-500/10 text-indigo-400 transition-transform group-hover:scale-110">
              <Plus className="h-6 w-6" />
            </div>
            <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground">
              Add new business
            </span>
          </CardContent>
        </Card>
      </div>

      <OnboardingWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </>
  );
}
