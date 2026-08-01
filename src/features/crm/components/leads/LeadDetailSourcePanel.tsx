import type { CrmLeadDetailSourcePanel } from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

interface LeadDetailSourcePanelProps {
  readonly source: CrmLeadDetailSourcePanel;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailSourcePanel({ source }: LeadDetailSourcePanelProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Source and attribution
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Primary source</dt>
          <dd className="mt-1 text-sm text-neutral-100">{source.primarySourceLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Landing path</dt>
          <dd className="mt-1 text-sm text-neutral-100">{source.landingPath ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Planner version</dt>
          <dd className="mt-1 text-sm text-neutral-100">{source.plannerVersion ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Attribution summary</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {source.attributionSummary ?? "—"}
          </dd>
        </div>
      </dl>

      {source.touchpoints.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Touchpoints
          </h3>
          <ul className="mt-3 space-y-3">
            {source.touchpoints.map((touchpoint) => (
              <li
                key={touchpoint.id}
                className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-neutral-200">
                    {touchpoint.sourceLabel}
                  </span>
                  <span className="text-xs text-neutral-500">
                    {formatTimestamp(touchpoint.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-neutral-400">
                  {formatCrmCodeLabel(touchpoint.touchpointKind)}
                  {touchpoint.sourceDetail ? ` · ${touchpoint.sourceDetail}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
