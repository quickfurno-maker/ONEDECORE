/**
 * Lead intake public/private contracts (shared types).
 * Runtime validation lives in server modules.
 */

export const LEAD_INTAKE_PLANNER_VERSION = "home-r4-v1" as const;
export const LEAD_INTAKE_NOTICE_VERSION = "privacy-notice-v0.1-draft" as const;

export const LEAD_SERVICE_CODES = [
  "complete-home-interiors",
  "modular-kitchens",
  "custom-wardrobes",
] as const;

export const LEAD_PROPERTY_CODES = [
  "apartment-1bhk",
  "apartment-2bhk",
  "apartment-3bhk",
  "apartment-4bhk-plus",
  "villa-rowhouse",
  "single-room",
] as const;

export const LEAD_TIMELINE_CODES = [
  "ready-now",
  "within-3-months",
  "3-6-months",
  "more-than-6-months",
  "exploring",
] as const;

export const LEAD_ROOM_CODES = [
  "living",
  "kitchen",
  "bedrooms",
  "wardrobes",
  "dining",
  "other",
] as const;

export const LEAD_BUDGET_COMFORT_CODES = [
  "under-3l",
  "3-6l",
  "6-12l",
  "12-20l",
  "20-30l",
  "30l-plus",
] as const;

export type LeadServiceCode = (typeof LEAD_SERVICE_CODES)[number];
export type LeadPropertyCode = (typeof LEAD_PROPERTY_CODES)[number];
export type LeadTimelineCode = (typeof LEAD_TIMELINE_CODES)[number];
export type LeadRoomCode = (typeof LEAD_ROOM_CODES)[number];
export type LeadBudgetComfortCode = (typeof LEAD_BUDGET_COMFORT_CODES)[number];

export const SERVICE_ENQUIRY_COPY_VERSION = "service-enquiry-v0.1-draft" as const;
export const SERVICE_COMMUNICATION_COPY_VERSION =
  "service-communication-v0.1-draft" as const;
export const WHATSAPP_COPY_VERSION = "whatsapp-service-v0.1-draft" as const;
export const MARKETING_COPY_VERSION = "marketing-v0.1-draft" as const;

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
    readonly serviceCommunication: true;
    readonly whatsappService?: boolean;
    readonly marketing?: boolean;
    readonly serviceEnquiryCopyVersion: string;
    readonly serviceCommunicationCopyVersion: string;
    readonly whatsappCopyVersion?: string;
    readonly marketingCopyVersion?: string;
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
  };
  readonly antiBot: {
    readonly website: string;
    readonly formStartedAt: string;
  };
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
  readonly consentWhatsapp: boolean;
  readonly consentMarketing: boolean;
  readonly copyServiceEnquiry: string;
  readonly copyServiceCommunication: string;
  readonly copyWhatsapp: string | null;
  readonly copyMarketing: string | null;
  readonly noticeVersion: string;
  readonly formStartedAt: string;
}
