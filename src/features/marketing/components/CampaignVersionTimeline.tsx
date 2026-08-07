"use client";

import type { CampaignLifecycleState } from "../contracts/lifecycle.ts";
import { CAMPAIGN_LIFECYCLE_STATES } from "../contracts/lifecycle.ts";
import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface CampaignVersionTimelineProps {
  readonly currentState: CampaignLifecycleState;
}

export function CampaignVersionTimeline({ currentState }: CampaignVersionTimelineProps) {
  return (
    <section aria-label="Campaign version timeline" aria-live="polite" className="space-y-3">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Version lifecycle</h3>
      <ol className="flex flex-wrap gap-2">
        {CAMPAIGN_LIFECYCLE_STATES.map((state) => (
          <li
            key={state}
            aria-current={state === currentState ? "step" : undefined}
            className={`rounded-full px-3 py-1 text-xs ${
              state === currentState
                ? "bg-emerald-700 text-white"
                : "border border-neutral-700 text-neutral-400"
            }`}
          >
            {state.replaceAll("_", " ")}
          </li>
        ))}
      </ol>
    </section>
  );
}
