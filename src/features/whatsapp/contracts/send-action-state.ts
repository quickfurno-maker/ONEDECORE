/**
 * WhatsApp inbox send-intent action state (pre-dispatch only).
 */

export type WhatsappSendActionState = {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly intentId?: string;
};

export const INITIAL_WHATSAPP_SEND_ACTION_STATE: WhatsappSendActionState = {
  success: false,
  message: "",
};
