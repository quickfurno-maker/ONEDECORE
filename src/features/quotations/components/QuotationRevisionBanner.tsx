"use client";

import type { QuotationLifecycleState } from "../contracts/lifecycle.ts";
import type { QuotationRevisionRef } from "../contracts/reference.ts";

interface QuotationRevisionBannerProps {
  readonly revision: QuotationRevisionRef;
  readonly lifecycleState: QuotationLifecycleState;
  readonly banner: string | null;
}

export function QuotationRevisionBanner({
  revision,
  lifecycleState,
  banner,
}: QuotationRevisionBannerProps) {
  return (
    <div className="rounded-lg border border-amber-700/40 bg-amber-950/20 px-4 py-3 text-sm text-amber-100">
      <p className="font-medium">
        {revision.quotationReference} · Revision {revision.revisionNumber}
      </p>
      <p className="mt-1 text-xs uppercase tracking-wide text-amber-200/80">
        {lifecycleState.replaceAll("_", " ")}
      </p>
      {banner ? <p className="mt-2 text-neutral-200">{banner}</p> : null}
    </div>
  );
}
