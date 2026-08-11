"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type {
  PaymentScheduleMode,
  QuotationDiscountType,
  QuotationDraftDTO,
  QuotationPaymentScheduleMilestoneDTO,
  QuotationSectionDTO,
  QuotationTaxProfileDTO,
} from "../contracts/types";
import {
  archiveQuotationDraftAction,
  replaceQuotationPaymentScheduleAction,
  saveQuotationDraftItemsAction,
  updateQuotationDraftAction,
} from "../server/quotation-draft-actions";
import { QuotationDiscountCard } from "./QuotationDiscountCard";
import { QuotationHeaderCard } from "./QuotationHeaderCard";
import { QuotationPaymentScheduleEditor } from "./QuotationPaymentScheduleEditor";
import { QuotationSectionAccordion } from "./QuotationSectionAccordion";
import { QuotationTermsEditor } from "./QuotationTermsEditor";
import { QuotationTotalsSummary } from "./QuotationTotalsSummary";

interface QuotationDraftEditorProps {
  readonly initialDraft: QuotationDraftDTO;
  readonly taxProfiles: readonly QuotationTaxProfileDTO[];
}

export function QuotationDraftEditor({
  initialDraft,
  taxProfiles,
}: QuotationDraftEditorProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<QuotationDraftDTO>(initialDraft);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const version = draft.version;
  if (!version) {
    return (
      <div className="p-8 text-center text-neutral-400">
        No active draft found for this quotation.
      </div>
    );
  }

  const handleUpdateTitleAndScope = async (title: string, scopeSummary: string) => {
    setSaving(true);
    setMessage(null);
    setConflictMessage(null);

    const res = await updateQuotationDraftAction(draft.quotationId, version.lockVersion, {
      title,
      scopeSummary,
    });

    setSaving(false);
    if (!res.success) {
      if (res.code === "QUOTATION_VERSION_CONFLICT") {
        setConflictMessage(res.message);
      } else {
        setMessage({ type: "error", text: res.message });
      }
      return;
    }

    if (res.data) {
      setDraft(res.data);
    }
    setMessage({ type: "success", text: "Header details updated." });
  };

  const handleSelectTaxProfile = async (taxProfileId: string | null) => {
    setSaving(true);
    setMessage(null);
    setConflictMessage(null);

    const res = await updateQuotationDraftAction(draft.quotationId, version.lockVersion, {
      taxProfileId: taxProfileId || undefined,
      clearTaxProfile: taxProfileId == null,
    });

    setSaving(false);
    if (!res.success) {
      if (res.code === "QUOTATION_VERSION_CONFLICT") {
        setConflictMessage(res.message);
      } else {
        setMessage({ type: "error", text: res.message });
      }
      return;
    }

    if (res.data) {
      setDraft(res.data);
    }
    setMessage({ type: "success", text: "Tax profile updated." });
  };

  const handleUpdateDiscount = async (
    discountType: QuotationDiscountType,
    discountValuePaise: number,
    discountPercentage: number
  ) => {
    setSaving(true);
    setMessage(null);
    setConflictMessage(null);

    const res = await updateQuotationDraftAction(draft.quotationId, version.lockVersion, {
      discountType,
      discountValuePaise,
      discountPercentage,
    });

    setSaving(false);
    if (!res.success) {
      if (res.code === "QUOTATION_VERSION_CONFLICT") {
        setConflictMessage(res.message);
      } else {
        setMessage({ type: "error", text: res.message });
      }
      return;
    }

    if (res.data) {
      setDraft(res.data);
    }
    setMessage({ type: "success", text: "Discount updated." });
  };

  const handleSaveSections = async (sections: readonly QuotationSectionDTO[]) => {
    setSaving(true);
    setMessage(null);
    setConflictMessage(null);

    const res = await saveQuotationDraftItemsAction(draft.quotationId, version.lockVersion, sections);

    setSaving(false);
    if (!res.success) {
      if (res.code === "QUOTATION_VERSION_CONFLICT") {
        setConflictMessage(res.message);
      } else {
        setMessage({ type: "error", text: res.message });
      }
      return;
    }

    if (res.data) {
      setDraft(res.data);
    }
    setMessage({ type: "success", text: "Line items saved successfully." });
  };

  const handleSaveSchedule = async (
    mode: PaymentScheduleMode,
    milestones: readonly QuotationPaymentScheduleMilestoneDTO[]
  ) => {
    setSaving(true);
    setMessage(null);
    setConflictMessage(null);

    const res = await replaceQuotationPaymentScheduleAction(
      draft.quotationId,
      version.lockVersion,
      mode,
      milestones
    );

    setSaving(false);
    if (!res.success) {
      if (res.code === "QUOTATION_VERSION_CONFLICT") {
        setConflictMessage(res.message);
      } else {
        setMessage({ type: "error", text: res.message });
      }
      return;
    }

    if (res.data) {
      setDraft(res.data);
    }
    setMessage({ type: "success", text: "Payment schedule saved successfully." });
  };

  const handleSaveTerms = async (
    terms: string,
    inclusions: readonly string[],
    exclusions: readonly string[]
  ) => {
    setSaving(true);
    setMessage(null);
    setConflictMessage(null);

    const res = await updateQuotationDraftAction(draft.quotationId, version.lockVersion, {
      termsAndConditions: terms,
      inclusions,
      exclusions,
    });

    setSaving(false);
    if (!res.success) {
      if (res.code === "QUOTATION_VERSION_CONFLICT") {
        setConflictMessage(res.message);
      } else {
        setMessage({ type: "error", text: res.message });
      }
      return;
    }

    if (res.data) {
      setDraft(res.data);
    }
    setMessage({ type: "success", text: "Terms and conditions updated." });
  };

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this quotation draft?")) return;

    setSaving(true);
    const res = await archiveQuotationDraftAction(draft.quotationId, version.lockVersion);
    setSaving(false);

    if (!res.success) {
      setMessage({ type: "error", text: res.message });
      return;
    }

    router.push("/admin/quotations");
  };

  return (
    <div className="space-y-6">
      {/* Lock Version Conflict Banner */}
      {conflictMessage && (
        <div className="rounded-xl border border-rose-800/80 bg-rose-950/80 p-4 text-xs text-rose-200">
          <div className="flex items-center justify-between">
            <div>
              <strong className="font-semibold text-rose-100">⚠️ Concurrency Conflict: </strong>
              {conflictMessage}
            </div>
            <button
              type="button"
              className="rounded bg-rose-800 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700"
              onClick={() => router.refresh()}
            >
              Reload Latest Draft State
            </button>
          </div>
        </div>
      )}

      {/* Action Notification Banner */}
      {message && (
        <div
          className={`rounded-lg p-3 text-xs ${
            message.type === "success"
              ? "border border-emerald-800 bg-emerald-950/80 text-emerald-200"
              : "border border-rose-800 bg-rose-950/80 text-rose-200"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Draft Header */}
      <QuotationHeaderCard
        version={version}
        quotationNumber={draft.quotationNumber}
        taxProfiles={taxProfiles}
        onUpdateTitleAndScope={handleUpdateTitleAndScope}
        onSelectTaxProfile={handleSelectTaxProfile}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Room / Section Accordion & Line Items */}
          <QuotationSectionAccordion
            sections={draft.sections}
            onSaveSections={handleSaveSections}
          />

          {/* Discount Card */}
          <QuotationDiscountCard
            version={version}
            onUpdateDiscount={handleUpdateDiscount}
          />

          {/* Payment Schedule */}
          <QuotationPaymentScheduleEditor
            version={version}
            schedules={draft.paymentSchedules}
            onSaveSchedule={handleSaveSchedule}
          />

          {/* Inclusions, Exclusions & Terms */}
          <QuotationTermsEditor version={version} onSaveTerms={handleSaveTerms} />
        </div>

        <div className="space-y-6">
          {/* Commercial Summary Card */}
          <QuotationTotalsSummary version={version} />

          {/* Draft Actions & Governance Status */}
          <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Draft Actions
            </h4>
            <div className="mt-3 space-y-2">
              <button
                type="button"
                disabled={saving}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-800 px-4 py-2 text-xs font-semibold text-neutral-200 hover:bg-neutral-700 disabled:opacity-50"
                onClick={() => router.refresh()}
              >
                Refresh Canonical State
              </button>

              <button
                type="button"
                disabled={saving}
                className="w-full rounded-lg border border-rose-900/80 bg-rose-950/40 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-900/60 disabled:opacity-50"
                onClick={handleArchive}
              >
                Archive Draft
              </button>
            </div>

            <div className="mt-4 rounded-lg bg-neutral-950 p-3 text-[11px] text-neutral-400 border border-neutral-800/80">
              <p className="font-semibold text-neutral-300">Phase 7A Boundaries Active:</p>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li>V1 Direct Sales Executive Authority (ADR-0022)</li>
                <li>No Approval Workflow / No Manager Override</li>
                <li>No Finalize, PDF, WhatsApp, or Client Link in 7A</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
