/**
 * WhatsApp inbox integration — insert Kriti draft into composer only.
 * Does not call WhatsApp send RPC or provider dispatch.
 */

import type { RefObject } from "react";

export interface KritiInboxInsertDraftOptions {
  readonly textareaRef: RefObject<HTMLTextAreaElement | null>;
  readonly onInserted?: (text: string) => void;
}

export function createKritiInboxInsertDraftHandler(
  options: KritiInboxInsertDraftOptions
): (text: string) => void {
  return (text: string) => {
    const textarea = options.textareaRef.current;
    if (!textarea) return;
    textarea.value = text;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
    options.onInserted?.(text);
  };
}

export const INBOX_KRITI_ALLOWED_TASKS = [
  "conversation_summary",
  "missing_information",
  "objection_suggestions",
  "next_action_suggestions",
  "service_reply_draft",
] as const;
