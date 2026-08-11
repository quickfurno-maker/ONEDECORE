"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import type { QuotationDraftDTO } from "@/features/quotations/contracts/types";
import { createQuotationDraftAction } from "@/features/quotations/server/quotation-draft-actions";

interface LeadDetailQuotationPanelProps {
  readonly leadId: string;
  readonly submittedName: string;
  readonly existingDraft: QuotationDraftDTO | null;
  readonly canCreateQuotation: boolean;
  readonly canEditQuotation: boolean;
}

export function LeadDetailQuotationPanel({
  leadId,
  submittedName,
  existingDraft,
  canCreateQuotation,
  canEditQuotation,
}: LeadDetailQuotationPanelProps) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const version = existingDraft?.version;
  const hasActiveDraft = Boolean(version && version.status === "draft" && version.isCurrentDraft);
  const hasArchivedRoot = Boolean(existingDraft && !hasActiveDraft);

  const handleCreateOrReopenDraft = async () => {
    setCreating(true);
    setErrorMsg(null);

    const idempotencyKey = `crm-lead-${leadId}-${Date.now()}`;
    const defaultTitle = `${submittedName} — Proposal`;

    const res = await createQuotationDraftAction(leadId, defaultTitle, idempotencyKey);
    setCreating(false);

    if (!res.success || !res.data) {
      setErrorMsg(res.message);
      return;
    }

    router.push(`/admin/quotations/${res.data.quotationId}/draft`);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
            Commercial Quotation (Phase 7A)
          </h3>
          <p className="mt-1 text-xs text-neutral-300">
            {hasActiveDraft
              ? `Active Draft Version ${version?.versionNumber}: "${version?.title}"`
              : hasArchivedRoot
              ? `Prior quotation version archived under root ${existingDraft?.quotationNumber}.`
              : "No commercial quotation draft created for this lead yet."}
          </p>
        </div>

        <div>
          {hasActiveDraft ? (
            canEditQuotation || canCreateQuotation ? (
              <Link
                href={`/admin/quotations/${existingDraft?.quotationId}/draft`}
                className="inline-flex min-h-10 items-center rounded-lg bg-amber-500 px-4 py-2 text-xs font-semibold text-neutral-950 hover:bg-amber-400 shadow"
              >
                Open Quotation Draft
              </Link>
            ) : (
              <span className="text-xs text-neutral-500 italic">
                (Quotation edit permission required)
              </span>
            )
          ) : canCreateQuotation ? (
            hasArchivedRoot ? (
              <button
                type="button"
                disabled={creating}
                className="inline-flex min-h-10 items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 shadow"
                onClick={handleCreateOrReopenDraft}
              >
                {creating ? "Allocating Next Version..." : "Start New Draft Version"}
              </button>
            ) : (
              <button
                type="button"
                disabled={creating}
                className="inline-flex min-h-10 items-center rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50 shadow"
                onClick={handleCreateOrReopenDraft}
              >
                {creating ? "Creating Draft..." : "Create Quotation Draft"}
              </button>
            )
          ) : (
            <span className="text-xs text-neutral-500 italic">
              (Quotation creation permission required)
            </span>
          )}
        </div>
      </div>

      {errorMsg && (
        <div className="mt-3 rounded-md border border-rose-800 bg-rose-950/80 p-2.5 text-xs text-rose-200">
          {errorMsg}
        </div>
      )}

      {hasActiveDraft && version && (
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-neutral-950 p-3.5 text-xs border border-neutral-800/80 sm:grid-cols-4">
          <div>
            <span className="text-neutral-500 block">Quotation No.</span>
            <span className="font-mono font-medium text-neutral-200">{existingDraft?.quotationNumber}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Lock Version</span>
            <span className="font-mono text-neutral-300">v{version.lockVersion}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Subtotal</span>
            <span className="font-mono text-neutral-300">{formatInrFromPaise(version.subtotalPaise)}</span>
          </div>
          <div>
            <span className="text-neutral-500 block">Grand Total</span>
            <span className="font-mono font-semibold text-emerald-400">
              {version.grandTotalPaise != null ? formatInrFromPaise(version.grandTotalPaise) : "(Unconfigured Tax)"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
