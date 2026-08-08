"use client";

import { useRef } from "react";
import { InboxComposer } from "@/features/whatsapp/components/inbox/InboxComposer";
import { InboxKritiAssist } from "@/features/kriti/components/InboxKritiAssist.tsx";

interface InboxComposerSectionProps {
  readonly conversationId: string;
  readonly canRead: boolean;
  readonly canUse: boolean;
}

export function InboxComposerSection({
  conversationId,
  canRead,
  canUse,
}: InboxComposerSectionProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  return (
    <div className="space-y-4">
      <InboxKritiAssist
        conversationId={conversationId}
        canRead={canRead}
        textareaRef={textareaRef}
      />
      <InboxComposer
        conversationId={conversationId}
        canUse={canUse}
        textareaRef={textareaRef}
      />
    </div>
  );
}
