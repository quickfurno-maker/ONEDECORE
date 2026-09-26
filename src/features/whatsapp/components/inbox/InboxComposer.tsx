"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { INITIAL_WHATSAPP_SEND_ACTION_STATE } from "../../contracts/send-action-state.ts";
import { createWhatsappServiceSendIntentAction } from "../../server/whatsapp-send-actions.ts";
import type { ServiceWindowView } from "../../contracts/message-presentation.ts";
import type { SendingStatusView } from "../../contracts/sending-status.ts";


/**
 * The message composer.
 *
 * THE SEND PATH IS UNCHANGED, AND THAT IS THE POINT.
 *
 * `<form action={createWhatsappServiceSendIntentAction}>` still posts
 * `conversationId`, `idempotencyKey` and `bodyText`, which reaches
 * `create_whatsapp_service_send_intent` and then `dispatchWhatsappSendIntent`.
 * Nothing here talks to Meta, and the permission re-checks on the server are
 * untouched: this component's `canUse` only decides what to draw.
 *
 * A BUG FIXED ON THE WAY.
 *
 * The idempotency key was `useMemo(() => crypto.randomUUID(), [])` — one value
 * for the lifetime of the mount. The first message sent fine; the second
 * reused the same key against a different body, which the RPC treats as a
 * conflicting replay. In a three-pane inbox the composer stays mounted while
 * staff work through a conversation, so this went from rare to the normal
 * case. The key is now minted per send and rotated after each accepted one.
 *
 * WHY THE TEXTAREA IS UNCONTROLLED.
 *
 * Kriti inserts a draft by assigning `textarea.value` and dispatching a native
 * `input` event (`kriti-inbox-integration.ts`). React does not observe native
 * events for value tracking, so a controlled textarea would discard the draft
 * on the next render. Length is read from the DOM on input instead of mirrored
 * into state.
 */

interface InboxComposerProps {
  readonly conversationId: string;
  readonly canUse: boolean;
  readonly textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
  /** Advisory reply-window state, shown as a hint rather than a gate. */
  readonly serviceWindow?: ServiceWindowView | null;
  /** Explains a disabled composer in the reader's terms. */
  readonly unavailableReason?: string | null;
  /**
   * How this deployment sends. A type-only import: the value is computed on
   * the server and arrives as three known words, never an account identifier.
   */
  readonly sending?: SendingStatusView | null;
  readonly replyToMessageId?: string | null;
  readonly onAcceptedSend?: () => void;
}

const MAX_BODY = 4096;

export function InboxComposer({
  conversationId,
  canUse,
  textareaRef: externalTextareaRef,
  serviceWindow = null,
  unavailableReason = null,
  sending = null,
  replyToMessageId = null,
  onAcceptedSend,
}: InboxComposerProps) {
  const [state, formAction, pending] = useActionState(
    createWhatsappServiceSendIntentAction,
    INITIAL_WHATSAPP_SEND_ACTION_STATE
  );
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const textareaRef = externalTextareaRef ?? internalTextareaRef;

  useEffect(() => {
    if (state.success) {
      onAcceptedSend?.();
    }
  }, [state.success, state.intentId, onAcceptedSend]);

  /*
   * The idempotency key is stamped on at submit, not rendered.
   *
   * A hidden input would have to be filled during render, and
   * `crypto.randomUUID()` during render produces one value on the server and a
   * different one at hydration. Doing it here gives a fresh key per send with
   * neither problem — and "fresh per send" is the actual requirement, since
   * reusing one is what made the second message of a session collide with the
   * first.
   */
  const submit = (formData: FormData) => {
    formData.set("idempotencyKey", crypto.randomUUID());
    return formAction(formData);
  };

  if (!canUse) {
    return (
      <div className="od-wa__composer">
        <p className="od-wa__notice" role="status">
          {unavailableReason ??
            "You can read this conversation but cannot reply to it. Replies are limited to the executive this lead is assigned to, and to managers."}
        </p>
      </div>
    );
  }

  return (
    <div className="od-wa__composer">
      {state.message ? (
        <p
          className={state.success ? "od-wa__ok" : "od-wa__error"}
          role={state.success ? "status" : "alert"}
          style={{ marginBlockEnd: 8 }}
        >
          {state.message}
        </p>
      ) : null}

      {serviceWindow && !serviceWindow.open ? (
        <p className="od-wa__notice" role="status" style={{ marginBlockEnd: 8 }}>
          {serviceWindow.detail}
        </p>
      ) : null}

      {/*
        Said again, right above the button.

        The banner at the top of the workspace scrolls out of mind; this is
        where someone is about to press Send believing the customer will read
        it. A closed 24-hour service window disables free-form text entirely;
        the separate approved Utility-template form remains available above.
      */}
      {sending && !sending.reaches ? (
        <p className="od-wa__notice" role="status" style={{ marginBlockEnd: 8 }}>
          {sending.detail}
        </p>
      ) : null}

      <form action={submit} aria-label="Send a WhatsApp message">
        <input type="hidden" name="conversationId" value={conversationId} />

        {/*
          Remounted per accepted send, keyed on the intent the server created.

          That is what clears the box: no effect calls setState after a
          successful send, so there is no cascading render on every message.
          `intentId` changes only when the server actually accepted something,
          so a refused send keeps the text the author has not managed to send
          yet.
        */}
        <ComposerField
          key={state.intentId ?? "compose"}
          textareaRef={textareaRef}
          pending={pending}
          serviceWindow={serviceWindow}
          replyToMessageId={replyToMessageId}
        />

        {/*
          The status this inbox can and cannot tell you.

          WhatsApp reports back when a message is handed to the phone and when
          it is opened, and those ticks appear on the message once the provider
          says so. Until then the only truthful statement is that ONEDECORE has
          accepted the message for sending — which is why nothing here reports
          success as arrival. Keeping the two apart is what stops the inbox
          fabricating delivery or read status.
        */}
      </form>
    </div>
  );
}

/**
 * The textarea, the counter and the send button.
 *
 * Owns the only piece of state the composer needs — how long the draft is —
 * and is thrown away and rebuilt when a send is accepted. That is why the
 * parent has no reset effect.
 *
 * The textarea stays UNCONTROLLED: Kriti inserts a draft by assigning
 * `textarea.value` and dispatching a native `input` event, which React's
 * synthetic system does not observe for value tracking. A controlled value
 * would be restored on the next render and the inserted draft would vanish.
 */
function ComposerField({
  textareaRef,
  pending,
  serviceWindow,
  replyToMessageId,
}: {
  readonly textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  readonly pending: boolean;
  readonly serviceWindow: ServiceWindowView | null;
  readonly replyToMessageId: string | null;
}) {
  const [length, setLength] = useState(0);
  const over = length > MAX_BODY;
  const freeFormBlocked = serviceWindow != null && !serviceWindow.open;

  function resize() {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.min(node.scrollHeight, 168)}px`;
    setLength(node.value.length);
  }

  return (
    <>
      {replyToMessageId ? (
        <input
          type="hidden"
          name="replyToMessageId"
          value={replyToMessageId}
        />
      ) : null}
      <div className="od-wa__composer-row">
        <label className="sr-only" htmlFor="od-wa-body">
          Message
        </label>
        <textarea
          id="od-wa-body"
          ref={textareaRef}
          name="bodyText"
          className="od-wa__textarea"
          rows={1}
          required
          maxLength={MAX_BODY}
          placeholder={freeFormBlocked ? "Use an approved Utility template above" : "Type a message…"}
          disabled={pending || freeFormBlocked}
          onInput={resize}
          onKeyDown={(event) => {
            /*
             * Enter sends, Shift+Enter is a new line — the convention every
             * messaging tool shares, and the one staff will try first.
             * `isComposing` guards IME input, where Enter commits a candidate
             * word and must not also send the message.
             */
            if (event.key !== "Enter" || event.shiftKey || event.nativeEvent.isComposing) {
              return;
            }
            event.preventDefault();
            if (pending || freeFormBlocked) return;
            const value = event.currentTarget.value.trim();
            if (value.length === 0 || value.length > MAX_BODY) return;
            event.currentTarget.form?.requestSubmit();
          }}
        />
        <button
          type="submit"
          className="od-wa__btn od-wa__btn--send"
          disabled={pending || freeFormBlocked || length === 0 || over}
        >
          {pending ? "Sending…" : freeFormBlocked ? "Template only" : "Send"}
        </button>
      </div>

      <div className="od-wa__composer-foot">
        <span>
          Enter to send · Shift+Enter for a new line
          {serviceWindow?.open ? ` · ${serviceWindow.label}` : ""}
        </span>
        <span className="od-wa__count" data-over={over ? "true" : "false"}>
          {length}/{MAX_BODY}
        </span>
      </div>
    </>
  );
}
