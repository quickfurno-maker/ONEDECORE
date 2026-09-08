"use client";

/**
 * Every consultation CTA on the site, as one control.
 *
 * WHY A BUTTON AND NOT A LINK
 *
 * These used to be anchors to `/#consultation`, and the page they landed on had
 * its own lead form. Two forms meant two contracts, two sets of validation and
 * two ways for an enquiry to be lost. There is one form now — the guided sheet
 * — so a CTA's job is to OPEN it, which is an action, not a navigation. A link
 * that goes nowhere is a lie to a screen reader and to a middle-click.
 *
 * WHY IT MAY PRESELECT A SERVICE
 *
 * A tile that says "Plan My Kitchen" has already asked step one. Carrying that
 * answer into the sheet and starting at the next question respects it. The
 * answer still lands in the same plan state the sheet would have written, so
 * nothing is bypassed — the visitor can go back and change it.
 *
 * WARDROBES SKIP THE HOME STEP because that step asks nothing for them: there
 * is no scope list and no approved budget ladder for a wardrobe job. Opening on
 * a step with a single explanatory sentence and no control would read as a bug.
 */

import type { ReactNode } from "react";
import { v4RequiresScope } from "@/features/lead-intake/contracts";
import type { PmServiceId } from "@/features/public-site/home-r4/content";
import { usePlan } from "@/features/public-site/home-r4/PlanContext";

export interface DiscoveryConsultCtaProps {
  readonly children: ReactNode;
  readonly className: string;
  /** Preselects step one and opens at the first question still unanswered. */
  readonly service?: PmServiceId;
  /** Stable hook for a later measurement layer. Nothing reads it yet. */
  readonly conversionAction: string;
  readonly ariaLabel?: string;
}

export function DiscoveryConsultCta({
  children,
  className,
  service,
  conversionAction,
  ariaLabel,
}: DiscoveryConsultCtaProps) {
  const { openPlanner, setService } = usePlan();

  return (
    <button
      type="button"
      className={className}
      aria-label={ariaLabel}
      data-conversion-action={conversionAction}
      data-od-consult-cta={service ?? ""}
      onClick={() => {
        if (!service) {
          openPlanner();
          return;
        }
        setService(service);
        openPlanner(v4RequiresScope(service) ? 2 : 3);
      }}
    >
      {children}
    </button>
  );
}
