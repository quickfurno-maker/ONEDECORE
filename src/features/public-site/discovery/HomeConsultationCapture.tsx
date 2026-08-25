"use client";

import { HomeLeadCapture } from "@/features/lead-intake/public/HomeLeadCapture";
import type { LeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
import { PlanProvider } from "@/features/public-site/home-r4/PlanContext";
import "@/features/public-site/home-r4/styles/home-r4.css";

/**
 * Compact homepage consultation wrapper.
 * Provides PlanProvider for HomeLeadCapture without reintroducing the planner sheet,
 * estimator, or multi-step interiors UX.
 */
export function HomeConsultationCapture({
  mode,
}: {
  readonly mode: LeadFormMode;
}) {
  if (mode === "copy-only") {
    return null;
  }

  return (
    <div
      data-public-home-r4=""
      data-od-home-consultation=""
      data-lead-form-mode={mode}
      className="od-disc-consult__capture"
    >
      <PlanProvider>
        <HomeLeadCapture mode={mode} />
      </PlanProvider>
    </div>
  );
}
