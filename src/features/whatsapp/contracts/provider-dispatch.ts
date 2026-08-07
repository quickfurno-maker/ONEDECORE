/**
 * Phase 6B-B4 — provider dispatch contracts.
 */

export const WHATSAPP_OUTBOUND_MODES = [
  "disabled",
  "local-test",
  "enabled",
] as const;

export type WhatsappOutboundMode = (typeof WHATSAPP_OUTBOUND_MODES)[number];

export const WHATSAPP_PROVIDER_CODES = ["fake", "meta"] as const;

export type WhatsappProviderCode = (typeof WHATSAPP_PROVIDER_CODES)[number];

export const WHATSAPP_DISPATCH_ATTEMPT_STATUSES = [
  "requested",
  "succeeded",
  "failed",
  "ambiguous",
] as const;

export type WhatsappDispatchAttemptStatus =
  (typeof WHATSAPP_DISPATCH_ATTEMPT_STATUSES)[number];

export const WHATSAPP_DISPATCH_ERROR_CLASSES = [
  "transient",
  "terminal",
  "ambiguous",
] as const;

export type WhatsappDispatchErrorClass =
  (typeof WHATSAPP_DISPATCH_ERROR_CLASSES)[number];

export const META_WHATSAPP_GRAPH_API_VERSION_DEFAULT = "v22.0" as const;

export type WhatsappProviderDispatchRequest = {
  readonly phoneNumberId: string;
  readonly customerE164: string;
  readonly bodyText: string;
  readonly providerAttemptKey: string;
};

export type WhatsappProviderDispatchSuccess = {
  readonly kind: "success";
  readonly providerMessageId: string;
  readonly providerTimestamp: string;
  readonly httpStatus: number;
  readonly responseSnapshot: Record<string, unknown>;
};

export type WhatsappProviderDispatchFailure = {
  readonly kind: "failed";
  readonly errorClass: "transient" | "terminal";
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number | null;
  readonly responseSnapshot: Record<string, unknown>;
};

export type WhatsappProviderDispatchAmbiguous = {
  readonly kind: "ambiguous";
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number | null;
  readonly responseSnapshot: Record<string, unknown>;
};

export type WhatsappProviderDispatchResult =
  | WhatsappProviderDispatchSuccess
  | WhatsappProviderDispatchFailure
  | WhatsappProviderDispatchAmbiguous;

export type WhatsappDispatchClaimRow = {
  readonly outcome_code: string;
  readonly send_intent_id: string;
  readonly dispatch_attempt_id: string | null;
  readonly conversation_id: string | null;
  readonly requested_by: string | null;
  readonly body_text: string | null;
  readonly phone_number_id: string | null;
  readonly customer_e164: string | null;
  readonly sender_e164: string | null;
};

export type WhatsappDispatchBindRow = {
  readonly outcome_code: string;
  readonly send_intent_id: string;
  readonly outbound_message_id: string | null;
  readonly provider_message_id: string | null;
};

export type WhatsappDispatchServiceResult = {
  readonly outcome:
    | "disabled"
    | "already_bound"
    | "bound"
    | "failed"
    | "ambiguous"
    | "not_claimable";
  readonly sendIntentId?: string;
  readonly dispatchAttemptId?: string;
  readonly providerMessageId?: string;
  readonly outboundMessageId?: string;
  readonly message: string;
};
