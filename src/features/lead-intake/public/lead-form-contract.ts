/**
 * Client-side lead form field limits and consent copy — mirrors server validation bounds.
 */

import { getCurrentConsentVersionByPurpose } from "../../legal/consent-registry.ts";
import {
  LEAD_INTAKE_NOTICE_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
} from "../contracts.ts";

export const LEAD_FORM_PRIVACY_PATH = "/privacy" as const;
export const LEAD_FORM_TERMS_PATH = "/terms" as const;

export const LEAD_FORM_FIELD_LIMITS = {
  nameMin: 2,
  nameMax: 120,
  emailMax: 254,
  localityMax: 120,
  messageMax: 2000,
} as const;

export const LEAD_FORM_HONEYPOT_FIELD = "website" as const;

export function getServiceEnquiryConsentCopy(): string {
  return getCurrentConsentVersionByPurpose("SERVICE_ENQUIRY").conciseCopy;
}

export function getServiceCommunicationConsentCopy(): string {
  return getCurrentConsentVersionByPurpose("SERVICE_COMMUNICATION").conciseCopy;
}

export function getWhatsappServiceConsentCopy(): string {
  return getCurrentConsentVersionByPurpose("WHATSAPP_SERVICE").conciseCopy;
}

export {
  LEAD_INTAKE_NOTICE_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
};
