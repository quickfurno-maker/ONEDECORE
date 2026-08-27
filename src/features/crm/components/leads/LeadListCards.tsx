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
    <div className="space-y-2.5 md:hidden">
      {items.map((item) => (
        <Link
          key={item.id}
          href={`/admin/crm/leads/${item.id}`}
          className="crm-surface crm-row group flex items-stretch gap-3 rounded-[14px] p-3.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--crm-primary-soft)] text-[13px] font-semibold text-[var(--crm-primary)]">
            {initials(item.submittedName)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="truncate text-[15px] font-semibold leading-snug text-[var(--crm-text)]">
                {item.submittedName}
              </p>
              <LeadStatusBadge status={item.status} />
            </div>
            <p className="mt-1 truncate text-[13px] text-[var(--crm-text-secondary)]">
              {formatCrmCodeLabel(item.serviceCode)}
              {item.locality ? ` · ${item.locality}` : ""}
            </p>
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--crm-border)] pt-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] text-[var(--crm-text-secondary)]">
                  {item.nextFollowUpDue
                    ? `Follow-up ${formatTimestamp(item.nextFollowUpDue)}`
                    : "No follow-up set"}
                </p>
                <p className="mt-0.5 truncate text-[11px] text-[var(--crm-muted)]">
                  {item.assigneeLabel} · {formatTimestamp(item.updatedAt)}
                </p>
              </div>
              <span
                aria-hidden
                className="shrink-0 text-base text-[var(--crm-muted)] transition group-hover:text-[var(--crm-primary)]"
              >
                ›
              </span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}
