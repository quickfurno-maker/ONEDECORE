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
    <div className="crm-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-[var(--crm-text)]">
            Commercial Quotation (Phase 7A)
          </h3>
          <p className="mt-1 text-xs text-[var(--crm-text-secondary)]">
            {hasActiveDraft
              ? `Active Draft Version ${version?.versionNumber}: "${version?.title}"`
              : hasArchivedRoot
              ? `Prior quotation version archived under root ${existingDraft?.quotationNumber}.`
              : "No commercial quotation draft created for this lead yet."}
          </p>
        </div>

        <div>
          {hasActiveDraft ? (
            canEditQuotation ? (
              <Link
                href={`/admin/quotations/${existingDraft?.quotationId}/draft`}
                className="inline-flex min-h-10 items-center rounded-lg bg-[var(--crm-primary)] px-4 py-2 text-xs font-semibold text-white hover:bg-[var(--crm-primary-hover)] shadow"
              >
                Open Quotation Draft
              </Link>
            ) : (
              <span className="text-xs text-[var(--crm-muted)] italic">
                Viewing active draft requires quotation edit permission (quotations.edit).
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
            <span className="text-xs text-[var(--crm-muted)] italic">
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
        <div className="mt-4 grid grid-cols-2 gap-4 rounded-lg bg-[var(--crm-surface-subtle)] p-3.5 text-xs border border-[var(--crm-border)]/80 sm:grid-cols-4">
          <div>
            <span className="text-[var(--crm-muted)] block">Quotation No.</span>
            <span className="font-mono font-medium text-[var(--crm-text)]">{existingDraft?.quotationNumber}</span>
          </div>
          <div>
            <span className="text-[var(--crm-muted)] block">Lock Version</span>
            <span className="font-mono text-[var(--crm-text-secondary)]">v{version.lockVersion}</span>
          </div>
          <div>
            <span className="text-[var(--crm-muted)] block">Subtotal</span>
            <span className="font-mono text-[var(--crm-text-secondary)]">{formatInrFromPaise(version.subtotalPaise)}</span>
          </div>
          <div>
            <span className="text-[var(--crm-muted)] block">Grand Total</span>
            <span className="font-mono font-semibold text-emerald-400">
              {version.grandTotalPaise != null ? formatInrFromPaise(version.grandTotalPaise) : "(Unconfigured Tax)"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
