"use client";

import { useActionState, useEffect, useRef } from "react";
import { INITIAL_WHATSAPP_SEND_ACTION_STATE } from "../../contracts/send-action-state.ts";
import type { ServiceWindowView } from "../../contracts/message-presentation.ts";
import type { SendingStatusView } from "../../contracts/sending-status.ts";
import {
  WHATSAPP_OUTBOUND_MEDIA_ACCEPT,
  WHATSAPP_OUTBOUND_MEDIA_CAPTION_MAX,
} from "../../contracts/outbound-media.ts";
import { createWhatsappServiceMediaSendIntentAction } from "../../server/whatsapp-send-actions.ts";

interface InboxAttachmentComposerProps {
  readonly conversationId: string;
  readonly serviceWindow: ServiceWindowView;
  readonly sending?: SendingStatusView | null;
  readonly replyToMessageId?: string | null;
  readonly onAcceptedSend?: () => void;
}

export function InboxAttachmentComposer({
  conversationId,
  serviceWindow,
  sending = null,
  replyToMessageId = null,
  onAcceptedSend,
}: InboxAttachmentComposerProps) {
  const [state, formAction, pending] = useActionState(
    createWhatsappServiceMediaSendIntentAction,
    INITIAL_WHATSAPP_SEND_ACTION_STATE
  );
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.success) return;
    formRef.current?.reset();
    onAcceptedSend?.();
  }, [state.success, state.intentId, onAcceptedSend]);

  if (!serviceWindow.open) {
    return null;
  }

  const submit = (formData: FormData) => {
    formData.set("idempotencyKey", crypto.randomUUID());
    return formAction(formData);
  };

  return (
    <details className="od-wa__assist od-wa__attachment-composer">
      <summary className="od-wa__assist-toggle">
        <span>Attachment</span>
        <span className="od-wa__assist-hint" aria-hidden="true">
          Photo · PDF · MP4
        </span>
      </summary>
      <div className="od-wa__assist-body">
        <form
          ref={formRef}
          action={submit}
          className="od-wa__attachment-form"
          aria-label="Send a WhatsApp attachment"
        >
          <input type="hidden" name="conversationId" value={conversationId} />
          {replyToMessageId ? (
            <input
              type="hidden"
              name="replyToMessageId"
              value={replyToMessageId}
            />
          ) : null}

          <label className="od-wa__attachment-field">
            <span>File</span>
            <input
              type="file"
              name="mediaFile"
              accept={WHATSAPP_OUTBOUND_MEDIA_ACCEPT}
              required
              disabled={pending}
              className="od-wa__input"
            />
          </label>

          <label className="od-wa__attachment-field">
            <span>Caption <small>optional</small></span>
            <textarea
              name="caption"
              rows={2}
              maxLength={WHATSAPP_OUTBOUND_MEDIA_CAPTION_MAX}
              disabled={pending}
              className="od-wa__input"
              placeholder="Add context for the customer"
            />
          </label>

          <p className="od-wa__empty-note">
            JPG, PNG or WebP up to 5 MiB. PDF or MP4 up to 16 MiB.
            Files are stored privately and re-verified before dispatch.
          </p>

          {sending && !sending.reaches ? (
            <p className="od-wa__notice" role="status">
              {sending.detail}
            </p>
          ) : null}

          {state.message ? (
            <p
              className={state.success ? "od-wa__ok" : "od-wa__error"}
              role={state.success ? "status" : "alert"}
            >
              {state.message}
            </p>
          ) : null}

          <button
            type="submit"
            className="od-wa__btn"
            disabled={pending}
          >
            {pending ? "Preparing attachment…" : "Send attachment"}
          </button>
        </form>
      </div>
    </details>
  );
}
