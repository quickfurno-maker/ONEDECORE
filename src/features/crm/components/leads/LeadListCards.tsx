import Link from "next/link";
import type { CrmLeadListItem } from "../../contracts/lead-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import { LeadStatusBadge } from "./LeadStatusBadge.tsx";

interface LeadListCardsProps {
  readonly items: readonly CrmLeadListItem[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadListCards({ items }: LeadListCardsProps) {
  return (
    <div className="space-y-3 md:hidden">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-neutral-50">
                <Link
                  href={`/admin/crm/leads/${item.id}`}
                  className="text-amber-300 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  {item.submittedName}
                </Link>
              </h3>
              <p className="mt-1 text-xs text-neutral-500">
                {formatCrmCodeLabel(item.serviceCode)} · {item.locality ?? "No locality"}
              </p>
            </div>
            <LeadStatusBadge status={item.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-neutral-400">
            <div>
              <dt className="font-medium text-neutral-500">Source</dt>
              <dd className="mt-1 text-neutral-200">{item.primarySourceLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Assignee</dt>
              <dd className="mt-1 text-neutral-200">{item.assigneeLabel}</dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Follow-up</dt>
              <dd className="mt-1 text-neutral-200">
                {item.nextFollowUpDue ? formatTimestamp(item.nextFollowUpDue) : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium text-neutral-500">Updated</dt>
              <dd className="mt-1 text-neutral-200">{formatTimestamp(item.updatedAt)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
