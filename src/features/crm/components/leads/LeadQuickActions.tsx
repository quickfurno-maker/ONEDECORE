"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isTerminalLeadStage, type LeadStageCode } from "../../contracts/lead-stages.ts";
import { createQuotationDraftAction } from "@/features/quotations/server/quotation-draft-actions";
import { useLeadActions } from "./LeadActionsProvider.tsx";

/**
 * CRM 2D-1 — the five owner-locked quick actions (Q8).
 *
 * Every action either dispatches an intent to the component that already owns
 * the mutation, or navigates. NOTHING here writes a table, calls Supabase, or
 * introduces a second server action: the canonical activity, note, and
 * quotation authorities remain untouched.
 *
 * There is deliberately NO WhatsApp quick action — `whatsapp_conversations.lead_id`
 * has no canonical writer, so no lead can be resolved to a conversation. See the
 * CRM 2D design doc §P.1 (pre-launch blocker).
 *
 * Permission-denied actions are OMITTED rather than rendered disabled, matching
 * the gating used throughout the activity workspace.
 */

interface LeadQuickActionsProps {
  readonly leadId: string;
  readonly submittedName: string;
  readonly leadStatus: LeadStageCode;
  readonly canManageLeadFollowUps: boolean;
  readonly canManageLeadNotes: boolean;
  readonly hasOpenPrimaryNextAction: boolean;
  readonly quotationId: string | null;
  readonly canCreateQuotation: boolean;
  readonly canEditQuotation: boolean;
}

const ACTION_CLASS =
  "crm-btn crm-btn-secondary min-h-11 w-full justify-center px-3 text-[13px] sm:w-auto";

export function LeadQuickActions({
  leadId,
  submittedName,
  leadStatus,
  canManageLeadFollowUps,
  canManageLeadNotes,
  hasOpenPrimaryNextAction,
  quotationId,
  canCreateQuotation,
  canEditQuotation,
}: LeadQuickActionsProps) {
  const router = useRouter();
  const actions = useLeadActions();
  const [creatingQuotation, setCreatingQuotation] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isTerminal = isTerminalLeadStage(leadStatus);
  const canMutateActivities = canManageLeadFollowUps && !isTerminal;

  // Reuses LeadDetailQuotationPanel's exact create-then-navigate flow so there
  // is only one quotation-draft entry point in the product.
  const handleQuotation = async () => {
    if (quotationId) {
      router.push(`/admin/quotations/${quotationId}/draft`);
      return;
    }

    setCreatingQuotation(true);
    setErrorMessage(null);

    const result = await createQuotationDraftAction(
      leadId,
      `${submittedName} — Proposal`,
      `crm-lead-${leadId}-${Date.now()}`
    );

    setCreatingQuotation(false);

    if (!result.success || !result.data) {
      setErrorMessage(result.message);
      return;
    }

    router.push(`/admin/quotations/${result.data.quotationId}/draft`);
  };

  const showQuotation = quotationId
    ? canEditQuotation && leadStatus !== "closed_lost"
    : canCreateQuotation && !isTerminal;

  const hasAnyAction =
    canMutateActivities || (canManageLeadNotes && !isTerminal) || showQuotation;

  if (!hasAnyAction) {
    return null;
  }

  return (
    <div data-testid="crm-lead-quick-actions">
      <h2 className="sr-only">Quick actions</h2>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
        {canMutateActivities ? (
          <button
            type="button"
            className={ACTION_CLASS}
            data-testid="crm-quick-action-call"
            onClick={() =>
              actions?.dispatchIntent({
                kind: "create-activity",
                activityType: "call",
              })
            }
          >
            Call
          </button>
        ) : null}

        {canMutateActivities && hasOpenPrimaryNextAction ? (
          <button
            type="button"
            className={ACTION_CLASS}
            data-testid="crm-quick-action-complete"
            onClick={() => actions?.dispatchIntent({ kind: "complete-primary" })}
          >
            Complete next action
          </button>
        ) : null}

        {canMutateActivities ? (
          <button
            type="button"
            className={ACTION_CLASS}
            data-testid="crm-quick-action-add-activity"
            onClick={() =>
              actions?.dispatchIntent({
                kind: "create-activity",
                activityType: null,
              })
            }
          >
            Add activity
          </button>
        ) : null}

        {canManageLeadNotes && !isTerminal ? (
          <button
            type="button"
            className={ACTION_CLASS}
            data-testid="crm-quick-action-add-note"
            onClick={() => actions?.dispatchIntent({ kind: "add-note" })}
          >
            Add note
          </button>
        ) : null}

        {showQuotation ? (
          quotationId ? (
            <Link
              href={`/admin/quotations/${quotationId}/draft`}
              className={ACTION_CLASS}
              data-testid="crm-quick-action-quotation"
            >
              Quotation
            </Link>
          ) : (
            <button
              type="button"
              className={ACTION_CLASS}
              data-testid="crm-quick-action-quotation"
              disabled={creatingQuotation}
              onClick={handleQuotation}
            >
              {creatingQuotation ? "Creating…" : "Quotation"}
            </button>
          )
        ) : null}
      </div>

      {errorMessage ? (
        <p
          role="alert"
          className="mt-2 text-[12px] text-[var(--crm-danger)]"
          data-testid="crm-quick-action-error"
        >
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
