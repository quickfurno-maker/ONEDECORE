import Link from "next/link";
import { notFound } from "next/navigation";
import { QuotationDraftEditor } from "@/features/quotations/components/QuotationDraftEditor";
import { QuotationFinalizedView } from "@/features/quotations/components/QuotationFinalizedView";
import { probeQuotationPermissions } from "@/features/quotations/server/quotation-permissions";
import {
  getQuotationDraftByQuotationId,
  listActiveTaxProfiles,
} from "@/features/quotations/server/quotation-queries";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{
    quotationId: string;
  }>;
}

/**
 * Reads the document state for a finalized version.
 *
 * Best-effort: the finalized record must render whether or not a PDF exists —
 * a missing document is precisely the situation the retry action is for.
 */
async function readPdfStatus(versionId: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("quotation_pdf_documents")
      .select("status")
      .eq("quotation_version_id", versionId)
      .maybeSingle();
    return (data as { status?: string } | null)?.status ?? null;
  } catch {
    return null;
  }
}

export default async function QuotationDraftPage({ params }: PageProps) {
  const { quotationId } = await params;

  let draft;
  let taxProfiles;
  let canEditQuotations = false;
  let canSendQuotations = false;

  try {
    const permissions = await probeQuotationPermissions();
    canEditQuotations = permissions.canEditQuotations;
    canSendQuotations = permissions.canSendQuotations;
    draft = await getQuotationDraftByQuotationId(quotationId);
    taxProfiles = await listActiveTaxProfiles();
  } catch {
    notFound();
  }

  if (!draft || !draft.version) {
    notFound();
  }

  const version = draft.version;

  const isEditableActiveDraft =
    draft.rootStatus === "active" &&
    version.status === "draft" &&
    version.isCurrentDraft === true &&
    canEditQuotations === true;

  if (isEditableActiveDraft) {
    return (
      <div className="p-6">
        <QuotationDraftEditor initialDraft={draft} taxProfiles={taxProfiles} />
      </div>
    );
  }

  // A finalized quotation is the COMMERCIAL RECORD, not an archive. It used to
  // dead-end here after a reload, which took the document, the client link and
  // the revision path with it.
  if (version.status !== "draft") {
    const pdfStatus = await readPdfStatus(version.id);
    return (
      <div className="p-6">
        <QuotationFinalizedView
          draft={draft}
          canSend={canSendQuotations}
          canEdit={canEditQuotations}
          pdfStatus={pdfStatus}
        />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-4 text-center">
      <div className="rounded-xl border border-amber-800/80 bg-amber-950/40 p-6 text-amber-200">
        <h2 className="text-lg font-bold text-amber-100">Draft editing unavailable</h2>
        <p className="mt-2 text-xs text-amber-300">
          {!canEditQuotations
            ? "You do not have permission to edit commercial quotations (quotations.edit is required)."
            : "This draft is not the current active version, so it cannot be edited."}
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
