"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import {
  cancelLeadFollowUpAction,
  completeLeadFollowUpAction,
} from "../../server/crm-lifecycle-actions.ts";

const COMPLETE_INITIAL: LifecycleActionState = {
  success: false,
  message: "",
};

const CANCEL_INITIAL: LifecycleActionState = {
  success: false,
  message: "",
};

interface LeadFollowUpActionsProps {
  readonly leadId: string;
  readonly followUpId: string;
  readonly canManageLeadFollowUps: boolean;
}

export function LeadFollowUpActions({
  leadId,
  followUpId,
  canManageLeadFollowUps,
}: LeadFollowUpActionsProps) {
  const router = useRouter();
  const [completeState, completeAction, completePending] = useActionState(
    completeLeadFollowUpAction,
    COMPLETE_INITIAL
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelLeadFollowUpAction,
    CANCEL_INITIAL
  );

  useEffect(() => {
    if (completeState.success || cancelState.success) {
      router.refresh();
    }
  }, [completeState.success, cancelState.success, router]);

  if (!canManageLeadFollowUps) {
    return null;
  }

  return (
    <div className="mt-3 flex flex-wrap gap-2" data-testid="lead-follow-up-actions">
      <form action={completeAction} className="inline-flex">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="followUpId" value={followUpId} />
        <button
          type="submit"
          disabled={completePending || cancelPending}
          className="inline-flex min-h-9 items-center rounded-md border border-[var(--crm-border-strong)] px-3 py-1 text-xs font-medium text-[var(--crm-text)] disabled:opacity-60"
          data-testid="lead-follow-up-complete"
        >
          {completePending ? "Completing…" : "Complete"}
        </button>
      </form>

      <form action={cancelAction} className="inline-flex">
        <input type="hidden" name="leadId" value={leadId} />
        <input type="hidden" name="followUpId" value={followUpId} />
        <button
          type="submit"
          disabled={completePending || cancelPending}
          className="inline-flex min-h-9 items-center rounded-md border border-[var(--crm-border-strong)] px-3 py-1 text-xs font-medium text-[var(--crm-text-secondary)] disabled:opacity-60"
          data-testid="lead-follow-up-cancel"
        >
          {cancelPending ? "Cancelling…" : "Cancel"}
        </button>
      </form>

      {completeState.message && !completeState.success ? (
        <p className="w-full text-xs text-red-300" role="alert">
          {completeState.message}
        </p>
      ) : null}
      {cancelState.message && !cancelState.success ? (
        <p className="w-full text-xs text-red-300" role="alert">
          {cancelState.message}
        </p>
      ) : null}
    </div>
  );
}
