import Link from "next/link";
import type { CrmLeadListItem } from "../../contracts/lead-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
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
    <div className="hidden overflow-x-auto rounded-[12px] border border-[var(--od-border)] md:block">
      <table className="min-w-full text-sm">
        <caption className="sr-only">CRM leads</caption>
        <thead className="sticky top-0 bg-[var(--od-elevated)] text-left text-xs uppercase tracking-wide text-[var(--od-muted)]">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Lead
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Requirement
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Source
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Assignee
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Locality
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Follow-up
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Created
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.id}
              className="h-14 border-t border-[var(--od-border)] transition hover:bg-[var(--od-hover)]"
            >
              <td className="px-4">
                <Link
                  href={`/admin/crm/leads/${item.id}`}
                  className="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--od-elevated)] text-xs font-semibold">
                    {initials(item.submittedName)}
                  </span>
                  <span>
                    <span className="block font-medium text-[var(--od-text)]">
                      {item.submittedName}
                    </span>
                    <span className="block text-xs text-[var(--od-muted)]">
                      {formatCrmCodeLabel(item.entryMethod)}
                    </span>
                  </span>
                </Link>
              </td>
              <td className="px-4 text-[var(--od-text-2)]">
                {formatCrmCodeLabel(item.serviceCode)}
              </td>
              <td className="px-4">
                <LeadStatusBadge status={item.status} />
              </td>
              <td className="px-4 text-[var(--od-text-2)]">{item.primarySourceLabel}</td>
              <td className="px-4 text-[var(--od-text-2)]">{item.assigneeLabel}</td>
              <td className="px-4 text-[var(--od-text-2)]">{item.locality ?? "—"}</td>
              <td className="px-4 text-[var(--od-text-2)]">
                {item.nextFollowUpDue ? formatTimestamp(item.nextFollowUpDue) : "—"}
              </td>
              <td className="px-4 text-[var(--od-muted)]">
                {formatTimestamp(item.createdAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
