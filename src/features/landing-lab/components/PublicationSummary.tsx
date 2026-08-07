"use client";

import type { LandingPublication } from "../contracts/page-model.ts";
import { LANDING_LAB_PREBUILD_BANNER } from "../fixtures/landing-fixtures.ts";

interface PublicationSummaryProps {
  readonly publication: LandingPublication;
}

export function PublicationSummary({ publication }: PublicationSummaryProps) {
  return (
    <section
      className="rounded-lg border border-neutral-800 bg-neutral-950 p-4"
      data-testid="publication-summary"
    >
      <h2 className="text-sm font-medium text-neutral-100">Publication</h2>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Reference</dt>
          <dd className="text-neutral-200">{publication.publicationReference}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Bound version</dt>
          <dd className="text-neutral-200">v{publication.pageVersionNumber}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-500">Status</dt>
          <dd className="text-neutral-200">{publication.status}</dd>
        </div>
      </dl>
      <p className="mt-4 text-xs text-amber-200">{LANDING_LAB_PREBUILD_BANNER}</p>
    </section>
  );
}
