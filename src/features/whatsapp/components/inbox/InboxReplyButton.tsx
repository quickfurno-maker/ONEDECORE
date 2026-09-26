"use client";

import {
  WHATSAPP_REPLY_SELECT_EVENT,
  type WhatsappReplySelection,
} from "../../contracts/inbox-reply.ts";

export function InboxReplyButton({
  selection,
}: {
  readonly selection: WhatsappReplySelection;
}) {
  return (
    <button
      type="button"
      className="od-wa__msg-reply"
      aria-label={`Reply to ${selection.authorLabel} message`}
      onClick={() => {
        window.dispatchEvent(
          new CustomEvent<WhatsappReplySelection>(
            WHATSAPP_REPLY_SELECT_EVENT,
            { detail: selection }
          )
        );
      }}
    >
      Reply
    </button>
  );
}
