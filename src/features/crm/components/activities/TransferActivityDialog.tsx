"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import { INITIAL_CRM_ACTIVITY_ACTION_STATE } from "../../contracts/activity-contracts.ts";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import { transferActivityOwnershipAction } from "../../server/crm-activity-actions.ts";
import { CrmActivityDialogShell } from "./CrmActivityDialogShell.tsx";
import { inputClassName } from "./activity-ui-utils.ts";

interface TransferActivityDialogProps {
  readonly open: boolean;
  readonly activityId: string | null;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
  readonly onClose: () => void;
}

export function TransferActivityDialog({
  open,
  activityId,
  assigneeDirectory,
  onClose,
}: TransferActivityDialogProps) {
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    transferActivityOwnershipAction,
    INITIAL_CRM_ACTIVITY_ACTION_STATE
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  if (!activityId) {
    return null;
  }

  const fieldErrors = state.fieldErrors ?? {};

  return (
    <CrmActivityDialogShell
      open={open}
      title="Transfer activity owner"
      titleId={titleId}
      description="Primary next-action ownership follows lead assignment."
      onClose={onClose}
      testId="crm-transfer-activity-dialog"
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="activityId" value={activityId} />

        <div>
          <label htmlFor={`${titleId}-owner`} className="text-sm text-neutral-300">
            New owner
          </label>
          <select
            id={`${titleId}-owner`}
            name="newOwnerId"
            required
            className={inputClassName(Boolean(fieldErrors.newOwnerId))}
            data-testid="crm-transfer-owner"
          >
            <option value="">Select owner</option>
            {assigneeDirectory.map((entry) => (
              <option key={entry.userId} value={entry.userId}>
                {entry.displayName}
              </option>
            ))}
          </select>
          {fieldErrors.newOwnerId ? (
            <p className="mt-1 text-xs text-red-300" role="alert">
              {fieldErrors.newOwnerId}
            </p>
          ) : null}
        </div>

        {state.message && !state.success ? (
          <p className="text-sm text-red-300" role="alert">
            {state.message}
          </p>
        ) : null}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-[var(--od-gold)] px-4 py-2 text-sm font-semibold text-neutral-950 disabled:opacity-60"
            data-testid="crm-transfer-submit"
          >
            {pending ? "Transferring…" : "Transfer owner"}
          </button>
        </div>
      </form>
    </CrmActivityDialogShell>
  );
}
