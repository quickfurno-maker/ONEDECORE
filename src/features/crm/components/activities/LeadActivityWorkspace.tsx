"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  CrmActivityOutcomeOption,
  CrmActivityType,
} from "../../contracts/activity-contracts.ts";
import { useLeadActions } from "../leads/LeadActionsProvider.tsx";
import type {
  CrmAssigneeDirectoryEntry,
  CrmLeadClosureReasonOption,
  CrmLeadDetailFollowUp,
} from "../../contracts/lead-detail-dtos.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import { isTerminalLeadStage } from "../../contracts/lead-stages.ts";
import type { CrmWhatsappSendIntentOption } from "../../server/crm-whatsapp-evidence-queries.ts";
import { CompleteActivityDialog } from "./CompleteActivityDialog.tsx";
import { CreateActivityForm } from "./CreateActivityForm.tsx";
import { NoNextActionBanner } from "./NoNextActionBanner.tsx";
import { ActivityHistoryList, OpenActivityRow } from "./OpenActivityRow.tsx";
import { PrimaryNextActionCard } from "./PrimaryNextActionCard.tsx";
import { RescheduleActivityDialog } from "./RescheduleActivityDialog.tsx";
import { TransferActivityDialog } from "./TransferActivityDialog.tsx";

interface LeadActivityWorkspaceProps {
  readonly leadId: string;
  readonly leadStatus: LeadStageCode;
  readonly isAssigned: boolean;
  readonly followUps: readonly CrmLeadDetailFollowUp[];
  readonly canManageLeadFollowUps: boolean;
  readonly canChooseFollowUpOwner: boolean;
  readonly showComposer: boolean;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
  readonly outcomeOptions: readonly CrmActivityOutcomeOption[];
  readonly closureReasons: readonly CrmLeadClosureReasonOption[];
  readonly whatsappSendIntents: readonly CrmWhatsappSendIntentOption[];
  readonly quotationId: string | null;
  readonly quotationLabel: string | null;
  /** Enrollment id when the lead has an ACTIVE cadence, else null. */
  readonly activeCadenceEnrollmentId?: string | null;
  /** True when that cadence still has a further step to materialize. */
  readonly hasNextCadenceStep?: boolean;
}

type DialogTarget = CrmLeadDetailFollowUp | null;

export function LeadActivityWorkspace({
  leadId,
  leadStatus,
  isAssigned,
  followUps,
  canManageLeadFollowUps,
  canChooseFollowUpOwner,
  showComposer,
  assigneeDirectory,
  outcomeOptions,
  closureReasons,
  whatsappSendIntents,
  quotationId,
  quotationLabel,
  activeCadenceEnrollmentId = null,
  hasNextCadenceStep = false,
}: LeadActivityWorkspaceProps) {
  const createFormRef = useRef<HTMLFormElement>(null);
  const [completeTarget, setCompleteTarget] = useState<DialogTarget>(null);
  const [rescheduleTarget, setRescheduleTarget] = useState<DialogTarget>(null);
  const [transferTargetId, setTransferTargetId] = useState<string | null>(null);

  const openActivities = useMemo(
    () => followUps.filter((entry) => entry.status === "open"),
    [followUps]
  );
  const primaryActivity = openActivities.find((entry) => entry.isPrimaryNextAction) ?? null;
  const secondaryActivities = openActivities.filter(
    (entry) => !entry.isPrimaryNextAction
  );
  const historyActivities = useMemo(
    () => followUps.filter((entry) => entry.status !== "open"),
    [followUps]
  );

  const isTerminal = isTerminalLeadStage(leadStatus);
  const showNoNextAction =
    !primaryActivity &&
    !isTerminal &&
    isAssigned &&
    leadStatus !== "on_hold" &&
    canManageLeadFollowUps;

  const scrollToCreateForm = () => {
    createFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    const titleInput = createFormRef.current?.querySelector<HTMLInputElement>(
      '[data-testid="crm-create-activity-title"]'
    );
    titleInput?.focus();
  };

  /* ---------------------------------------------------------------------- */
  /* CRM 2D quick-action intents                                             */
  /*                                                                        */
  /* The header dispatches; this workspace reacts by driving the dialogs and */
  /* form it already owns. No mutation path is duplicated or bypassed.       */
  /*                                                                        */
  /* State is adjusted during render on the nonce change (React's prop-change */
  /* pattern, as used by CrmPipelineBoard) so no cascading render is queued.  */
  /* The effect below performs the DOM scroll only and sets no state.         */
  /* ---------------------------------------------------------------------- */
  const actions = useLeadActions();
  const [requestedType, setRequestedType] = useState<CrmActivityType | null>(null);
  const [requestNonce, setRequestNonce] = useState(0);
  const [scrollNonce, setScrollNonce] = useState(0);

  const intent = actions?.intent ?? null;
  const intentNonce = actions?.nonce ?? 0;
  const [lastIntentNonce, setLastIntentNonce] = useState(intentNonce);

  if (lastIntentNonce !== intentNonce) {
    setLastIntentNonce(intentNonce);

    if (intent?.kind === "complete-primary") {
      if (primaryActivity && canManageLeadFollowUps) {
        setCompleteTarget(primaryActivity);
      }
    } else if (intent?.kind === "create-activity") {
      if (canManageLeadFollowUps && showComposer) {
        if (intent.activityType) {
          setRequestedType(intent.activityType);
          setRequestNonce((current) => current + 1);
        }
        setScrollNonce((current) => current + 1);
      }
    }
  }

  useEffect(() => {
    if (scrollNonce > 0) {
      scrollToCreateForm();
    }
  }, [scrollNonce]);

  return (
    <div className="space-y-6" data-testid="crm-activity-workspace">
      {primaryActivity ? (
        <PrimaryNextActionCard
          activity={primaryActivity}
          canManage={canManageLeadFollowUps}
          onComplete={() => setCompleteTarget(primaryActivity)}
          onReschedule={() => setRescheduleTarget(primaryActivity)}
        />
      ) : null}

      {showNoNextAction ? (
        <NoNextActionBanner
          canManage={canManageLeadFollowUps}
          onCreateClick={scrollToCreateForm}
        />
      ) : null}

      <section className="crm-surface p-5">
        <h2 className="text-sm font-semibold text-[var(--crm-text)]">
          Activities
        </h2>

        {canManageLeadFollowUps && showComposer ? (
          <div className="mt-4">
            <h3 className="mb-2 text-[12px] font-medium text-[var(--crm-muted)]">
              Create activity
            </h3>
            <CreateActivityForm
              leadId={leadId}
              canChooseOwner={canChooseFollowUpOwner}
              assigneeDirectory={assigneeDirectory}
              quotationId={quotationId}
              quotationLabel={quotationLabel}
              formRef={createFormRef}
              defaultPrimary={showNoNextAction}
              requestedType={requestedType}
              requestNonce={requestNonce}
            />
          </div>
        ) : null}

        {secondaryActivities.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-[12px] font-semibold text-[var(--crm-muted)]">
              Other open activities
            </h3>
            <ul className="mt-3 space-y-3">
              {secondaryActivities.map((activity) => (
                <OpenActivityRow
                  key={activity.id}
                  activity={activity}
                  canManage={canManageLeadFollowUps}
                  canTransfer={canChooseFollowUpOwner}
                  showDesignatePrimary={!isTerminal && leadStatus !== "on_hold"}
                  onComplete={() => setCompleteTarget(activity)}
                  onReschedule={() => setRescheduleTarget(activity)}
                  onTransfer={() => setTransferTargetId(activity.id)}
                />
              ))}
            </ul>
          </div>
        ) : null}

        {openActivities.length === 0 && historyActivities.length === 0 ? (
          <p className="mt-4 text-sm text-[var(--crm-muted)]">No activities yet.</p>
        ) : null}

        <ActivityHistoryList activities={historyActivities} />
      </section>

      <CompleteActivityDialog
        open={completeTarget !== null}
        activity={completeTarget}
        leadId={leadId}
        leadStatus={leadStatus}
        hasOtherOpenPrimary={Boolean(
          primaryActivity &&
            completeTarget &&
            completeTarget.id !== primaryActivity.id
        )}
        outcomeOptions={outcomeOptions}
        closureReasons={closureReasons}
        whatsappSendIntents={whatsappSendIntents}
        quotationId={quotationId}
        quotationLabel={quotationLabel}
        canContinueCadence={
          hasNextCadenceStep &&
          activeCadenceEnrollmentId != null &&
          completeTarget?.cadenceEnrollmentId === activeCadenceEnrollmentId
        }
        onClose={() => setCompleteTarget(null)}
      />

      <RescheduleActivityDialog
        open={rescheduleTarget !== null}
        activity={rescheduleTarget}
        onClose={() => setRescheduleTarget(null)}
      />

      <TransferActivityDialog
        open={transferTargetId !== null}
        activityId={transferTargetId}
        assigneeDirectory={assigneeDirectory}
        onClose={() => setTransferTargetId(null)}
      />
    </div>
  );
}
