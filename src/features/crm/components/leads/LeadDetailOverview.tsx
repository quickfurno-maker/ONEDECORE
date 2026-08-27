import type { CrmLeadDetailOverview } from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel, formatCrmCodeList } from "../../contracts/crm-labels.ts";
import { LeadStatusBadge } from "./LeadStatusBadge.tsx";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";

interface LeadDetailOverviewProps {
  readonly overview: CrmLeadDetailOverview;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailOverview({ overview }: LeadDetailOverviewProps) {
  return (
    <section className="crm-surface p-3.5 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
        Overview
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Submitted name</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">{overview.submittedName}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Email</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">{overview.submittedEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Status</dt>
          <dd className="mt-1">
            <LeadStatusBadge status={overview.status as LeadStageCode} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Service</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatCrmCodeLabel(overview.serviceCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Property</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatCrmCodeLabel(overview.propertyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Timeline</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatCrmCodeLabel(overview.timelineCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Rooms</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatCrmCodeList(overview.roomCodes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Budget comfort</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatCrmCodeLabel(overview.budgetComfortCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Locality</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">{overview.locality ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Entry method</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatCrmCodeLabel(overview.entryMethod)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Created</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatTimestamp(overview.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--crm-muted)]">Updated</dt>
          <dd className="mt-1 text-sm text-[var(--crm-text)]">
            {formatTimestamp(overview.updatedAt)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-[var(--crm-muted)]">Client message</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-[var(--crm-text)]">
            {overview.message ?? "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
