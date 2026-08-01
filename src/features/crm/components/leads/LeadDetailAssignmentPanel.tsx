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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Assignment
        </h2>
        {canAssignLeads ? (
          <div className="flex flex-wrap gap-2">
            {showAssign ? (
              <button
                type="button"
                onClick={() => setDialogMode("assign")}
                className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Assign
              </button>
            ) : null}
            {showReassign ? (
              <button
                type="button"
                onClick={() => setDialogMode("reassign")}
                className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Reassign
              </button>
            ) : null}
            {showUnassign ? (
              <button
                type="button"
                onClick={() => setDialogMode("unassign")}
                className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-3 py-2 text-sm font-medium text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                Unassign
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-neutral-100">
        Current assignee: {assignment.currentAssigneeLabel}
      </p>

      {assignment.history.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No assignment history recorded.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {assignment.history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-neutral-200">
                  {entry.previousAssigneeLabel ?? "Unassigned"} →{" "}
                  {entry.newAssigneeLabel ?? "Unassigned"}
                </span>
                <span className="text-xs text-neutral-500">
                  {formatTimestamp(entry.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-neutral-400">
                {formatCrmCodeLabel(entry.assignmentMethod)} · {entry.actorLabel}
              </p>
              {entry.reason ? (
                <p className="mt-1 break-words text-neutral-300">{entry.reason}</p>
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
