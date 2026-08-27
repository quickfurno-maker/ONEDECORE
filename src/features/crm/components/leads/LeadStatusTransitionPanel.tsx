"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CrmLeadClosureReasonOption } from "../../contracts/lead-detail-dtos.ts";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import { getForwardTransitionOptions } from "../../contracts/lifecycle-contracts.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import {
  isTerminalLeadStage,
  type LeadStageCode,
} from "../../contracts/lead-stages.ts";
import { transitionLeadStatusAction } from "../../server/crm-lifecycle-actions.ts";
import { LeadClosedLostDialog } from "./LeadClosedLostDialog.tsx";
import { LeadOnHoldDialog } from "./LeadOnHoldDialog.tsx";

const INITIAL_STATE: LifecycleActionState = {
  success: false,
  message: "",
};

interface LeadStatusTransitionPanelProps {
  readonly leadId: string;
  readonly currentStatus: LeadStageCode;
  readonly resumeTargetStatus: LeadStageCode | null;
  readonly canTransitionLeads: boolean;
  readonly closureReasons: readonly CrmLeadClosureReasonOption[];
}

export function LeadStatusTransitionPanel({
  leadId,
  currentStatus,
  resumeTargetStatus,
  canTransitionLeads,
  closureReasons,
}: LeadStatusTransitionPanelProps) {
  const router = useRouter();
  const [onHoldOpen, setOnHoldOpen] = useState(false);
  const [closedLostOpen, setClosedLostOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    transitionLeadStatusAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  if (!canTransitionLeads || isTerminalLeadStage(currentStatus)) {
    return null;
  }

  const forwardOptions = getForwardTransitionOptions(currentStatus);
  const canPause = currentStatus !== "on_hold";
  const canResume = currentStatus === "on_hold" && resumeTargetStatus !== null;

  return (
    <section
      className="crm-surface p-3.5 sm:p-5"
      data-testid="lead-status-transition-panel"
    >
      <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
        Lifecycle
      </h2>

      {state.message && !state.success ? (
        <p className="mt-3 text-sm text-[var(--crm-danger)]" role="alert">
          {state.message}
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2 sm:mt-4">
        {canResume && resumeTargetStatus ? (
          <form action={formAction}>
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="newStatus" value={resumeTargetStatus} />
            <button
              type="submit"
              disabled={pending}
              className="crm-btn crm-btn-secondary min-h-11 disabled:opacity-60"
              data-testid="lead-resume-button"
            >
              Resume to {formatCrmCodeLabel(resumeTargetStatus)}
            </button>
          </form>
        ) : null}

        {forwardOptions.map((status) => (
          <form key={status} action={formAction}>
            <input type="hidden" name="leadId" value={leadId} />
            <input type="hidden" name="newStatus" value={status} />
            <button
              type="submit"
              disabled={pending}
              className="crm-btn crm-btn-secondary min-h-11 disabled:opacity-60"
              data-testid={`lead-status-transition-${status}`}
            >
              Move to {formatCrmCodeLabel(status)}
            </button>
          </form>
        ))}

        {canPause ? (
          <button
            type="button"
            onClick={() => setOnHoldOpen(true)}
            className="crm-btn crm-btn-secondary min-h-11"
            data-testid="lead-on-hold-button"
          >
            Place on hold
          </button>
        ) : null}

        {currentStatus !== "on_hold" ? (
          <button
            type="button"
            onClick={() => setClosedLostOpen(true)}
            className="crm-btn crm-btn-danger-outline min-h-11"
            data-testid="lead-closed-lost-button"
          >
            Mark closed lost
          </button>
        ) : null}
      </div>

      <LeadOnHoldDialog
        open={onHoldOpen}
        leadId={leadId}
        onClose={() => setOnHoldOpen(false)}
      />
      <LeadClosedLostDialog
        open={closedLostOpen}
        leadId={leadId}
        closureReasons={closureReasons}
        onClose={() => setClosedLostOpen(false)}
      />
    </section>
  );
}
