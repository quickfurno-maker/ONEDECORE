import Link from "next/link";
import { notFound } from "next/navigation";
import { QuotationDraftEditor } from "@/features/quotations/components/QuotationDraftEditor";
import { probeQuotationPermissions } from "@/features/quotations/server/quotation-permissions";
import {
  getQuotationDraftByQuotationId,
  listActiveTaxProfiles,
} from "@/features/quotations/server/quotation-queries";

interface PageProps {
  params: Promise<{
    quotationId: string;
  }>;
}

export default async function QuotationDraftPage({ params }: PageProps) {
  const { quotationId } = await params;

  let draft;
  let taxProfiles;
  let canEditQuotations = false;

  try {
    const permissions = await probeQuotationPermissions();
    canEditQuotations = permissions.canEditQuotations;
    draft = await getQuotationDraftByQuotationId(quotationId);
    taxProfiles = await listActiveTaxProfiles();
  } catch {
    notFound();
  }

  if (!draft) {
    notFound();
  }

  const isEditableActiveDraft =
    draft.rootStatus === "active" &&
    draft.version != null &&
    draft.version.status === "draft" &&
    draft.version.isCurrentDraft === true &&
    canEditQuotations === true;

  if (!isEditableActiveDraft) {
    return (
      <div className="p-8 max-w-2xl mx-auto space-y-4 text-center">
        <div className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-6 text-amber-200">
          <h2 className="text-lg font-bold text-amber-100">Archived or Non-Editable Quotation State</h2>
          <p className="mt-2 text-xs text-amber-300">
            {!canEditQuotations
              ? "You do not have permission to edit commercial quotations (quotations.edit permission required). Active draft editing is restricted."
              : "This commercial quotation version is archived or inactive and cannot be edited. Active draft modifications must be performed on the current active version."}
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Link
              href={`/admin/crm/leads/${draft.leadId}`}
              className="inline-flex items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
            >
              Return to CRM Lead Workspace →
            </Link>
            <Link
              href="/admin/quotations"
              className="inline-flex items-center rounded-lg bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-700 shadow"
            >
              Quotations Overview
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <QuotationDraftEditor initialDraft={draft} taxProfiles={taxProfiles} />
    </div>
  );
}
