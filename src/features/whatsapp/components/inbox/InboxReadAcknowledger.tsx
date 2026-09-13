"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { acknowledgeWhatsappConversationOpenedAction } from "../../server/whatsapp-read-state-actions.ts";

/**
 * Tells the server this member of staff has the thread open.
 *
 * WHY A CLIENT EFFECT, AND NOT THE PAGE.
 *
 * The conversation route is a Server Component, and Next.js may render it for
 * a `<Link>` prefetch — a hovered row, a row scrolled into view. Marking read
 * there would clear a conversation's unread marker for someone who never saw
 * it. An effect runs only once the thread has actually mounted in a browser,
 * so that is where the acknowledgement starts.
 *
 * A hidden tab does not acknowledge. A thread opened in a background tab has
 * not been read; it is acknowledged when the tab comes to the front.
 *
 * Re-runs when `lastMessageAt` changes, which is what polling delivers when a
 * new message lands in the thread the reader is looking at.
 *
 * ON FAILURE NOTHING HAPPENS. The list is refreshed only after the server says
 * the watermark moved, so a failed call leaves the unread marker exactly where
 * the database says it is — no optimistic clearing.
 *
 * Renders nothing and holds no state.
 */

interface InboxReadAcknowledgerProps {
  readonly conversationId: string;
  readonly lastMessageAt: string | null;
}

export function InboxReadAcknowledger({
  conversationId,
  lastMessageAt,
}: InboxReadAcknowledgerProps) {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    const acknowledge = async () => {
      const result = await acknowledgeWhatsappConversationOpenedAction(conversationId);
      if (cancelled) return;
      if (result.ok) {
        router.refresh();
      }
    };

    if (document.visibilityState === "visible") {
      void acknowledge();
      return () => {
        cancelled = true;
      };
    }

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      document.removeEventListener("visibilitychange", onVisible);
      void acknowledge();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [conversationId, lastMessageAt, router]);

  return null;
}
