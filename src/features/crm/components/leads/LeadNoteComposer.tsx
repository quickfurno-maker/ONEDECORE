"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import { addLeadNoteAction } from "../../server/crm-lifecycle-actions.ts";

const INITIAL_STATE: LifecycleActionState = {
  success: false,
  message: "",
};

const NOTE_MAX = 4000;

interface LeadNoteComposerProps {
  readonly leadId: string;
}

export function LeadNoteComposer({ leadId }: LeadNoteComposerProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(addLeadNoteAction, INITIAL_STATE);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3"
      data-testid="lead-note-composer"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <div>
        <label htmlFor="lead-note-body" className="text-sm text-neutral-300">
          Add note
        </label>
        <textarea
          id="lead-note-body"
          name="body"
          rows={4}
          maxLength={NOTE_MAX}
          required
          className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
          data-testid="lead-note-body"
        />
        <p className="mt-1 text-xs text-neutral-500">Max {NOTE_MAX} characters</p>
      </div>

      {state.message && !state.success ? (
        <p className="text-sm text-red-300" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 disabled:opacity-60"
        data-testid="lead-note-submit"
      >
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
