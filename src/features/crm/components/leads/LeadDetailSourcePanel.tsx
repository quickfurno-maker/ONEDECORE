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
    <section className="crm-surface p-3.5 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
        Source and attribution
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Primary source</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">{source.primarySourceLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Landing path</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">{source.landingPath ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Planner version</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">{source.plannerVersion ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Attribution summary</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {source.attributionSummary ?? "—"}
          </dd>
        </div>
      </dl>

      {source.touchpoints.length > 0 ? (
        <div className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--crm-muted)]">
            Touchpoints
          </h3>
          <ul className="mt-3 space-y-3">
            {source.touchpoints.map((touchpoint) => (
              <li
                key={touchpoint.id}
                className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-[var(--crm-text)]">
                    {touchpoint.sourceLabel}
                  </span>
                  <span className="text-xs text-[var(--crm-muted)]">
                    {formatTimestamp(touchpoint.occurredAt)}
                  </span>
                </div>
                <p className="mt-1 text-[var(--crm-muted)]">
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
