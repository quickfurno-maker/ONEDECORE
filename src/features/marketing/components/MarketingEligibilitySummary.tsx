"use client";

import type { AudienceEligibilityDecision } from "../contracts/eligibility.ts";
import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface MarketingEligibilitySummaryProps {
  readonly decisions: readonly AudienceEligibilityDecision[];
}

export function MarketingEligibilitySummary({
  decisions,
}: MarketingEligibilitySummaryProps) {
  const eligibleCount = decisions.filter((d) => d.eligible).length;
  const deniedCount = decisions.length - eligibleCount;

  return (
    <section aria-label="Marketing eligibility summary" className="space-y-3">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Eligibility summary</h3>
      <p aria-live="polite" className="text-sm text-neutral-300">
        Eligible: {eligibleCount} — Denied: {deniedCount} (aggregate only; no PII)
      </p>
      <ul className="space-y-1 text-xs text-neutral-400">
        {decisions.slice(0, 5).map((decision, index) => (
          <li key={index}>
            {decision.code}: {decision.reason}
          </li>
        ))}
      </ul>
    </section>
  );
}
