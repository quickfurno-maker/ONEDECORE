/**
 * Map lead intake API outcomes to UX states and user-facing copy.
 */

import type { LeadIntakeClientResult } from "./lead-intake-client.ts";
import {
  INDIAN_MOBILE_BLANK_MESSAGE,
  INDIAN_MOBILE_INVALID_MESSAGE,
  isValidIndianMobileNational,
} from "./indian-mobile.ts";

export type LeadFormUxState =
  | "idle"
  | "validating"
  | "submitting"
  | "success-created"
  | "success-duplicate"
  | "validation-error"
  | "conflict"
  | "rate-limited"
  | "disabled"
  | "unavailable";

export type LeadFormFieldKey =
  | "name"
  | "mobile"
  | "service"
  | "property"
  | "timeline"
  | "serviceEnquiryConsent"
  | "servicePhoneConsent";

export type LeadFormFieldErrors = Partial<Record<LeadFormFieldKey, string>>;

export const LEAD_FORM_FIELD_ORDER: readonly LeadFormFieldKey[] = [
  "name",
  "mobile",
  "service",
  "property",
  "timeline",
  "serviceEnquiryConsent",
  "servicePhoneConsent",
] as const;

export interface LeadFormValidationResult {
  readonly ok: boolean;
  readonly fields: LeadFormFieldErrors;
  readonly firstInvalid: LeadFormFieldKey | null;
  readonly messages: readonly string[];
}

export interface LeadFormStatusMessage {
  readonly state: LeadFormUxState;
  readonly title: string;
  readonly body?: string;
  readonly isError: boolean;
}

export const LEAD_FORM_PREVIEW_NOTICE =
  "Online enquiry submission is not active yet. You can still copy your interior brief below.";

export const LEAD_FORM_DISABLED_OFFER =
  "You can copy your interior brief to share privately, or contact ONEDECORE through details on this site.";

const FIELD_LABELS: Record<string, string> = {
  "contact.name": "Full name",
  "contact.mobile": "Mobile number",
  "contact.email": "Email address",
  "requirements.service": "Service",
  "requirements.property": "Property type",
  "requirements.timeline": "Timeline",
  "requirements.rooms": "Rooms",
  "requirements.locality": "Locality",
  "requirements.message": "Message",
  "consent.serviceEnquiry": "Service enquiry consent",
  "consent.serviceChannels.phone": "Phone communication consent",
  "consent.serviceChannels.email": "Email communication consent",
  "consent.whatsappService": "WhatsApp consent",
};

export function fieldPathToLabel(path: string): string {
  return FIELD_LABELS[path] ?? path;
}

export function mapClientResultToUxState(
  result: LeadIntakeClientResult
): LeadFormUxState {
  switch (result.kind) {
    case "success-created":
      return "success-created";
    case "success-duplicate":
      return "success-duplicate";
    case "validation-error":
      return "validation-error";
    case "conflict":
      return "conflict";
    case "rate-limited":
      return "rate-limited";
    case "disabled":
      return "disabled";
    case "payload-too-large":
    case "unavailable":
    case "network":
    case "timeout":
      return "unavailable";
    default:
      return "unavailable";
  }
}

export function getLeadFormStatusMessage(
  state: LeadFormUxState,
  options?: {
    readonly retryAfterSeconds?: number;
    readonly validationFields?: readonly string[];
    readonly submissionReference?: string;
  }
): LeadFormStatusMessage | null {
  switch (state) {
    case "idle":
    case "validating":
    case "submitting":
      return null;
    case "success-created":
      return {
        state,
        title: "Your enquiry has been received.",
        body: options?.submissionReference
          ? `Reference: ${options.submissionReference}`
          : undefined,
        isError: false,
      };
    case "success-duplicate":
      return {
        state,
        title: "This enquiry was already received.",
        body: options?.submissionReference
          ? `Reference: ${options.submissionReference}`
          : undefined,
        isError: false,
      };
    case "validation-error": {
      const fields = options?.validationFields ?? [];
      const labels = fields.map(fieldPathToLabel);
      return {
        state,
        title: "Please check the highlighted fields.",
        body:
          labels.length > 0
            ? labels.join(", ")
            : "Some details could not be accepted.",
        isError: true,
      };
    }
    case "conflict":
      return {
        state,
        title: "We could not submit this enquiry.",
        body: "Please wait a moment and try again with a fresh submission.",
        isError: true,
      };
    case "rate-limited": {
      const minutes =
        options?.retryAfterSeconds != null
          ? Math.max(1, Math.ceil(options.retryAfterSeconds / 60))
          : null;
      return {
        state,
        title: "Too many requests.",
        body: minutes
          ? `Please try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
          : "Please try again later.",
        isError: true,
      };
    }
    case "disabled":
      return {
        state,
        title: "Online enquiry submission is not available.",
        body: LEAD_FORM_DISABLED_OFFER,
        isError: true,
      };
    case "unavailable":
      return {
        state,
        title: "We could not submit your enquiry right now.",
        body: "Please try again shortly. You can still copy your interior brief below.",
        isError: true,
      };
    default:
      return null;
  }
}

export function validateLeadFormFields(input: {
  readonly name: string;
  readonly mobile: string;
  readonly locality: string;
  readonly message: string;
  readonly serviceEnquiryConsent: boolean;
  readonly servicePhoneConsent: boolean;
  readonly service?: string | null;
  readonly property?: string | null;
  readonly timeline?: string | null;
  /** @deprecated Public form no longer collects email. Kept for API-compat tests. */
  readonly email?: string;
  /** @deprecated Public form no longer collects email consent. */
  readonly serviceEmailConsent?: boolean;
  /** @deprecated Public form no longer collects email. */
  readonly hasEmail?: boolean;
}): LeadFormValidationResult {
  const fields: LeadFormFieldErrors = {};
  const trimmedName = input.name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 120) {
    fields.name = "Enter your full name.";
  }

  const mobile = input.mobile.trim();
  if (!mobile) {
    fields.mobile = INDIAN_MOBILE_BLANK_MESSAGE;
  } else if (!isValidIndianMobileNational(mobile)) {
    fields.mobile = INDIAN_MOBILE_INVALID_MESSAGE;
  }

  if (!input.service) {
    fields.service = "Choose a service.";
  }
  if (!input.property) {
    fields.property = "Choose your property type.";
  }
  if (!input.timeline) {
    fields.timeline = "Choose your timeline.";
  }

  if (!input.serviceEnquiryConsent) {
    fields.serviceEnquiryConsent =
      "Please confirm that ONEDECORE may process this enquiry.";
  }
  if (!input.servicePhoneConsent) {
    fields.servicePhoneConsent =
      "Please allow ONEDECORE to contact you by phone about this enquiry.";
  }

  // Legacy email validation retained for API-compat unit tests only (no public email UI).
  const legacyEmailMessages: string[] = [];
  const trimmedEmail = (input.email ?? "").trim();
  const hasEmail = input.hasEmail ?? trimmedEmail.length > 0;
  if (hasEmail || trimmedEmail) {
    if (
      trimmedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      legacyEmailMessages.push("Enter a valid email address.");
    }
    if (!input.serviceEmailConsent) {
      legacyEmailMessages.push(
        "Email communication consent is required when you provide an email address."
      );
    }
  }

  const localityTooLong = input.locality.trim().length > 120;
  const messageTooLong = input.message.trim().length > 2000;
  const firstInvalid =
    LEAD_FORM_FIELD_ORDER.find((key) => Boolean(fields[key])) ?? null;

  const messages = [
    ...LEAD_FORM_FIELD_ORDER.map((key) => fields[key]).filter(
      (value): value is string => Boolean(value)
    ),
    ...legacyEmailMessages,
  ];
  if (localityTooLong) {
    messages.push("Locality must be 120 characters or fewer.");
  }
  if (messageTooLong) {
    messages.push("Message must be 2000 characters or fewer.");
  }

  return {
    ok:
      firstInvalid === null &&
      legacyEmailMessages.length === 0 &&
      !localityTooLong &&
      !messageTooLong,
    fields,
    firstInvalid,
    messages,
  };
}

/** @deprecated Prefer validateLeadFormFields(...).messages */
export function validateLeadFormFieldMessages(
  input: Parameters<typeof validateLeadFormFields>[0]
): readonly string[] {
  return validateLeadFormFields(input).messages;
}
