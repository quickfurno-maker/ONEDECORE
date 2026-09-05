"use client";

import { ConsultationLeadForm } from "@/features/lead-intake/public/ConsultationLeadForm";
import type { LeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
import "@/features/public-site/home-r4/styles/home-r4.css";

/**
 * Compact homepage consultation wrapper.
 *
 * The adaptive form owns its own small state (service + one qualifier), so the
 * legacy `PlanProvider` is no longer mounted here. That planner state exists to
 * drive the multi-step interiors planner and its estimator; carrying it for a
 * form that asks two questions only invited property/timeline back in.
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
      <ConsultationLeadForm mode={mode} />
    </div>
  );
}
