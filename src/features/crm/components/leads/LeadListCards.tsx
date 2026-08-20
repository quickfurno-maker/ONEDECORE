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

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function LeadListCards({ items }: LeadListCardsProps) {
  return (
    <div className="space-y-3 md:hidden">
      {items.map((item) => (
        <article
          key={item.id}
          className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <Link
              href={`/admin/crm/leads/${item.id}`}
              className="flex min-w-0 items-start gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--od-elevated)] text-xs font-semibold">
                {initials(item.submittedName)}
              </span>
              <span>
                <span className="block text-base font-semibold text-[var(--od-text)]">
                  {item.submittedName}
                </span>
                <span className="mt-1 block text-xs text-[var(--od-muted)]">
                  {formatCrmCodeLabel(item.serviceCode)} · {item.locality ?? "No locality"}
                </span>
              </span>
            </Link>
            <LeadStatusBadge status={item.status} />
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-[var(--od-muted)]">
            <div>
              <dt className="font-medium">Source</dt>
              <dd className="mt-1 text-[var(--od-text-2)]">{item.primarySourceLabel}</dd>
            </div>
            <div>
              <dt className="font-medium">Assignee</dt>
              <dd className="mt-1 text-[var(--od-text-2)]">{item.assigneeLabel}</dd>
            </div>
            <div>
              <dt className="font-medium">Follow-up</dt>
              <dd className="mt-1 text-[var(--od-text-2)]">
                {item.nextFollowUpDue ? formatTimestamp(item.nextFollowUpDue) : "—"}
              </dd>
            </div>
            <div>
              <dt className="font-medium">Updated</dt>
              <dd className="mt-1 text-[var(--od-text-2)]">{formatTimestamp(item.updatedAt)}</dd>
            </div>
          </dl>
        </article>
      ))}
    </div>
  );
}
