"use client";

import type { AudienceEligibilityDecision } from "../contracts/eligibility.ts";
import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface MarketingEligibilitySummaryProps {
  readonly eligibleCount: number;
  readonly deniedCount: number;
  readonly decisions?: readonly AudienceEligibilityDecision[];
}

export function MarketingEligibilitySummary({
  eligibleCount,
  deniedCount,
  decisions = [],
}: MarketingEligibilitySummaryProps) {
  return (
    <section aria-label="Marketing eligibility summary" className="space-y-3">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Eligibility summary</h3>
      <p aria-live="polite" className="text-sm text-neutral-300">
        Current preview — eligibility will be rechecked before future execution. Eligible:{" "}
        {eligibleCount} — Denied: {deniedCount} (aggregate only; no PII)
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
