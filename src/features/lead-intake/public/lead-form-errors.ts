/**
 * Map lead intake API outcomes to UX states and user-facing copy.
 */

import type { LeadIntakeClientResult } from "./lead-intake-client.ts";

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
  readonly email: string;
  readonly locality: string;
  readonly message: string;
  readonly serviceEnquiryConsent: boolean;
  readonly servicePhoneConsent: boolean;
  readonly serviceEmailConsent: boolean;
  readonly hasEmail: boolean;
}): readonly string[] {
  const errors: string[] = [];
  const trimmedName = input.name.trim();
  if (
    trimmedName.length < 2 ||
    trimmedName.length > 120
  ) {
    errors.push("Enter your full name (2–120 characters).");
  }
  if (!input.mobile.trim()) {
    errors.push("Enter your mobile number.");
  }
  const trimmedEmail = input.email.trim();
  if (trimmedEmail) {
    if (
      trimmedEmail.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)
    ) {
      errors.push("Enter a valid email address.");
    }
    if (!input.serviceEmailConsent) {
      errors.push("Email communication consent is required when you provide an email address.");
    }
  }
  if (input.locality.trim().length > 120) {
    errors.push("Locality must be 120 characters or fewer.");
  }
  if (input.message.trim().length > 2000) {
    errors.push("Message must be 2000 characters or fewer.");
  }
  if (!input.serviceEnquiryConsent) {
    errors.push("Service enquiry consent is required.");
  }
  if (!input.servicePhoneConsent) {
    errors.push("Phone communication consent is required.");
  }
  return errors;
}
