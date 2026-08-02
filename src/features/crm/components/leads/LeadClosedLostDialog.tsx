"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import type { CrmLeadClosureReasonOption } from "../../contracts/lead-detail-dtos.ts";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import { transitionLeadStatusAction } from "../../server/crm-lifecycle-actions.ts";

const INITIAL_STATE: LifecycleActionState = {
  success: false,
  message: "",
};

interface LeadClosedLostDialogProps {
  readonly open: boolean;
  readonly leadId: string;
  readonly closureReasons: readonly CrmLeadClosureReasonOption[];
  readonly onClose: () => void;
}

export function LeadClosedLostDialog({
  open,
  leadId,
  closureReasons,
  onClose,
}: LeadClosedLostDialogProps) {
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(
    transitionLeadStatusAction,
    INITIAL_STATE
  );

  useEffect(() => {
    if (state.success) {
      router.refresh();
      onClose();
    }
  }, [state.success, router, onClose]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-lg border border-red-900/60 bg-neutral-900 p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        data-testid="lead-closed-lost-dialog"
      >
        <h3 id={titleId} className="text-lg font-semibold text-red-200">
          Mark lead as closed lost
        </h3>
        <p className="mt-2 text-sm text-neutral-400">
          This is a terminal action. The lead cannot be reopened in this phase.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="newStatus" value="closed_lost" />

          <div>
            <label htmlFor="closure-reason" className="text-sm text-neutral-300">
              Closure reason
            </label>
            <select
              id="closure-reason"
              name="closureReasonCode"
              required
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              data-testid="lead-closed-lost-reason"
            >
              <option value="">Select a reason</option>
              {closureReasons.map((reason) => (
                <option key={reason.code} value={reason.code}>
                  {reason.displayName}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="closure-note" className="text-sm text-neutral-300">
              Closure note
            </label>
            <textarea
              id="closure-note"
              name="reason"
              required
              minLength={3}
              maxLength={1000}
              rows={4}
              className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
              data-testid="lead-closed-lost-note"
            />
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
              className="inline-flex min-h-11 items-center rounded-md bg-red-700 px-4 py-2 text-sm font-medium text-neutral-100 disabled:opacity-60"
              data-testid="lead-closed-lost-submit"
            >
              {pending ? "Saving…" : "Confirm closed lost"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
