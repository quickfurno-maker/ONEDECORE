"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import { createLeadFollowUpAction } from "../../server/crm-lifecycle-actions.ts";

const INITIAL_STATE: LifecycleActionState = {
  success: false,
  message: "",
};

interface LeadFollowUpComposerProps {
  readonly leadId: string;
  readonly canChooseOwner: boolean;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
}

function defaultDueAtLocalValue(): string {
  const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
      className="mt-4 space-y-3 rounded-md border border-neutral-800 bg-neutral-950/40 p-4"
      data-testid="lead-follow-up-composer"
    >
      <input type="hidden" name="leadId" value={leadId} />

      <div>
        <label htmlFor="follow-up-due-at" className="text-sm text-neutral-300">
          Due date and time
        </label>
        <input
          id="follow-up-due-at"
          name="dueAt"
          type="datetime-local"
          required
          defaultValue={defaultDueAtLocalValue()}
          className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          data-testid="lead-follow-up-due-at"
        />
      </div>

      {canChooseOwner ? (
        <div>
          <label htmlFor="follow-up-owner" className="text-sm text-neutral-300">
            Owner
          </label>
          <select
            id="follow-up-owner"
            name="ownerId"
            defaultValue="self"
            className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
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
        <p className="text-sm text-red-300" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-60"
        data-testid="lead-follow-up-submit"
      >
        {pending ? "Scheduling…" : "Schedule follow-up"}
      </button>
    </form>
  );
}
