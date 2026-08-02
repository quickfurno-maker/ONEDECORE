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
          <Link
            href="/admin/crm/imports/new"
            className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            New import
          </Link>
        }
      />
      <ImportBatchList batches={batches} />
    </div>
  );
}
