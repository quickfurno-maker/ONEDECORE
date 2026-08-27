"use client";

import { useMemo, useRef, useState } from "react";
import type { CrmActivityOutcomeOption } from "../../contracts/activity-contracts.ts";
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

      <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Activities
        </h2>

        {canManageLeadFollowUps && showComposer ? (
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-neutral-500">
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
            />
          </div>
        ) : null}

        {secondaryActivities.length > 0 ? (
          <div className="mt-6">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
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
          <p className="mt-4 text-sm text-neutral-500">No activities yet.</p>
        ) : null}

        <ActivityHistoryList activities={historyActivities} />
      </section>

      <CompleteActivityDialog
        open={completeTarget !== null}
        activity={completeTarget}
        leadId={leadId}
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
