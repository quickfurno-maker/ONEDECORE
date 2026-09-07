"use client";

import { PremiumRequirementForm } from "@/features/lead-intake/public/PremiumRequirementForm";
import type { LeadFormMode } from "@/features/lead-intake/public/lead-form-mode";
import "@/features/public-site/home-r4/styles/home-r4.css";

/**
 * The homepage consultation slot.
 *
 * This is the seam between the page and the form: `DiscoveryHomePage` decides
 * WHERE the section sits, this decides WHAT it renders, and the form owns its
 * own state. No planner provider is mounted — that state exists to drive the
 * multi-step interiors planner and its estimator, and carrying it for a form
 * that asks five questions is what once invited property and timeline back in.
 *
 * The mode gate is deliberately here rather than inside the form: in
 * `copy-only` the section renders nothing at all, so a misconfigured deploy
 * shows no form rather than a form that cannot submit.
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
