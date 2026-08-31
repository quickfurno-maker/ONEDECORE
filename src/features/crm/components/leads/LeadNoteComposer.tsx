"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import { addLeadNoteAction } from "../../server/crm-lifecycle-actions.ts";
import { useLeadActions } from "./LeadActionsProvider.tsx";

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
  const actions = useLeadActions();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [state, formAction, pending] = useActionState(addLeadNoteAction, INITIAL_STATE);

  useEffect(() => {
    if (state.success) {
      router.refresh();
    }
  }, [state.success, router]);

  // Quick action "Add note": scroll the composer into view and focus it. The
  // mutation path is unchanged — this only moves the caret. Keyed on the nonce
  // so a repeat click re-fires; the effect sets no state.
  const intentKind = actions?.intent?.kind ?? null;
  const intentNonce = actions?.nonce ?? 0;

  useEffect(() => {
    if (intentNonce === 0 || intentKind !== "add-note") {
      return;
    }
    textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    textareaRef.current?.focus();
  }, [intentKind, intentNonce]);

  return (
    <form
      action={formAction}
      className="mt-4 space-y-3"
      data-testid="lead-note-composer"
    >
      <input type="hidden" name="leadId" value={leadId} />
      <div>
        <label htmlFor="lead-note-body" className="text-sm text-[var(--crm-text-secondary)]">
          Add note
        </label>
        <textarea
          ref={textareaRef}
          id="lead-note-body"
          name="body"
          rows={4}
          maxLength={NOTE_MAX}
          required
          className="mt-1 w-full rounded-md border border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm text-[var(--crm-text)]"
          data-testid="lead-note-body"
        />
        <p className="mt-1 text-xs text-[var(--crm-muted)]">Max {NOTE_MAX} characters</p>
      </div>

      {state.message && !state.success ? (
        <p className="text-sm text-red-300" role="alert">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-[var(--crm-primary)] px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        data-testid="lead-note-submit"
      >
        {pending ? "Saving…" : "Add note"}
      </button>
    </form>
  );
}
