"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useRouter } from "next/navigation";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import {
  assignLeadAction,
  type LeadAssignmentActionState,
} from "../../server/crm-assignment-actions.ts";

const INITIAL_STATE: LeadAssignmentActionState = {
  success: false,
  message: "",
};

export type LeadAssignmentDialogMode = "assign" | "reassign" | "unassign";

interface LeadAssignmentDialogProps {
  readonly open: boolean;
  readonly mode: LeadAssignmentDialogMode;
  readonly leadId: string;
  readonly leadStatus: LeadStageCode;
  readonly currentAssigneeLabel: string;
  readonly currentAssigneeId: string | null;
  readonly expectedUpdatedAt: string;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
  readonly onClose: () => void;
}

function dialogTitle(mode: LeadAssignmentDialogMode): string {
  switch (mode) {
    case "assign":
      return "Assign lead";
    case "reassign":
      return "Reassign lead";
    case "unassign":
      return "Unassign lead";
  }
}

function dialogDescription(mode: LeadAssignmentDialogMode): string {
  switch (mode) {
    case "assign":
      return "Select an eligible sales executive and optionally add a short note.";
    case "reassign":
      return "Choose a new assignee and provide a reason for the reassignment.";
    case "unassign":
      return "This returns the lead to the new queue. Open follow-ups must be resolved first.";
  }
}

function reasonLabel(mode: LeadAssignmentDialogMode): string {
  return mode === "assign" ? "Reason (optional)" : "Reason (required)";
}

function reasonRequired(mode: LeadAssignmentDialogMode): boolean {
  return mode !== "assign";
}

export function LeadAssignmentDialog({
  open,
  mode,
  leadId,
  leadStatus,
  currentAssigneeLabel,
  currentAssigneeId,
  expectedUpdatedAt,
  assigneeDirectory,
  onClose,
}: LeadAssignmentDialogProps) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [state, formAction, pending] = useActionState(
    assignLeadAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousFocus = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pending) {
        event.preventDefault();
        onClose();
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [open, onClose, pending]);

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  if (!open) {
    return null;
  }

  const canUnassign = leadStatus === "assigned" && currentAssigneeId !== null;
  const showAssigneeSelect = mode !== "unassign";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close assignment dialog"
        onClick={() => {
          if (!pending) {
            onClose();
          }
        }}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="relative z-10 w-full max-w-lg rounded-lg border border-neutral-700 bg-neutral-900 p-5 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-neutral-50">
              {dialogTitle(mode)}
            </h2>
            <p id={descriptionId} className="mt-1 text-sm text-neutral-400">
              {dialogDescription(mode)}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-neutral-700 px-3 text-sm text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            onClick={onClose}
            disabled={pending}
          >
            Close
          </button>
        </div>

        <p className="mt-4 text-sm text-neutral-200">
          Current assignee: <span className="font-medium">{currentAssigneeLabel}</span>
        </p>

        {mode === "unassign" && !canUnassign ? (
          <p className="mt-4 rounded-md border border-amber-700/50 bg-amber-950/30 px-3 py-2 text-sm text-amber-100">
            Only leads in the assigned stage can be safely unassigned.
          </p>
        ) : null}

        <form action={formAction} className="mt-5 space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="intent" value={mode} />
          <input type="hidden" name="expectedUpdatedAt" value={expectedUpdatedAt} />
          <input
            type="hidden"
            name="expectedAssigneeId"
            value={currentAssigneeId ?? ""}
          />

          {showAssigneeSelect ? (
            <div>
              <label htmlFor={`${titleId}-assignee`} className="block text-sm font-medium text-neutral-300">
                Target assignee
              </label>
              {assigneeDirectory.length === 0 ? (
                <p className="mt-2 text-sm text-neutral-500">
                  No eligible sales executives are available.
                </p>
              ) : (
                <select
                  id={`${titleId}-assignee`}
                  name="targetAssigneeId"
                  required
                  disabled={pending}
                  defaultValue=""
                  className="mt-2 min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
                >
                  <option value="" disabled>
                    Select an assignee
                  </option>
                  {assigneeDirectory.map((entry) => (
                    <option key={entry.userId} value={entry.userId}>
                      {entry.displayName}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <input type="hidden" name="targetAssigneeId" value="" />
          )}

          <div>
            <label htmlFor={`${titleId}-reason`} className="block text-sm font-medium text-neutral-300">
              {reasonLabel(mode)}
            </label>
            <textarea
              id={`${titleId}-reason`}
              name="reason"
              rows={4}
              maxLength={500}
              required={reasonRequired(mode)}
              disabled={pending}
              className="mt-2 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              aria-describedby={`${titleId}-reason-help`}
            />
            <p id={`${titleId}-reason-help`} className="mt-1 text-xs text-neutral-500">
              {mode === "assign"
                ? "Optional note up to 500 characters."
                : "Provide 10 to 500 characters explaining this change."}
            </p>
          </div>

          {state.message && !state.success ? (
            <p
              role="alert"
              className="rounded-md border border-red-800/60 bg-red-950/40 px-3 py-2 text-sm text-red-100"
            >
              {state.message}
              {state.code === "ASSIGNMENT_CONFLICT"
                ? " Refresh the page and review the current assignment."
                : null}
            </p>
          ) : null}

          {pending ? (
            <p role="status" className="text-sm text-neutral-400">
              Saving assignment…
            </p>
          ) : null}

          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="submit"
              disabled={
                pending ||
                (mode === "unassign" && !canUnassign) ||
                (showAssigneeSelect && assigneeDirectory.length === 0)
              }
              className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {mode === "unassign" ? "Confirm unassignment" : "Save assignment"}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
