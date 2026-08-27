"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import { transitionLeadStatusAction } from "../../server/crm-lifecycle-actions.ts";

const INITIAL_STATE: LifecycleActionState = {
  success: false,
  message: "",
};

interface LeadOnHoldDialogProps {
  readonly open: boolean;
  readonly leadId: string;
  readonly onClose: () => void;
}

export function LeadOnHoldDialog({ open, leadId, onClose }: LeadOnHoldDialogProps) {
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
        className="w-full max-w-lg rounded-lg border border-[var(--crm-border-strong)] bg-[var(--crm-surface)] p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        data-testid="lead-on-hold-dialog"
      >
        <h3 id={titleId} className="text-lg font-semibold text-[var(--crm-text)]">
          Place lead on hold
        </h3>
        <p className="mt-2 text-sm text-[var(--crm-muted)]">
          Provide a short reason. The current stage will be saved for resume.
        </p>

        <form action={formAction} className="mt-4 space-y-4">
          <input type="hidden" name="leadId" value={leadId} />
          <input type="hidden" name="newStatus" value="on_hold" />

          <div>
            <label htmlFor="on-hold-reason" className="text-sm text-[var(--crm-text-secondary)]">
              Reason
            </label>
            <textarea
              id="on-hold-reason"
              name="reason"
              required
              minLength={3}
              maxLength={500}
              rows={4}
              className="mt-1 w-full rounded-md border border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm text-[var(--crm-text)]"
              data-testid="lead-on-hold-reason"
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
              className="inline-flex min-h-11 items-center rounded-md border border-[var(--crm-border-strong)] px-4 py-2 text-sm text-[var(--crm-text)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-md bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              data-testid="lead-on-hold-submit"
            >
              {pending ? "Saving…" : "Confirm on hold"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
