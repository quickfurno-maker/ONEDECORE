"use client";

import { useState } from "react";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import type {
  CrmAssigneeDirectoryEntry,
  CrmLeadDetailAssignmentPanel,
} from "../../contracts/lead-detail-dtos.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import {
  LeadAssignmentDialog,
  type LeadAssignmentDialogMode,
} from "./LeadAssignmentDialog.tsx";

interface LeadDetailAssignmentPanelProps {
  readonly assignment: CrmLeadDetailAssignmentPanel;
  readonly leadId: string;
  readonly leadStatus: LeadStageCode;
  readonly leadUpdatedAt: string;
  readonly canAssignLeads: boolean;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function canOfferUnassign(
  status: LeadStageCode,
  currentAssigneeId: string | null
): boolean {
  return status === "assigned" && currentAssigneeId !== null;
}

function canOfferReassign(
  status: LeadStageCode,
  currentAssigneeId: string | null
): boolean {
  if (currentAssigneeId === null) {
    return false;
  }
  return status !== "closed_won" && status !== "closed_lost";
}

function canOfferAssign(
  status: LeadStageCode,
  currentAssigneeId: string | null
): boolean {
  return status === "new" && currentAssigneeId === null;
}

export function LeadDetailAssignmentPanel({
  assignment,
  leadId,
  leadStatus,
  leadUpdatedAt,
  canAssignLeads,
  assigneeDirectory,
}: LeadDetailAssignmentPanelProps) {
  const [dialogMode, setDialogMode] = useState<LeadAssignmentDialogMode | null>(
    null
  );

  const showAssign = canAssignLeads && canOfferAssign(leadStatus, assignment.currentAssigneeId);
  const showReassign =
    canAssignLeads && canOfferReassign(leadStatus, assignment.currentAssigneeId);
  const showUnassign =
    canAssignLeads && canOfferUnassign(leadStatus, assignment.currentAssigneeId);

  return (
    <section className="crm-surface p-3.5 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
          Assignment
        </h2>
        {canAssignLeads ? (
          <div className="flex flex-wrap gap-2">
            {showAssign ? (
              <button
                type="button"
                onClick={() => setDialogMode("assign")}
                className="crm-btn crm-btn-secondary min-h-11"
              >
                Assign
              </button>
            ) : null}
            {showReassign ? (
              <button
                type="button"
                onClick={() => setDialogMode("reassign")}
                className="crm-btn crm-btn-secondary min-h-11"
              >
                Reassign
              </button>
            ) : null}
            {showUnassign ? (
              <button
                type="button"
                onClick={() => setDialogMode("unassign")}
                className="crm-btn crm-btn-secondary min-h-11"
              >
                Unassign
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-[var(--crm-text)]">
        Current assignee: {assignment.currentAssigneeLabel}
      </p>

      {assignment.history.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--crm-muted)]">No assignment history recorded.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {assignment.history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--crm-text)]">
                  {entry.previousAssigneeLabel ?? "Unassigned"} →{" "}
                  {entry.newAssigneeLabel ?? "Unassigned"}
                </span>
                <span className="text-xs text-[var(--crm-muted)]">
                  {formatTimestamp(entry.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-[var(--crm-muted)]">
                {formatCrmCodeLabel(entry.assignmentMethod)} · {entry.actorLabel}
              </p>
              {entry.reason ? (
                <p className="mt-1 break-words text-[var(--crm-text-secondary)]">{entry.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}

      {dialogMode ? (
        <LeadAssignmentDialog
          open
          mode={dialogMode}
          leadId={leadId}
          leadStatus={leadStatus}
          currentAssigneeLabel={assignment.currentAssigneeLabel}
          currentAssigneeId={assignment.currentAssigneeId}
          expectedUpdatedAt={leadUpdatedAt}
          assigneeDirectory={assigneeDirectory}
          onClose={() => setDialogMode(null)}
        />
      ) : null}
    </section>
  );
}
