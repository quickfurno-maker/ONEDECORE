import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { ImportBatchDetail } from "@/features/crm/components/imports/ImportBatchDetail";
import { requireCrmBulkImportAccess } from "@/features/crm/server/crm-auth";
import { fetchActiveLeadSources } from "@/features/crm/server/crm-lead-queries";
import { fetchLeadImportBatchWithRows } from "@/features/crm/server/crm-import-service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Import Batch | ONEDECORE",
  description: "Review and process a staged lead import batch.",
};

interface CrmImportBatchPageProps {
  readonly params: Promise<{ batchId: string }>;
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CrmImportBatchPage({
  params,
  searchParams,
}: CrmImportBatchPageProps) {
  const context = await requireCrmBulkImportAccess();
  const { batchId } = await params;
  const resolvedSearchParams = await searchParams;
  const step =
    typeof resolvedSearchParams.step === "string"
      ? resolvedSearchParams.step
      : undefined;

  let detail;
  try {
    detail = await fetchLeadImportBatchWithRows(batchId);
  } catch {
    notFound();
  }

  const sources = await fetchActiveLeadSources();

  return (
    <div className="space-y-6">
      <CrmPageHeader
        title={detail.batch.originalFilename}
        description="Review validation results, submit for approval, and process importable rows."
      />
      <ImportBatchDetail
        batch={detail.batch}
        rows={detail.rows}
        sources={sources}
        access={{
          canApproveLeadImports: context.canApproveLeadImports,
          canBulkImportLeads: context.canBulkImportLeads,
          userId: context.userId,
        }}
        initialStep={step}
      />
    </div>
  );
}
