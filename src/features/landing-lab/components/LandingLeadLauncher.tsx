"use client";

import type { LeadFormPlaceholderBlock } from "../contracts/blocks.ts";
import { usePlan } from "@/features/public-site/home-r4/PlanContext";

/**
 * A landing page's lead block — a launcher, not a form.
 *
 * WHY THIS REPLACED A REAL FORM
 *
 * Landing Lab used to own `LiveLandingLeadForm`: its own `<form>`, its own
 * fields, its own consent presentation, its own validation, and its own request
 * body stamped `home-r4-v1`. That made it a second public lead implementation
 * with a second contract, which is exactly what the site has just spent this
 * work removing everywhere else.
 *
 * It also meant a landing page asked for property type and rooms — fields the
 * canonical contract no longer collects — so the same visitor answered
 * different questions depending on which page they landed on.
 *
 * There is one form now. This block supplies the headline, the helper text and
 * the CTA the page was configured with, and opening it hands the visitor the
 * same guided v4 sheet every other public surface uses.
 *
 * THE CONFIGURED LABEL IS A LAUNCHER LABEL
 *
 * `block.submitLabel` was written by whoever built the landing page and is
 * still honoured — on the button that OPENS the form. The final submit inside
 * the sheet stays "Get Free Quote", because that wording is owner-approved and
 * a landing page must not be able to rename the moment a lead is created.
 *
 * ATTRIBUTION SURVIVES
 *
 * The signed publication and campaign contexts are held by
 * `LeadConsultationHost`, which the public landing renderer wraps this in, and
 * attached to the request by the canonical adapter. Nothing about the trusted
 * attribution depends on this block owning a form.
 */
export function LandingLeadLauncher({
  block,
}: {
  readonly block: LeadFormPlaceholderBlock;
}) {
  const { openPlanner } = usePlan();

  return (
    <section
      className="rounded border border-neutral-800 p-4"
      data-od-landing-lead-block=""
    >
      <h2 className="text-lg text-neutral-100">{block.headline}</h2>
      {block.helperText ? (
        <p className="mt-2 text-sm text-neutral-300">{block.helperText}</p>
      ) : null}

      <button
        type="button"
        className="mt-4 rounded bg-amber-300 px-4 py-2 text-sm font-medium text-neutral-900"
        onClick={() => openPlanner()}
        data-conversion-action="landing-lead-open"
      >
        {block.submitLabel}
      </button>
    </section>
  );
}
