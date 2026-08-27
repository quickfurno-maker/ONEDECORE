"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import { defaultFutureDatetimeLocalValue } from "../../lib/local-datetime-to-iso.ts";
import { createLeadFollowUpAction } from "../../server/crm-lifecycle-actions.ts";
import { CrmDateTimeField } from "../ui/CrmDateTimeField.tsx";

const INITIAL_STATE: LifecycleActionState = {
  success: false,
  message: "",
};

interface LeadFollowUpComposerProps {
  readonly leadId: string;
  readonly canChooseOwner: boolean;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
}

export function LeadFollowUpComposer({
  leadId,
  canChooseOwner,
  assigneeDirectory,
}: LeadFollowUpComposerProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    createLeadFollowUpAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3 rounded-[14px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3.5"
      data-testid="lead-follow-up-composer"
    >
      <input type="hidden" name="leadId" value={leadId} />

      <CrmDateTimeField
        id="follow-up-due-at"
        name="dueAt"
        label="Due date and time"
        required
        defaultValue={defaultFutureDatetimeLocalValue()}
        data-testid="lead-follow-up-due-at"
      />

      {canChooseOwner ? (
        <div>
          <label htmlFor="follow-up-owner" className="text-sm text-[var(--crm-text-secondary)]">
            Owner
          </label>
          <select
            id="follow-up-owner"
            name="ownerId"
            defaultValue="self"
            className="crm-input mt-1 w-full text-base sm:text-sm"
            data-testid="lead-follow-up-owner"
          >
            <option value="self">Assign to me</option>
            {assigneeDirectory.map((entry) => (
              <option key={entry.userId} value={entry.userId}>
                {entry.displayName}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {state.message && !state.success ? (
        <p className="text-sm text-[var(--crm-danger)]" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="crm-btn crm-btn-primary min-h-11 disabled:opacity-60"
        data-testid="lead-follow-up-submit"
      >
        {pending ? "Scheduling…" : "Schedule follow-up"}
      </button>
    </form>
  );
}
