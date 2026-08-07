"use client";

import type { HandoverDisplayModel } from "../../handover/ui/build-handover-display-model.ts";
import { PROJECT_COMMERCIAL_BOUNDARY_RULE } from "../../contracts/commercial.ts";

interface ProjectCommercialSummaryProps {
  readonly model: HandoverDisplayModel;
}

export function ProjectCommercialSummary({ model }: ProjectCommercialSummaryProps) {
  const commercial = model.commercial;

  return (
    <section
      aria-label="Project commercial summary"
      className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4"
    >
      <p className="text-xs uppercase tracking-wide text-neutral-400">
        Commercial snapshot (read-only)
      </p>
      <dl className="mt-3 space-y-2 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Quotation</dt>
          <dd className="font-medium text-neutral-50">
            {commercial.quotationReference} · Rev {commercial.revisionNumber}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-neutral-400">Taxable base</dt>
          <dd className="font-medium text-neutral-50">
            ₹{(commercial.taxableBasePaise / 100).toLocaleString("en-IN")}
          </dd>
        </div>
        <div className="flex justify-between gap-4 border-t border-neutral-700 pt-2 text-base">
          <dt className="font-semibold text-neutral-100">Grand total</dt>
          <dd className="font-semibold text-amber-300">{commercial.grandTotalLabel}</dd>
        </div>
        {commercial.scopeSummary ? (
          <div>
            <dt className="text-neutral-400">Scope summary</dt>
            <dd className="mt-1 text-neutral-200">{commercial.scopeSummary}</dd>
          </div>
        ) : null}
      </dl>
      <p className="mt-4 text-xs text-neutral-500">{PROJECT_COMMERCIAL_BOUNDARY_RULE}</p>
    </section>
  );
}
