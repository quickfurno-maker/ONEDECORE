"use client";

import type { AttributionTouchpoint } from "../contracts/attribution.ts";

interface AttributionPreviewProps {
  readonly touchpoint: AttributionTouchpoint;
}

export function AttributionPreview({ touchpoint }: AttributionPreviewProps) {
  return (
    <section
      className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
      data-testid="attribution-preview"
    >
      <h2 className="text-sm font-medium text-neutral-100">Attribution touchpoint</h2>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-500">Publication</dt>
          <dd className="text-neutral-200">{touchpoint.publicationReference}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Lead</dt>
          <dd className="text-neutral-200">{touchpoint.leadReference ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Variant</dt>
          <dd className="text-neutral-200">{touchpoint.variantKey ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">UTM source</dt>
          <dd className="text-neutral-200">{touchpoint.utmSource ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">UTM medium</dt>
          <dd className="text-neutral-200">{touchpoint.utmMedium ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">UTM campaign</dt>
          <dd className="text-neutral-200">{touchpoint.utmCampaign ?? "—"}</dd>
        </div>
      </dl>
    </section>
  );
}
