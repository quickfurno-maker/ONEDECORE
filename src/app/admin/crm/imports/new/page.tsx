import type { Metadata } from "next";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { ImportWizard } from "@/features/crm/components/imports/ImportWizard";
import { requireCrmBulkImportAccess } from "@/features/crm/server/crm-auth";
import { fetchActiveLeadSources } from "@/features/crm/server/crm-lead-queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "New Lead Import | ONEDECORE",
  description: "Upload and map a bulk lead import file.",
};

export default async function CrmNewImportPage() {
  await requireCrmBulkImportAccess();
  const sources = await fetchActiveLeadSources();

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title="New import"
        description="Upload a CSV or XLSX file. Parsed rows are staged server-side — raw files are not persisted."
      />
      <ImportWizard sources={sources} />
    </div>
  );
}
