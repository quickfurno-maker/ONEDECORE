"use client";

import { useRef } from "react";
import type { ServiceWindowView } from "../../contracts/message-presentation.ts";
import type { SendingStatusView } from "../../contracts/sending-status.ts";
import { InboxComposer } from "@/features/whatsapp/components/inbox/InboxComposer";
import { InboxKritiAssist } from "@/features/kriti/components/InboxKritiAssist.tsx";

/**
 * The bottom of the chat pane: AI assist, then the composer.
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
 */

interface InboxComposerSectionProps {
  readonly conversationId: string;
  readonly canRead: boolean;
  readonly canUse: boolean;
  readonly serviceWindow?: ServiceWindowView | null;
  readonly sending?: SendingStatusView | null;
}

export function InboxComposerSection({
  conversationId,
  canRead,
  canUse,
  serviceWindow = null,
  sending = null,
}: InboxComposerSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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

      <InboxComposer
        conversationId={conversationId}
        canUse={canUse}
        textareaRef={textareaRef}
        serviceWindow={serviceWindow}
        sending={sending}
      />
    </>
  );
}
