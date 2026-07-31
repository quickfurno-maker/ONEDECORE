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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Overview
      </h2>
      <dl className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <dt className="text-xs text-neutral-500">Submitted name</dt>
          <dd className="mt-1 text-sm text-neutral-100">{overview.submittedName}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Email</dt>
          <dd className="mt-1 text-sm text-neutral-100">{overview.submittedEmail ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Status</dt>
          <dd className="mt-1">
            <LeadStatusBadge status={overview.status as LeadStageCode} />
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Service</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatCrmCodeLabel(overview.serviceCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Property</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatCrmCodeLabel(overview.propertyCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Timeline</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatCrmCodeLabel(overview.timelineCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Rooms</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatCrmCodeList(overview.roomCodes)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Budget comfort</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatCrmCodeLabel(overview.budgetComfortCode)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Locality</dt>
          <dd className="mt-1 text-sm text-neutral-100">{overview.locality ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Entry method</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatCrmCodeLabel(overview.entryMethod)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Created</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatTimestamp(overview.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-neutral-500">Updated</dt>
          <dd className="mt-1 text-sm text-neutral-100">
            {formatTimestamp(overview.updatedAt)}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs text-neutral-500">Client message</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-neutral-100">
            {overview.message ?? "—"}
          </dd>
        </div>
      </dl>
    </section>
  );
}
