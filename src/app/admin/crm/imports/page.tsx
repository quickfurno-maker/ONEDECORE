import type { Metadata } from "next";
import Link from "next/link";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { ImportBatchList } from "@/features/crm/components/imports/ImportBatchList";
import { requireCrmBulkImportAccess } from "@/features/crm/server/crm-auth";
import { fetchLeadImportBatchList } from "@/features/crm/server/crm-import-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CRM Imports | ONEDECORE",
  description: "Bulk lead import batches for authorized ONEDECORE staff.",
};

export default async function CrmImportsPage() {
  await requireCrmBulkImportAccess();
  const batches = await fetchLeadImportBatchList();

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="Lead imports"
        description="Stage CSV or XLSX files, validate rows, and route batches through the approval workflow before leads are created with entry_method import and source bulk-import."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <a href="/admin/crm/imports/template" download
              className="inline-flex min-h-11 items-center rounded-md border border-amber-500/50 px-4 py-2 text-sm font-semibold text-amber-300 hover:bg-amber-500/10">
              Download Excel
            </a>
            <Link href="/admin/crm/imports/new"
              className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950">
              Bulk upload
            </Link>
          </div>
        }
      />
      <ImportBatchList batches={batches} />
    </div>
  );
}
