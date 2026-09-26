export const WHATSAPP_REPLY_SELECT_EVENT = "onedecore:whatsapp-reply-select" as const;

export interface WhatsappReplySelection {
  readonly messageId: string;
  readonly authorLabel: string;
  readonly preview: string;
}
