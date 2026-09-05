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
  LEAD_QUALIFIER_KINDS,
  LEAD_HOME_SIZE_CODES,
  LEAD_KITCHEN_SCOPE_CODES,
  LEAD_WARDROBE_COUNT_CODES,
  LEAD_QUALIFIER_KIND_BY_SERVICE,
  LEAD_QUALIFIER_CODES_BY_KIND,
  isAllowedLeadQualifier,
  propertyCodeFromQualifier,
  type LeadQualifierKind,
  type LeadQualifierCode,
} from "./planner-allowlist.ts";

export {
  LEAD_QUALIFIER_KINDS,
  LEAD_HOME_SIZE_CODES,
  LEAD_KITCHEN_SCOPE_CODES,
  LEAD_WARDROBE_COUNT_CODES,
  LEAD_QUALIFIER_KIND_BY_SERVICE,
  LEAD_QUALIFIER_CODES_BY_KIND,
  isAllowedLeadQualifier,
  propertyCodeFromQualifier,
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
};
export type {
  LeadQualifierKind,
  LeadQualifierCode,
  LeadBudgetComfortCode,
  LeadPropertyCode,
  LeadRoomCode,
  LeadServiceCode,
  LeadTimelineCode,
};

export const LEAD_INTAKE_PLANNER_VERSION = "home-r4-v1" as const;

/**
 * The simplified public consultation form.
 *
 * A DISCRIMINATOR, not a loosening. `home-r4-v1` still requires property,
 * timeline and rooms exactly as before — the legacy planner collects all three,
 * and relaxing them globally would let any caller omit answers it did ask for.
 *
 * `public-consult-v1` asks ONE service-relevant qualifier and nothing else, so
 * under this version property and timeline are absent because they were never
 * asked. That is the whole point: the database records what the customer said,
 * not a default the UI invented to satisfy a column.
 */
export const PUBLIC_CONSULT_PLANNER_VERSION = "public-consult-v1" as const;

/** Every planner version the intake endpoint accepts. */
export const LEAD_INTAKE_PLANNER_VERSIONS = [
  LEAD_INTAKE_PLANNER_VERSION,
  PUBLIC_CONSULT_PLANNER_VERSION,
] as const;

export type LeadIntakePlannerVersion =
  (typeof LEAD_INTAKE_PLANNER_VERSIONS)[number];
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
    /**
     * Required for `home-r4-v1`; absent for `public-consult-v1` unless the
     * customer's own home-size answer names one. Never defaulted.
     */
    readonly property?: LeadPropertyCode;
    /** Required for `home-r4-v1`; never collected by the public form. */
    readonly timeline?: LeadTimelineCode;
    /** The single service-relevant answer the public form collects. */
    readonly qualifier?: {
      readonly kind: LeadQualifierKind;
      readonly code: LeadQualifierCode;
    };
    readonly rooms?: readonly LeadRoomCode[];
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
    readonly wbraid?: string;
    readonly gbraid?: string;
    readonly fbc?: string;
    readonly fbp?: string;
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
  /** Null when the customer was never asked (public consultation form). */
  readonly property: LeadPropertyCode | null;
  /** Null when the customer was never asked. Never defaulted. */
  readonly timeline: LeadTimelineCode | null;
  /** The one service-relevant answer, when the public form collected it. */
  readonly qualifier: {
    readonly kind: LeadQualifierKind;
    readonly code: LeadQualifierCode;
  } | null;
  readonly rooms: readonly LeadRoomCode[];
  readonly budgetComfort: LeadBudgetComfortCode | null;
  readonly estimateSnapshot: Record<string, unknown> | null;
  readonly locality: string | null;
  readonly message: string | null;
  readonly landingPath: string;
  readonly attribution: Record<string, string>;
  readonly landingPublicationContext: SignedPublicationContext | null;
  readonly campaignExecutionContext: {
    readonly signature: string;
    readonly context: {
      readonly version: 1;
      readonly runReference: string;
      readonly runTargetReference: string;
      readonly providerChannel: "meta_ads" | "google_ads";
      readonly campaignReference: string;
      readonly campaignVersionNumber: number;
      readonly landingPublicationReference: string | null;
      readonly issuedAt: string;
      readonly expiresAt: string;
    };
  } | null;
  readonly consentServicePhone: true;
  readonly consentServiceEmail: boolean;
  readonly consentWhatsapp: boolean;
  readonly copyServiceEnquiry: string;
  readonly copyServiceCommunication: string;
  readonly copyWhatsapp: string | null;
  readonly noticeVersion: string;
  readonly formStartedAt: string;
}
