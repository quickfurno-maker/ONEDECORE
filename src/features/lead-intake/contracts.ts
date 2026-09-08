/**
 * Lead intake contracts — planner IDs and consent versions from canonical sources.
 */

import {
  getConsentVersionById,
  getCurrentConsentVersionByPurpose,
  type ConsentPurposeCode,
} from "../legal/consent-registry.ts";
import {
  LEAD_BUDGET_RANGE_CODES,
  LEAD_PROJECT_SCOPE_CODES,
  budgetRangesForProjectScope,
  isBudgetRangeForScope,
  isLeadProjectScopeCode,
  serviceForProjectScope,
  type LeadProjectScopeCode,
} from "./project-scope.ts";
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
  LEAD_BUDGET_RANGE_CODES,
  LEAD_PROJECT_SCOPE_CODES,
  budgetRangesForProjectScope,
  isBudgetRangeForScope,
  isLeadProjectScopeCode,
  serviceForProjectScope,
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
  LeadProjectScopeCode,
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
export const PUBLIC_CONSULT_V1_PLANNER_VERSION = "public-consult-v1" as const;

/**
 * The SINGLE-STEP public consultation form.
 *
 * A new version rather than a looser v1, and the distinction is not cosmetic.
 * Rows already stored under `public-consult-v1` were collected by a form that
 * asked a service-specific question, and every one of them carries the answer.
 * Making v1's qualifier optional would retroactively change what those rows
 * assert, and would leave nothing able to tell "the customer answered" apart
 * from "nobody asked".
 *
 * v2 asks a service, a name, a mobile number and an optional locality. Under it
 * the qualifier, property, timeline, rooms, budget and estimate must all be
 * ABSENT — enforced in both this layer and the SQL, because a value the form
 * never showed came from a stale or tampered client.
 */
export const PUBLIC_CONSULT_V2_PLANNER_VERSION = "public-consult-v2" as const;

/**
 * The premium requirement form.
 *
 * v3 exists because the owner-approved form asks TWO new questions that v2
 * explicitly forbids: a project scope and a budget range. v2 forbids them for a
 * good reason — its own form never showed them — so relaxing v2 would make it
 * impossible to tell a v2 row that was never asked from one whose answer was
 * dropped. v3 is added beside it instead, and asks:
 *
 *   projectScope   required, allowlisted
 *   budgetRange    required, and must belong to THAT scope
 *   service        required, and must be the one the scope implies
 *   name/mobile    required, as always
 *   locality       optional
 *   qualifier, property, timeline, rooms, budgetComfort, estimate — forbidden
 *
 * The service is derived from the scope server-side; a body whose service
 * disagrees with its scope is rejected rather than silently corrected, because
 * a caller that sends a contradiction is a caller whose other fields cannot be
 * trusted either.
 */
export const PUBLIC_CONSULT_V3_PLANNER_VERSION = "public-consult-v3" as const;

/**
 * The UNIFIED multi-step public form.
 *
 * WHY A FOURTH VERSION RATHER THAN A LOOSER THIRD
 *
 * The site now has one lead form: the guided Service -> Home -> Timeline ->
 * Brief flow, with the scope-specific budget ladder folded in. That set of
 * answers does not fit any existing contract. `home-r4-v1` carries a timeline
 * but knows nothing of project scope or the budget ladders; `public-consult-v3`
 * carries scope and budget and FORBIDS a timeline outright — and that
 * prohibition is what makes a v3 row readable, because a null timeline under v3
 * means "never asked" rather than "asked and lost".
 *
 * Relaxing v3 would delete that distinction from every row stored under it. So
 * v4 is added beside it, exactly as v3 was added beside v2 and v2 beside v1.
 *
 * WHAT V4 MEANS
 *
 *   service        required, allowlisted
 *   projectScope   required for complete-home-interiors and modular-kitchens;
 *                  ABSENT for custom-wardrobes, which has no scope list
 *   budgetRange    required whenever a scope is present, and must belong to
 *                  THAT scope's ladder; absent with the scope
 *   timeline       required, from the existing LEAD_TIMELINE_CODES vocabulary
 *   locality       optional
 *   message        optional
 *   qualifier, property, rooms, budgetComfort, estimate — all FORBIDDEN
 *
 * The wardrobe exception is deliberate and narrow. There is no scope list that
 * describes a wardrobe job and no owner-approved wardrobe budget ladder, so the
 * form asks neither — and a contract that demanded them would force the UI to
 * invent an answer.
 */
export const PUBLIC_CONSULT_V4_PLANNER_VERSION = "public-consult-v4" as const;

/** Services whose scope the form asks for. Wardrobes are the exception. */
export const V4_SCOPED_SERVICES = [
  "complete-home-interiors",
  "modular-kitchens",
] as const;

/** True when v4 must carry a project scope and a budget for this service. */
export function v4RequiresScope(service: string): boolean {
  return (V4_SCOPED_SERVICES as readonly string[]).includes(service);
}

/**
 * What the canonical public form emits.
 *
 * Pointed at v4. The v1, v2 and v3 constants survive for the rows and the
 * contracts that still mean v1, v2 and v3 — all three remain accepted so
 * historical rows stay readable and nothing stored changes meaning.
 */
export const PUBLIC_CONSULT_PLANNER_VERSION = PUBLIC_CONSULT_V4_PLANNER_VERSION;

/** Every planner version the intake endpoint accepts. */
export const LEAD_INTAKE_PLANNER_VERSIONS = [
  LEAD_INTAKE_PLANNER_VERSION,
  PUBLIC_CONSULT_V1_PLANNER_VERSION,
  PUBLIC_CONSULT_V2_PLANNER_VERSION,
  PUBLIC_CONSULT_V3_PLANNER_VERSION,
  PUBLIC_CONSULT_V4_PLANNER_VERSION,
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

/*
 * The single-consent form records the wording it actually showed.
 *
 * These are resolved BY ID rather than through the current-version mapping,
 * because the mapping still points the two-checkbox interiors planner at the
 * separate v1.0 copies. Resolving through the registry (rather than hardcoding
 * the string) keeps the id honest: a typo throws at module load.
 */
export const SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION = getConsentVersionById(
  "service-enquiry-v1.1-single-consent"
).version;
export const SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION =
  getConsentVersionById("service-communication-v1.1-single-consent").version;

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
     * customer's own home-size answer names one; always absent for
     * `public-consult-v2`. Never defaulted.
     */
    readonly property?: LeadPropertyCode;
    /** Required for `home-r4-v1`; never collected by either public form. */
    readonly timeline?: LeadTimelineCode;
    /**
     * The single service-relevant answer `public-consult-v1` collects.
     * Forbidden under `public-consult-v2`, which does not ask.
     */
    readonly qualifier?: {
      readonly kind: LeadQualifierKind;
      readonly code: LeadQualifierCode;
    };
    readonly rooms?: readonly LeadRoomCode[];
    readonly budgetComfort?: LeadBudgetComfortCode;
    readonly estimate?: Record<string, unknown> | null;
    /**
     * The size of the project, for `public-consult-v3` only. Not a service:
     * "2 BHK" describes the home, and the service it implies is derived from
     * it rather than sent alongside it.
     */
    readonly projectScope?: LeadProjectScopeCode;
    /**
     * A budget band from THIS scope's ladder, for `public-consult-v3` only.
     * A band belonging to another scope is rejected, not ignored.
     */
    readonly budgetRange?: string;
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
  /** Null under every version except `public-consult-v3`. Never defaulted. */
  readonly projectScope: LeadProjectScopeCode | null;
  /** Null under every version except `public-consult-v3`. Never defaulted. */
  readonly budgetRange: string | null;
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
