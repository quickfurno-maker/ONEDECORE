"use client";

import type { HandoverDisplayModel } from "../../handover/ui/build-handover-display-model.ts";

interface ProjectHandoverSummaryProps {
  readonly model: HandoverDisplayModel;
}

export function ProjectHandoverSummary({ model }: ProjectHandoverSummaryProps) {
  return (
    <section
      aria-label="Project handover summary"
      className="rounded-xl border border-neutral-700 bg-neutral-900/60 p-4"
    >
      <h2 className="text-base font-semibold text-neutral-50">
        {model.summary.projectLabel ?? model.summary.ref.projectReference}
      </h2>
      <p className="mt-1 text-sm text-neutral-300">{model.summary.clientDisplayName}</p>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-neutral-400">Project reference</dt>
          <dd className="font-medium text-neutral-100">
            {model.summary.ref.projectReference}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Lead reference</dt>
          <dd className="font-medium text-neutral-100">
            {model.summary.ref.leadReference}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Accepted quotation</dt>
          <dd className="font-medium text-neutral-100">
            {model.summary.ref.acceptedQuotationReference} · Rev{" "}
            {model.summary.ref.acceptedRevisionNumber}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-400">Handover state</dt>
          <dd className="font-medium text-neutral-100">{model.handoverStateLabel}</dd>
        </div>
      </dl>
    </section>
  );
}
