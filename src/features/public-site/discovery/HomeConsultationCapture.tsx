"use client";

import { PremiumRequirementForm } from "@/features/lead-intake/public/PremiumRequirementForm";
import type { LeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
import "@/features/public-site/home-r4/styles/home-r4.css";

/**
 * Compact homepage requirement wrapper.
 *
 * The form owns its own small state (scope + budget + contact), so no planner
 * provider is mounted here. That planner state exists to drive the multi-step
 * interiors planner and its estimator; carrying it for a form that asks five
 * questions only invites property and timeline back in.
 *
 * `ConsultationLeadForm` is still the component the interiors planner surfaces
 * use, and still speaks `public-consult-v2`. This surface — the homepage — now
 * shows the owner-approved requirement form, which speaks v3. Both are real
 * contracts; the difference is which questions the page in front of the visitor
 * actually asked.
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
      <PremiumRequirementForm mode={mode} />
    </div>
  );
}
