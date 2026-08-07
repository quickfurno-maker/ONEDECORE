/**
 * WhatsApp inbox send-intent action state (intent + optional dispatch outcome).
 */

export type WhatsappSendActionState = {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly intentId?: string;
  readonly dispatchOutcome?: string;
  readonly providerMessageId?: string;
};

export const INITIAL_WHATSAPP_SEND_ACTION_STATE: WhatsappSendActionState = {
  success: false,
  message: "",
};
