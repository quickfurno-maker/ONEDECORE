"use client";

import { buildSnagSummary, type SnagItem } from "../../execution/domain/snag-contract.ts";

interface SnagSummaryProps {
  readonly snags: readonly SnagItem[];
}

export function SnagSummary({ snags }: SnagSummaryProps) {
  const summary = buildSnagSummary(snags);

  return (
    <section
      aria-label="Snag summary"
      className="rounded-xl border border-neutral-700 bg-neutral-900/50 p-4"
    >
      <h2 className="text-sm font-semibold text-neutral-100">Snag summary</h2>
      <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-neutral-500">Total</dt>
          <dd className="font-medium text-neutral-100">{summary.total}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Open</dt>
          <dd className="font-medium text-neutral-100">{summary.open}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">In progress</dt>
          <dd className="font-medium text-neutral-100">{summary.inProgress}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Resolved</dt>
          <dd className="font-medium text-neutral-100">{summary.resolved}</dd>
        </div>
      </dl>
      <p
        className={[
          "mt-3 text-sm",
          summary.blockingHandover ? "text-amber-200" : "text-emerald-200",
        ].join(" ")}
        role="status"
      >
        {summary.blockingHandover
          ? "Open snags may block handover."
          : "No open snags blocking handover."}
      </p>
    </section>
  );
}
