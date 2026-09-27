"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isTerminalLeadStage, type LeadStageCode } from "../../contracts/lead-stages.ts";
import { createQuotationDraftAction } from "@/features/quotations/server/quotation-draft-actions";
import { startCrmWhatsappConversationAction } from "../../server/crm-whatsapp-actions.ts";
import { useLeadActions } from "./LeadActionsProvider.tsx";

/**
 * CRM command quick actions — canonical mutations plus WhatsApp workspace navigation.
 *
 * Every action either dispatches an intent to the component that already owns
 * the mutation, navigates, or calls the one governed WhatsApp preparation
 * action. This component never writes a table or calls Supabase directly;
 * canonical activity, note, quotation and WhatsApp authorities remain server-side.
 *
 * WhatsApp now uses the canonical CRM↔conversation link. Opening an existing
 * production thread navigates only; starting one calls the governed CRM server
 * action, which prepares local conversation evidence and never sends by itself.
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
  readonly canUseWhatsapp: boolean;
  readonly whatsappConversationId: string | null;
  readonly whatsappProductionReady: boolean;
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
  canUseWhatsapp,
  whatsappConversationId,
  whatsappProductionReady,
}: LeadQuickActionsProps) {
  const router = useRouter();
  const actions = useLeadActions();
  const [creatingQuotation, setCreatingQuotation] = useState(false);
  const [openingWhatsapp, setOpeningWhatsapp] = useState(false);
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

  const showWhatsapp = canUseWhatsapp && (whatsappConversationId !== null || !isTerminal);

  const handleWhatsapp = async () => {
    setErrorMessage(null);
    if (whatsappConversationId) {
      router.push(`/admin/whatsapp/inbox/${whatsappConversationId}`);
      return;
    }
    if (!whatsappProductionReady) {
      setErrorMessage("The real ONEDECORE WhatsApp number is not activated yet. Meta setup can be completed later.");
      return;
    }

    setOpeningWhatsapp(true);
    const result = await startCrmWhatsappConversationAction(leadId);
    setOpeningWhatsapp(false);
    if (!result.success) {
      setErrorMessage(result.message);
      return;
    }
    router.push(`/admin/whatsapp/inbox/${result.conversationId}`);
  };

  const hasAnyAction =
    canMutateActivities ||
    (canManageLeadNotes && !isTerminal) ||
    showQuotation ||
    showWhatsapp;

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

        {showWhatsapp ? (
          <button
            type="button"
            className={ACTION_CLASS}
            data-testid="crm-quick-action-whatsapp"
            disabled={openingWhatsapp}
            onClick={handleWhatsapp}
            title={whatsappProductionReady || whatsappConversationId ? undefined : "Production WhatsApp setup pending"}
          >
            {openingWhatsapp ? "Opening…" : "WhatsApp"}
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
