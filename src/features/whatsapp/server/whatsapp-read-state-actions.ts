"use server";
import "server-only";

import { acknowledgeInboxConversationOpenedForCurrentUser } from "./whatsapp-inbox-repository.ts";

/*
 * WM-1 — the one browser-reachable way to advance staff read state.
 *
 * A Server Action is a POST from code that runs after the thread has mounted.
 * That is the whole reason it exists: marking read inside the conversation
 * page's Server Component would fire on a `<Link>` prefetch, and a hovered row
 * would clear an unread marker nobody had looked at.
 *
 * It is internal ONEDECORE state. Nothing here reaches Meta, and the RPC
 * underneath never writes provider message status.
 */

export type WhatsappReadAcknowledgementResult = { readonly ok: boolean };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function acknowledgeWhatsappConversationOpenedAction(
  conversationId: string
): Promise<WhatsappReadAcknowledgementResult> {
  // A Server Action is a public endpoint; its argument is untrusted input.
  if (typeof conversationId !== "string" || !UUID_PATTERN.test(conversationId)) {
    return { ok: false };
  }

  try {
    const ok = await acknowledgeInboxConversationOpenedForCurrentUser(conversationId);
    return { ok };
  } catch {
    /*
     * A failure is reported as a failure. The caller keeps the conversation
     * unread rather than pretending the acknowledgement landed.
     */
    return { ok: false };
  }
}
