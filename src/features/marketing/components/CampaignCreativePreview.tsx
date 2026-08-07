"use client";

import type { CampaignCreativeSnapshot } from "../contracts/creative-snapshot.ts";
import { PrebuildBanner } from "./PrebuildBanner.tsx";

interface CampaignCreativePreviewProps {
  readonly creative: CampaignCreativeSnapshot;
}

export function CampaignCreativePreview({ creative }: CampaignCreativePreviewProps) {
  return (
    <section aria-label="Campaign creative preview" aria-live="polite" className="space-y-3">
      <PrebuildBanner />
      <h3 className="text-sm font-semibold text-neutral-100">Creative snapshot</h3>
      <article className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-4">
        <p className="text-xs uppercase tracking-wide text-neutral-500">Headline</p>
        <p className="mt-1 text-base font-semibold text-neutral-100">{creative.headline}</p>
        <p className="mt-3 text-sm text-neutral-300">{creative.primaryText}</p>
        <p className="mt-4 inline-block rounded bg-emerald-700 px-3 py-1 text-sm font-medium text-white">
          {creative.callToAction}
        </p>
      </article>
      <p className="text-xs text-neutral-500">
        Destination: {creative.landingPublicationRef} — Audience hash:{" "}
        <span className="font-mono">{creative.audienceRuleHash.slice(0, 12)}…</span>
      </p>
    </section>
  );
}
