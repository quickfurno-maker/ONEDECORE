import Link from "next/link";
import type { CrmLeadListItem } from "../../contracts/lead-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import {
  CRM_SITE_VISIT_STATE_LABELS,
  formatLeadQuotationState,
} from "../../contracts/lead-milestones.ts";
import { LeadSalesBucketBadge } from "./LeadSalesBucketBadge.tsx";
import { LeadStatusBadge } from "./LeadStatusBadge.tsx";

interface LeadListTableProps {
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

export function LeadListTable({ items }: LeadListTableProps) {
  return (
    <div className="crm-surface hidden overflow-hidden md:block">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <caption className="sr-only">CRM leads</caption>
          <thead className="sticky top-0 border-b border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-left text-[12px] font-medium text-[var(--crm-muted)]">
            <tr>
              <th scope="col" className="px-4 py-3 font-medium">
                Lead
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Requirement
              </th>
              {/* Bucket first: it is the primary organiser. Stage stays in its
                  own column right beside it and is never replaced by it. */}
              <th scope="col" className="px-4 py-3 font-medium">
                Bucket
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Stage
              </th>
              {/* Site visit and quotation are milestone facts of their OWN.
                  They may feed the canonical score, but they are never the
                  bucket: a HOT and a LOST lead can carry the same two. */}
              <th scope="col" className="px-4 py-3 font-medium">
                Site visit
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Quotation
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Source
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Owner
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Locality
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Next action
              </th>
              {/* RECEIVED, not "Created": the whole workspace is organised by
                  the month a lead was received. */}
              <th scope="col" className="px-4 py-3 font-medium">
                Received
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="crm-row h-14 border-t border-[var(--crm-border)]"
              >
                <td className="px-4">
                  <Link
                    href={`/admin/crm/leads/${item.id}`}
                    className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--crm-primary-soft)] text-xs font-semibold text-[var(--crm-primary)]">
                      {initials(item.submittedName)}
                    </span>
                    <span>
                      <span className="block font-semibold text-[var(--crm-text)]">
                        {item.submittedName}
                      </span>
                      <span className="block text-xs text-[var(--crm-muted)]">
                        {formatCrmCodeLabel(item.entryMethod)}
                      </span>
                    </span>
                  </Link>
                </td>
                <td className="px-4 text-[var(--crm-text-secondary)]">
                  {formatCrmCodeLabel(item.serviceCode)}
                </td>
                <td className="px-4">
                  <LeadSalesBucketBadge
                    bucket={item.salesBucket}
                    priorityScore={item.priorityScore}
                  />
                </td>
                <td className="px-4">
                  <LeadStatusBadge status={item.status} />
                </td>
                <td className="px-4">
                  <span
                    className="inline-flex items-center rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--crm-text-secondary)]"
                    data-testid="crm-lead-site-visit"
                    data-site-visit={item.siteVisitState}
                  >
                    {CRM_SITE_VISIT_STATE_LABELS[item.siteVisitState]}
                  </span>
                </td>
                <td className="px-4">
                  <span
                    className="inline-flex items-center rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-1.5 py-0.5 text-[11px] font-medium text-[var(--crm-text-secondary)]"
                    data-testid="crm-lead-quotation"
                    data-quotation={item.quotationState}
                  >
                    {formatLeadQuotationState(item.quotationState)}
                  </span>
                </td>
                <td className="px-4 text-[var(--crm-text-secondary)]">
                  {item.primarySourceLabel}
                </td>
                <td className="px-4 text-[var(--crm-text-secondary)]">
                  {item.assigneeLabel}
                </td>
                <td className="px-4 text-[var(--crm-text-secondary)]">
                  {item.locality ?? "—"}
                </td>
                <td className="px-4 text-[var(--crm-text-secondary)]">
                  {item.primaryNextActionDueAt
                    ? formatTimestamp(item.primaryNextActionDueAt)
                    : "—"}
                </td>
                <td className="px-4 text-[var(--crm-muted)]" data-testid="crm-lead-received">
                  {formatTimestamp(item.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
