import Link from "next/link";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import { listLeadQuotations } from "@/features/quotations/server/quotation-queries";

export const metadata = {
  title: "Commercial Quotations | OneDecore Admin",
  description: "Phase 7A Commercial Quotation Data & Draft Workspace",
};

export default async function AdminQuotationsOverviewPage() {
  let quotations: readonly Awaited<ReturnType<typeof listLeadQuotations>>[number][] = [];
  let errorMessage: string | null = null;

  try {
    quotations = await listLeadQuotations();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Commercial Quotations</h1>
          <p className="mt-1 text-xs text-neutral-400">
            Phase 7A Commercial Quotation Data & Draft Foundation. Access is scoped to assigned sales leads.
          </p>
        </div>
        <Link
          href="/admin/crm"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
        >
          View Sales Leads in CRM
        </Link>
      </div>

      {errorMessage && (
        <div className="rounded-lg border border-rose-800 bg-rose-950/80 p-4 text-xs text-rose-200">
          {errorMessage}
        </div>
      )}

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 overflow-hidden shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="p-3">Quotation Number</th>
              <th className="p-3">Lead ID</th>
              <th className="p-3">Version</th>
              <th className="p-3">Grand Total</th>
              <th className="p-3">Root Status</th>
              <th className="p-3">Last Updated</th>
              <th className="p-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 text-neutral-200">
            {quotations.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-neutral-500">
                  No commercial quotations found. Open a lead in CRM to create an initial quotation draft.
                </td>
              </tr>
            ) : (
              quotations.map((q) => (
                <tr key={q.id} className="hover:bg-neutral-800/40">
                  <td className="p-3 font-mono font-bold text-neutral-100">{q.quotationNumber}</td>
                  <td className="p-3 font-mono text-neutral-400">{q.leadId.substring(0, 8)}...</td>
                  <td className="p-3">
                    {q.currentVersionNumber != null ? (
                      <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-[11px] text-neutral-300">
                        v{q.currentVersionNumber}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="p-3 font-mono">
                    {q.grandTotalPaise != null
                      ? formatInrFromPaise(q.grandTotalPaise)
                      : "(Incomplete)"}
                  </td>
                  <td className="p-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        q.status === "active"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                          : "bg-neutral-800 text-neutral-400"
                      }`}
                    >
                      {q.status}
                    </span>
                  </td>
                  <td className="p-3 text-neutral-400">
                    {new Date(q.updatedAt).toLocaleDateString("en-IN")}
                  </td>
                  <td className="p-3 text-right">
                    <Link
                      href={`/admin/quotations/${q.id}/draft`}
                      className="text-emerald-400 hover:underline font-semibold"
                    >
                      Open Draft Editor →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
