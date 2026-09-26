"use client";

import type { RefObject } from "react";
import { ONEDECORE_WHATSAPP_SAVED_REPLIES } from "../../contracts/saved-replies.ts";

export function InboxSavedReplies({
  textareaRef,
}: {
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
}) {
  const insert = (body: string) => {
    const node = textareaRef.current;
    if (!node) return;
    node.value = body;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.focus();
  };

  return (
    <details className="od-wa__assist od-wa__saved-replies">
      <summary className="od-wa__assist-toggle">
        <span>Saved replies</span>
        <span className="od-wa__assist-hint" aria-hidden="true">
          Insert common response
        </span>
      </summary>
      <div className="od-wa__assist-body">
        <div className="od-wa__saved-reply-grid">
          {ONEDECORE_WHATSAPP_SAVED_REPLIES.map((reply) => (
            <button
              key={reply.id}
              type="button"
              className="od-wa__saved-reply"
              onClick={() => insert(reply.body)}
            >
              <strong>{reply.label}</strong>
              <span>{reply.body}</span>
            </button>
          ))}
        </div>
      </div>
    </details>
  );
}
