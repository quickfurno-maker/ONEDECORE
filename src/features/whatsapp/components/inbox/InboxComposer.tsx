"use client";

import { useActionState, useEffect, useMemo, useRef } from "react";
import type { WhatsappSendActionState } from "../../contracts/send-action-state.ts";
import {
  createWhatsappServiceSendIntentAction,
  INITIAL_WHATSAPP_SEND_ACTION_STATE,
} from "../../server/whatsapp-send-actions.ts";

interface InboxComposerProps {
  readonly conversationId: string;
  readonly canUse: boolean;
}

export function InboxComposer({ conversationId, canUse }: InboxComposerProps) {
  const idempotencyKey = useMemo(() => crypto.randomUUID(), []);
  const [state, formAction, pending] = useActionState(
    createWhatsappServiceSendIntentAction,
    INITIAL_WHATSAPP_SEND_ACTION_STATE
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (state.success) {
      textareaRef.current?.form?.reset();
    }
  }, [state.success]);

  if (!canUse) {
    return (
      <section
        aria-label="Composer"
        className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-4 py-4 text-sm text-neutral-400"
      >
        You can view this conversation but do not have send permission for your
        current assignment scope.
      </section>
    );
  }

  return (
    <section
      aria-label="Composer"
      className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4"
    >
      <form action={formAction} className="space-y-3">
        <input type="hidden" name="conversationId" value={conversationId} />
        <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
        <label className="block text-sm text-neutral-300">
          <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
            WHATSAPP_SERVICE reply (text only)
          </span>
          <textarea
            ref={textareaRef}
            name="bodyText"
            required
            rows={4}
            maxLength={4096}
            disabled={pending}
            placeholder="Type a service message…"
            className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 disabled:opacity-60"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-neutral-500">
            Records a WHATSAPP_SERVICE send intent and, when outbound dispatch is
            enabled for this environment, binds provider evidence without
            fabricating delivery or read status.
          </p>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center justify-center rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950 disabled:cursor-not-allowed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-300"
          >
            {pending ? "Sending…" : "Send service message"}
          </button>
        </div>
        <ComposerFeedback state={state} />
      </form>
    </section>
  );
}

function ComposerFeedback({ state }: { state: WhatsappSendActionState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      role={state.success ? "status" : "alert"}
      className={`text-sm ${state.success ? "text-emerald-300" : "text-amber-300"}`}
    >
      {state.message}
    </p>
  );
}
