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

export function LeadListTable({ items }: LeadListTableProps) {
  return (
    <div className="hidden overflow-x-auto rounded-lg border border-neutral-800 md:block">
      <table className="min-w-full divide-y divide-neutral-800 text-sm">
        <caption className="sr-only">CRM leads</caption>
        <thead className="bg-neutral-900/80 text-left text-xs uppercase tracking-wide text-neutral-400">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">
              Lead
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Status
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Service
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Locality
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Source
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Assignee
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Next follow-up
            </th>
            <th scope="col" className="px-4 py-3 font-semibold">
              Updated
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-800 bg-neutral-950/40">
          {items.map((item) => (
            <tr key={item.id} className="hover:bg-neutral-900/50">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/crm/leads/${item.id}`}
                  className="font-medium text-amber-300 underline-offset-2 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  {item.submittedName}
                </Link>
                <p className="mt-1 text-xs text-neutral-500">
                  {formatCrmCodeLabel(item.entryMethod)}
                </p>
              </td>
              <td className="px-4 py-3">
                <LeadStatusBadge status={item.status} />
              </td>
              <td className="px-4 py-3 text-neutral-300">
                {formatCrmCodeLabel(item.serviceCode)}
              </td>
              <td className="px-4 py-3 text-neutral-300">{item.locality ?? "—"}</td>
              <td className="px-4 py-3 text-neutral-300">{item.primarySourceLabel}</td>
              <td className="px-4 py-3 text-neutral-300">{item.assigneeLabel}</td>
              <td className="px-4 py-3 text-neutral-300">
                {item.nextFollowUpDue ? formatTimestamp(item.nextFollowUpDue) : "—"}
              </td>
              <td className="px-4 py-3 text-neutral-400">
                {formatTimestamp(item.updatedAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
