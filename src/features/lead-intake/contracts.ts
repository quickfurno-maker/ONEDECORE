/**
 * Lead intake contracts — planner IDs and consent versions from canonical sources.
 */

import {
  getCurrentConsentVersionByPurpose,
  type ConsentPurposeCode,
} from "../legal/consent-registry.ts";
import { PRIVACY_NOTICE_VERSION } from "../legal/privacy-policy-content.ts";
import type { SignedPublicationContext } from "../landing-lab/contracts/publication-context.ts";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
  type LeadBudgetComfortCode,
  type LeadPropertyCode,
  type LeadRoomCode,
  type LeadServiceCode,
  type LeadTimelineCode,
} from "./planner-allowlist.ts";

export {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
};
export type {
  LeadBudgetComfortCode,
  LeadPropertyCode,
  LeadRoomCode,
  LeadServiceCode,
  LeadTimelineCode,
};

export const LEAD_INTAKE_PLANNER_VERSION = "home-r4-v1" as const;
export const LEAD_INTAKE_NOTICE_VERSION = PRIVACY_NOTICE_VERSION;

function requireCurrentConsentVersion(purpose: ConsentPurposeCode): string {
  return getCurrentConsentVersionByPurpose(purpose).version;
}

export const SERVICE_ENQUIRY_COPY_VERSION =
  requireCurrentConsentVersion("SERVICE_ENQUIRY");
export const SERVICE_COMMUNICATION_COPY_VERSION = requireCurrentConsentVersion(
  "SERVICE_COMMUNICATION"
);
export const WHATSAPP_COPY_VERSION =
  requireCurrentConsentVersion("WHATSAPP_SERVICE");

export interface LeadIntakeRequestBody {
  readonly idempotencyKey: string;
  readonly plannerVersion: string;
  readonly contact: {
    readonly name: string;
    readonly mobile: string;
    readonly email?: string;
  };
  readonly requirements: {
    readonly service: LeadServiceCode;
    readonly property: LeadPropertyCode;
    readonly timeline: LeadTimelineCode;
    readonly rooms: readonly LeadRoomCode[];
    readonly budgetComfort?: LeadBudgetComfortCode;
    readonly estimate?: Record<string, unknown> | null;
    readonly locality?: string;
    readonly message?: string;
  };
  readonly consent: {
    readonly serviceEnquiry: true;
    readonly serviceChannels: {
      readonly phone: true;
      /** Present only when email service communication is granted. */
      readonly email?: true;
    };
    readonly whatsappService?: boolean;
    readonly serviceEnquiryCopyVersion: string;
    readonly serviceCommunicationCopyVersion: string;
    readonly whatsappCopyVersion?: string;
    readonly noticeVersion: string;
  };
  readonly attribution: {
    readonly landingPath: string;
    readonly referrerPath?: string;
    readonly utmSource?: string;
    readonly utmMedium?: string;
    readonly utmCampaign?: string;
    readonly utmTerm?: string;
    readonly utmContent?: string;
    readonly fbclid?: string;
    readonly gclid?: string;
  };
  readonly antiBot: {
    readonly website: string;
    readonly formStartedAt: string;
  };
  readonly landingPublicationContext?: SignedPublicationContext;
}

export type LeadIntakeRpcOutcome =
  | "created"
  | "idempotent_replay"
  | "idempotency_conflict"
  | "network_rate_limited"
  | "phone_rate_limited"
  | "validation_rejected";

export interface LeadIntakeRpcResult {
  readonly outcome: LeadIntakeRpcOutcome;
  readonly submission_reference: string | null;
  readonly retry_after_seconds: number | null;
  readonly duplicate: boolean;
}

export interface ValidatedLeadIntake {
  readonly idempotencyKey: string;
  readonly plannerVersion: string;
  readonly name: string;
  readonly phoneE164: string;
  readonly email: string | null;
  readonly service: LeadServiceCode;
  readonly property: LeadPropertyCode;
  readonly timeline: LeadTimelineCode;
  readonly rooms: readonly LeadRoomCode[];
  readonly budgetComfort: LeadBudgetComfortCode | null;
  readonly estimateSnapshot: Record<string, unknown> | null;
  readonly locality: string | null;
  readonly message: string | null;
  readonly landingPath: string;
  readonly attribution: Record<string, string>;
  readonly landingPublicationContext: SignedPublicationContext | null;
  readonly consentServicePhone: true;
  readonly consentServiceEmail: boolean;
  readonly consentWhatsapp: boolean;
  readonly copyServiceEnquiry: string;
  readonly copyServiceCommunication: string;
  readonly copyWhatsapp: string | null;
  readonly noticeVersion: string;
  readonly formStartedAt: string;
}
