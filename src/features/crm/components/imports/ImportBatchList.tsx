import Link from "next/link";
import type { LeadImportBatchSummary } from "@/features/crm/contracts/lead-import-contracts.ts";
import { formatLeadImportStatusLabel } from "@/features/crm/contracts/lead-import-contracts.ts";

interface ImportBatchListProps {
  readonly batches: readonly LeadImportBatchSummary[];
}

function statusBadgeClass(status: LeadImportBatchSummary["status"]): string {
  switch (status) {
    case "ready_for_review":
    case "approved":
      return "bg-emerald-500/15 text-emerald-300";
    case "pending_super_admin_approval":
      return "bg-amber-500/15 text-amber-300";
    case "validation_failed":
    case "completed_with_errors":
    case "rejected":
      return "bg-rose-500/15 text-rose-300";
    case "importing":
      return "bg-sky-500/15 text-sky-300";
    case "completed":
      return "bg-emerald-500/15 text-emerald-200";
    case "cancelled":
      return "bg-neutral-700 text-neutral-300";
    default:
      return "bg-neutral-800 text-neutral-300";
  }
}

export function ImportBatchList({ batches }: ImportBatchListProps) {
  if (batches.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-800 bg-neutral-950/60 p-8 text-center">
        <p className="text-sm text-neutral-400">
          No import batches yet. Upload a CSV or XLSX file to stage leads for
          review.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800">
      <table className="min-w-full divide-y divide-neutral-800 text-sm">
        <thead className="bg-neutral-950/80 text-left text-neutral-400">
          <tr>
            <th className="px-4 py-3 font-medium">File</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Rows</th>
            <th className="px-4 py-3 font-medium">Importable</th>
            <th className="px-4 py-3 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-900 bg-neutral-950/40">
          {batches.map((batch) => (
            <tr key={batch.id} className="hover:bg-neutral-900/50">
              <td className="px-4 py-3">
                <Link
                  href={`/admin/crm/imports/${batch.id}`}
                  className="font-medium text-neutral-100 hover:text-amber-300"
                >
                  {batch.originalFilename}
                </Link>
                <p className="text-xs uppercase tracking-wide text-neutral-500">
                  {batch.fileType}
                </p>
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(batch.status)}`}
                >
                  {formatLeadImportStatusLabel(batch.status)}
                </span>
              </td>
              <td className="px-4 py-3 text-neutral-300">{batch.totalRows}</td>
              <td className="px-4 py-3 text-neutral-300">
                {batch.importableRows}
              </td>
              <td className="px-4 py-3 text-neutral-400">
                {new Date(batch.updatedAt).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
