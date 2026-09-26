"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ServiceWindowView } from "../../contracts/message-presentation.ts";
import type { SendingStatusView } from "../../contracts/sending-status.ts";
import type { WhatsappSendableTemplateView } from "../../contracts/template-studio.ts";
import { InboxComposer } from "@/features/whatsapp/components/inbox/InboxComposer";
import { InboxTemplatePicker } from "@/features/whatsapp/components/inbox/InboxTemplatePicker";
import { InboxSavedReplies } from "@/features/whatsapp/components/inbox/InboxSavedReplies";
import { InboxAttachmentComposer } from "@/features/whatsapp/components/inbox/InboxAttachmentComposer";
import {
  WHATSAPP_REPLY_SELECT_EVENT,
  type WhatsappReplySelection,
} from "../../contracts/inbox-reply.ts";
import { InboxKritiAssist } from "@/features/kriti/components/InboxKritiAssist.tsx";

/**
 * The bottom of the chat pane: AI assist, approved templates, then the composer.
 *
 * THE REF IS THE BRIDGE, AND IT STAYS.
 *
 * One ref reaches both children. Kriti writes a draft by assigning
 * `textarea.value` and dispatching a native `input` event, which is why the
 * composer's textarea is uncontrolled — a controlled value would be restored
 * on the next render and the inserted draft would disappear. Changing either
 * half without the other silently breaks "Insert into composer".
 *
 * WHY ASSIST IS COLLAPSED BY DEFAULT.
 *
 * It used to render expanded, permanently, between the thread and the
 * composer — roughly a third of the chat pane given to a panel that is only
 * wanted when someone is stuck on a reply. Collapsed it is one row; open it is
 * the same panel, unchanged. `<details>` does this with no state to manage and
 * no keyboard handling to get wrong.
 *
 * Nothing about Kriti's behaviour moves: it still only drafts, the human still
 * presses Send, and no suggestion can reach WhatsApp on its own.
 *
 * WM-2: THE TEMPLATE PICKER IS ITS OWN FORM.
 *
 * It is shown only to someone who can use this conversation AND holds
 * whatsapp.templates.use, collapsed like assist, and never touches the ref:
 * a template is sent by its own button, not typed into the composer.
 */

interface InboxComposerSectionProps {
  readonly conversationId: string;
  readonly canRead: boolean;
  readonly canUse: boolean;
  readonly serviceWindow?: ServiceWindowView | null;
  readonly sending?: SendingStatusView | null;
  /** Null when the viewer may not send templates here; the picker is not rendered. */
  readonly templates?: readonly WhatsappSendableTemplateView[] | null;
}

export function InboxComposerSection({
  conversationId,
  canRead,
  canUse,
  serviceWindow = null,
  sending = null,
  templates = null,
}: InboxComposerSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [replySelection, setReplySelection] =
    useState<WhatsappReplySelection | null>(null);

  useEffect(() => {
    const selectReply = (event: Event) => {
      const detail = (event as CustomEvent<WhatsappReplySelection>).detail;
      if (!detail?.messageId) return;
      setReplySelection(detail);
      textareaRef.current?.focus();
    };
    window.addEventListener(WHATSAPP_REPLY_SELECT_EVENT, selectReply);
    return () =>
      window.removeEventListener(WHATSAPP_REPLY_SELECT_EVENT, selectReply);
  }, []);

  const clearReply = useCallback(() => setReplySelection(null), []);

  return (
    <>
      {canRead ? (
        <details className="od-wa__assist">
          <summary className="od-wa__assist-toggle">
            <span>AI assist</span>
            <span className="od-wa__assist-hint" aria-hidden="true">
              Draft a reply
            </span>
          </summary>
          <div className="od-wa__assist-body">
            <InboxKritiAssist
              conversationId={conversationId}
              canRead={canRead}
              textareaRef={textareaRef}
            />
          </div>
        </details>
      ) : null}

      {canUse && serviceWindow && !serviceWindow.open ? (
        <p className="od-wa__notice" role="note" data-testid="whatsapp-closed-window-guidance">
          {templates && templates.length > 0
            ? "Outside the 24-hour window only an approved template can reach this customer. Choose one under Templates."
            : "Outside the 24-hour window only an approved template can reach this customer, and none is available to you in this conversation."}
        </p>
      ) : null}

      {canUse && replySelection ? (
        <div className="od-wa__reply-compose" data-testid="whatsapp-reply-selection">
          <span className="od-wa__quote">
            <span className="od-wa__quote-who">
              Replying to {replySelection.authorLabel}
            </span>
            <span className="od-wa__quote-text">{replySelection.preview}</span>
          </span>
          <button
            type="button"
            className="od-wa__reply-cancel"
            aria-label="Cancel reply"
            onClick={clearReply}
          >
            ×
          </button>
        </div>
      ) : null}

      {canUse ? <InboxSavedReplies textareaRef={textareaRef} /> : null}

      {canUse && serviceWindow ? (
        <InboxAttachmentComposer
          conversationId={conversationId}
          serviceWindow={serviceWindow}
          sending={sending}
          replyToMessageId={replySelection?.messageId ?? null}
          onAcceptedSend={clearReply}
        />
      ) : null}

      {canUse && templates ? (
        <InboxTemplatePicker conversationId={conversationId} templates={templates} sending={sending} />
      ) : null}

      <InboxComposer
        conversationId={conversationId}
        canUse={canUse}
        textareaRef={textareaRef}
        serviceWindow={serviceWindow}
        sending={sending}
        replyToMessageId={replySelection?.messageId ?? null}
        onAcceptedSend={clearReply}
      />
    </>
  );
}
