"use client";

import { BusinessList } from "@/features/business";

export default function BusinessesPage() {
  return (
    <div className="p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Your Businesses</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your businesses and their Brand Knowledge Objects
        </p>
      </div>
      <BusinessList />
    </div>
  );
}
