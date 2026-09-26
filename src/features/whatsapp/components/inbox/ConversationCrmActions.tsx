"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CRM_MANUAL_SALES_TEMPERATURES,
  CRM_MANUAL_SALES_TEMPERATURE_LABELS,
} from "@/features/crm/contracts/lead-sales-temperature.ts";
import {
  getForwardTransitionOptions,
  type LifecycleActionState,
} from "@/features/crm/contracts/lifecycle-contracts.ts";
import { formatCrmCodeLabel } from "@/features/crm/contracts/crm-labels.ts";
import {
  isTerminalLeadStage,
} from "@/features/crm/contracts/lead-stages.ts";
import {
  addLeadNoteAction,
  transitionLeadStatusAction,
} from "@/features/crm/server/crm-lifecycle-actions.ts";
import {
  createLeadActivityAction,
  rescheduleLeadActivityAction,
} from "@/features/crm/server/crm-activity-actions.ts";
import {
  INITIAL_CRM_ACTIVITY_ACTION_STATE,
  type CrmActivityActionState,
} from "@/features/crm/contracts/activity-contracts.ts";
import {
  appendAbsoluteTimestampsFromLocalFields,
} from "@/features/crm/lib/local-datetime-to-iso.ts";
import { setLeadSalesTemperatureAction } from "@/features/crm/server/crm-sales-temperature-actions.ts";
import { createQuotationDraftAction } from "@/features/quotations/server/quotation-draft-actions.ts";
import type { ConversationLeadSummary } from "./ConversationDetailsPanel.tsx";

const INITIAL: LifecycleActionState = { success: false, message: "" };

async function createPrimaryActivityFromLocalTime(
  previousState: CrmActivityActionState,
  formData: FormData
): Promise<CrmActivityActionState> {
  const ok = appendAbsoluteTimestampsFromLocalFields(formData, [
    { local: "dueAtLocal", absolute: "dueAt", required: true },
  ]);
  if (!ok) {
    return {
      success: false,
      message: "Choose a valid next-action date and time.",
      code: "VALIDATION_FAILED",
      fieldErrors: { dueAt: "Choose a valid next-action date and time." },
    };
  }
  formData.set("priority", "normal");
  formData.set("isPrimary", "true");
  return createLeadActivityAction(previousState, formData);
}

async function rescheduleNextActionFromLocalTime(
  previousState: CrmActivityActionState,
  formData: FormData
): Promise<CrmActivityActionState> {
  const ok = appendAbsoluteTimestampsFromLocalFields(formData, [
    { local: "dueAtLocal", absolute: "dueAt", required: true },
  ]);
  if (!ok) {
    return {
      success: false,
      message: "Choose a valid new date and time.",
      code: "VALIDATION_FAILED",
      fieldErrors: { dueAt: "Choose a valid new date and time." },
    };
  }
  formData.set("clearReminder", "false");
  return rescheduleLeadActivityAction(previousState, formData);
}

function Notice({
  state,
}: {
  readonly state: { readonly success: boolean; readonly message: string };
}) {
  if (!state.message) return null;
  return (
    <p
      className={state.success ? "od-wa__crm-success" : "od-wa__crm-error"}
      role={state.success ? "status" : "alert"}
    >
      {state.message}
    </p>
  );
}

export function ConversationCrmActions({
  lead,
}: {
  readonly lead: ConversationLeadSummary;
}) {
  const router = useRouter();
  const [noteState, noteAction, notePending] = useActionState(
    addLeadNoteAction,
    INITIAL
  );
  const [nextActionState, nextActionAction, nextActionPending] = useActionState(
    createPrimaryActivityFromLocalTime,
    INITIAL_CRM_ACTIVITY_ACTION_STATE
  );
  const [rescheduleState, rescheduleAction, reschedulePending] =
    useActionState(
      rescheduleNextActionFromLocalTime,
      INITIAL_CRM_ACTIVITY_ACTION_STATE
    );
  const [temperatureState, temperatureAction, temperaturePending] =
    useActionState(setLeadSalesTemperatureAction, INITIAL);
  const [stageState, stageAction, stagePending] = useActionState(
    transitionLeadStatusAction,
    INITIAL
  );
  const [quotationPending, setQuotationPending] = useState(false);
  const [quotationError, setQuotationError] = useState<string | null>(null);

  const anySuccess =
    noteState.success ||
    nextActionState.success ||
    rescheduleState.success ||
    temperatureState.success ||
    stageState.success;

  useEffect(() => {
    if (anySuccess) {
      router.refresh();
    }
  }, [anySuccess, router]);

  const terminal = isTerminalLeadStage(lead.statusCode);
  const forwardStages = getForwardTransitionOptions(lead.statusCode);
  const canOpenQuotation =
    lead.quotationId !== null &&
    lead.canReadQuotation;
  const canCreateQuotation =
    lead.quotationId === null && lead.canCreateQuotation && !terminal;

  const handleQuotation = async () => {
    if (lead.quotationId) {
      router.push(`/admin/quotations/${lead.quotationId}/draft`);
      return;
    }

    setQuotationPending(true);
    setQuotationError(null);
    const result = await createQuotationDraftAction(
      lead.leadId,
      `${lead.name} — Proposal`,
      `whatsapp-inbox-${lead.leadId}-${Date.now()}`
    );
    setQuotationPending(false);

    if (!result.success || !result.data) {
      setQuotationError(result.message);
      return;
    }

    router.push(`/admin/quotations/${result.data.quotationId}/draft`);
  };

  const hasAnyAction =
    (lead.canSetSalesTemperature && !terminal) ||
    (lead.canTransitionLeads &&
      (forwardStages.length > 0 || lead.resumeTargetStatus !== null)) ||
    (lead.canManageLeadNotes && !terminal) ||
    (lead.canManageLeadFollowUps && !terminal) ||
    canOpenQuotation ||
    canCreateQuotation;

  if (!hasAnyAction) {
    return null;
  }

  return (
    <section
      className="od-wa__crm-actions"
      aria-label="CRM quick actions"
      data-testid="whatsapp-crm-inline-actions"
    >
      <div className="od-wa__crm-actions-head">
        <div>
          <p className="od-wa__dt">Quick actions</p>
          <p className="od-wa__empty-note">
            Updates use the same governed CRM actions as the lead workspace.
          </p>
        </div>
      </div>

      {lead.canSetSalesTemperature && !terminal ? (
        <div className="od-wa__crm-block">
          <p className="od-wa__dt">Sales classification</p>
          <form action={temperatureAction} className="od-wa__crm-chip-row">
            <input type="hidden" name="leadId" value={lead.leadId} />
            {CRM_MANUAL_SALES_TEMPERATURES.map((temperature) => (
              <button
                key={temperature}
                type="submit"
                name="temperature"
                value={temperature}
                disabled={temperaturePending}
                aria-pressed={lead.salesBucket === temperature}
                className="od-wa__crm-chip"
                data-active={lead.salesBucket === temperature ? "true" : "false"}
              >
                {CRM_MANUAL_SALES_TEMPERATURE_LABELS[temperature]}
              </button>
            ))}
          </form>
          <Notice state={temperatureState} />
        </div>
      ) : null}

      {lead.canTransitionLeads &&
      (forwardStages.length > 0 || lead.resumeTargetStatus !== null) ? (
        <div className="od-wa__crm-block">
          <p className="od-wa__dt">Stage</p>
          <div className="od-wa__crm-chip-row">
            {lead.resumeTargetStatus ? (
              <form action={stageAction}>
                <input type="hidden" name="leadId" value={lead.leadId} />
                <input
                  type="hidden"
                  name="newStatus"
                  value={lead.resumeTargetStatus}
                />
                <button
                  type="submit"
                  disabled={stagePending}
                  className="od-wa__crm-chip"
                >
                  Resume to {formatCrmCodeLabel(lead.resumeTargetStatus)}
                </button>
              </form>
            ) : null}
            {forwardStages.map((status) => (
              <form key={status} action={stageAction}>
                <input type="hidden" name="leadId" value={lead.leadId} />
                <input type="hidden" name="newStatus" value={status} />
                <button
                  type="submit"
                  disabled={stagePending}
                  className="od-wa__crm-chip"
                >
                  Move to {formatCrmCodeLabel(status)}
                </button>
              </form>
            ))}
          </div>
          <Notice state={stageState} />
          {!terminal ? (
            <Link
              href={`/admin/crm/leads/${lead.leadId}`}
              className="od-wa__crm-subtle-link"
            >
              On Hold / Lost actions stay in CRM because they require governed
              reasons.
            </Link>
          ) : null}
        </div>
      ) : null}

      {lead.canManageLeadNotes && !terminal ? (
        <details className="od-wa__crm-disclosure">
          <summary>Add note</summary>
          <form action={noteAction} className="od-wa__crm-form">
            <input type="hidden" name="leadId" value={lead.leadId} />
            <textarea
              name="body"
              rows={3}
              maxLength={4000}
              required
              className="od-wa__input"
              placeholder="Internal CRM note"
            />
            <button
              type="submit"
              disabled={notePending}
              className="od-wa__btn"
            >
              {notePending ? "Saving…" : "Save note"}
            </button>
            <Notice state={noteState} />
          </form>
        </details>
      ) : null}

      {lead.canManageLeadFollowUps && !terminal ? (
        lead.nextActionId ? (
          <details className="od-wa__crm-disclosure">
            <summary>Reschedule next action</summary>
            <form action={rescheduleAction} className="od-wa__crm-form">
              <input type="hidden" name="activityId" value={lead.nextActionId} />
              <input
                type="datetime-local"
                name="dueAtLocal"
                required
                className="od-wa__input"
              />
              <button
                type="submit"
                disabled={reschedulePending}
                className="od-wa__btn"
              >
                {reschedulePending ? "Rescheduling…" : "Reschedule"}
              </button>
              <p className="od-wa__empty-note">
                Current primary action: {lead.nextActionTitle ?? "Next action"}.
                Rescheduling keeps the same CRM activity and preserves its existing reminder.
              </p>
              <Notice state={rescheduleState} />
            </form>
          </details>
        ) : (
          <details className="od-wa__crm-disclosure">
            <summary>Schedule next action</summary>
            <form action={nextActionAction} className="od-wa__crm-form">
              <input type="hidden" name="leadId" value={lead.leadId} />
              <input type="hidden" name="ownerId" value={lead.ownerId ?? ""} />
              <input type="hidden" name="isPrimary" value="true" />
              <label className="od-wa__dt">
                Type
                <select name="activityType" defaultValue="call" className="od-wa__input">
                  <option value="call">Call</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="consultation">Consultation</option>
                  <option value="site_visit">Site visit</option>
                  <option value="quotation_follow_up">Quotation follow-up</option>
                  <option value="internal_task">Internal task</option>
                </select>
              </label>
              <label className="od-wa__dt">
                Title
                <input
                  name="title"
                  required
                  maxLength={120}
                  defaultValue="Follow up with lead"
                  className="od-wa__input"
                />
              </label>
              <label className="od-wa__dt">
                Due
                <input
                  type="datetime-local"
                  name="dueAtLocal"
                  required
                  className="od-wa__input"
                />
              </label>
              <button
                type="submit"
                disabled={nextActionPending}
                className="od-wa__btn"
              >
                {nextActionPending ? "Scheduling…" : "Create primary next action"}
              </button>
              <p className="od-wa__empty-note">
                Creates the same primary CRM activity used by My Day and Calendar.
              </p>
              <Notice state={nextActionState} />
            </form>
          </details>
        )
      ) : null}

      {canOpenQuotation || canCreateQuotation ? (
        <div className="od-wa__crm-block">
          <p className="od-wa__dt">Quotation</p>
          <button
            type="button"
            className="od-wa__btn"
            disabled={quotationPending}
            onClick={handleQuotation}
          >
            {lead.quotationId
              ? "Open quotation"
              : quotationPending
                ? "Creating…"
                : "Create quotation"}
          </button>
          {quotationError ? (
            <p className="od-wa__crm-error" role="alert">
              {quotationError}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
