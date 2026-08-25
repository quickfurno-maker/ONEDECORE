/**
 * Phase 5C2B — manual lead creation contracts.
 */

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
} from "../../lead-intake/planner-allowlist.ts";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const E164_PATTERN = /^\+[1-9]\d{1,14}$/;

export const MANUAL_LEAD_DUPLICATE_OUTCOMES = [
  "CLEAR",
  "REUSABLE_CONTACT",
  "ACTIVE_DUPLICATE",
  "RECENT_SIMILAR",
  "CONTACT_IDENTITY_CONFLICT",
] as const;

export type ManualLeadDuplicateOutcomeCode =
  (typeof MANUAL_LEAD_DUPLICATE_OUTCOMES)[number];

export interface ManualLeadDuplicatePreview {
  readonly outcomeCode: ManualLeadDuplicateOutcomeCode;
  readonly canCreate: boolean;
  readonly canOverride: boolean;
  readonly existingLeadId: string | null;
}

export type ManualCreateAssigneePolicy =
  | { readonly mode: "executive_self" }
  | { readonly mode: "manager"; readonly allowSelf: true }
  | { readonly mode: "admin"; readonly allowSelf: false };

export interface ManualLeadFormInput {
  readonly submittedName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly serviceCode: LeadServiceCode;
  readonly propertyCode: LeadPropertyCode;
  readonly timelineCode: LeadTimelineCode;
  readonly primarySourceId: string;
  readonly locality: string | null;
  readonly budgetComfortCode: LeadBudgetComfortCode | null;
  readonly roomCodes: readonly LeadRoomCode[];
  readonly message: string | null;
  readonly sourceDetail: string | null;
  readonly assigneeId: string | null;
  readonly duplicateOverride: boolean;
  readonly duplicateOverrideReason: string | null;
}

export interface ManualLeadValidationError {
  readonly field: string;
  readonly message: string;
}

export interface ManualLeadDuplicatePreviewInput {
  readonly phone: string | null;
  readonly email: string | null;
  readonly serviceCode: LeadServiceCode;
  readonly propertyCode: LeadPropertyCode;
  readonly locality: string | null;
}

export function isUuid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isAllowed<T extends string>(
  value: string,
  allowed: readonly T[]
): value is T {
  return (allowed as readonly string[]).includes(value);
}

export function validateManualLeadDuplicatePreviewInput(
  input: ManualLeadDuplicatePreviewInput
): readonly ManualLeadValidationError[] {
  const errors: ManualLeadValidationError[] = [];
  const phone = normalizeOptionalText(input.phone);
  const email = normalizeOptionalText(input.email);

  if (!phone && !email) {
    errors.push({
      field: "contact",
      message: "Provide a phone number or email address.",
    });
  }

  if (phone && !E164_PATTERN.test(phone)) {
    errors.push({
      field: "phone",
      message: "Phone must be in E.164 format (for example +919876543210).",
    });
  }

  if (!isAllowed(input.serviceCode, LEAD_SERVICE_CODES)) {
    errors.push({ field: "serviceCode", message: "Select a valid service." });
  }

  if (!isAllowed(input.propertyCode, LEAD_PROPERTY_CODES)) {
    errors.push({
      field: "propertyCode",
      message: "Select a valid property type.",
    });
  }

  const locality = normalizeOptionalText(input.locality);
  if (locality && locality.length > 120) {
    errors.push({
      field: "locality",
      message: "Locality must be 120 characters or fewer.",
    });
  }

  return errors;
}

export function validateManualLeadFormInput(
  input: ManualLeadFormInput,
  policy: ManualCreateAssigneePolicy
): readonly ManualLeadValidationError[] {
  const errors = [
    ...validateManualLeadDuplicatePreviewInput({
      phone: input.phone,
      email: input.email,
      serviceCode: input.serviceCode,
      propertyCode: input.propertyCode,
      locality: input.locality,
    }),
  ];

  const name = normalizeOptionalText(input.submittedName);
  if (!name || name.length < 2 || name.length > 120) {
    errors.push({
      field: "submittedName",
      message: "Client name must be between 2 and 120 characters.",
    });
  }

  const email = normalizeOptionalText(input.email);
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    errors.push({ field: "email", message: "Enter a valid email address." });
  }

  if (!isAllowed(input.timelineCode, LEAD_TIMELINE_CODES)) {
    errors.push({ field: "timelineCode", message: "Select a valid timeline." });
  }

  if (!isUuid(input.primarySourceId)) {
    errors.push({
      field: "primarySourceId",
      message: "Select a valid lead source.",
    });
  }

  if (
    input.budgetComfortCode !== null &&
    !isAllowed(input.budgetComfortCode, LEAD_BUDGET_COMFORT_CODES)
  ) {
    errors.push({
      field: "budgetComfortCode",
      message: "Select a valid budget comfort range.",
    });
  }

  if (input.roomCodes.length > 6) {
    errors.push({
      field: "roomCodes",
      message: "Select up to six room types.",
    });
  }

  for (const room of input.roomCodes) {
    if (!isAllowed(room, LEAD_ROOM_CODES)) {
      errors.push({
        field: "roomCodes",
        message: "One or more selected rooms are invalid.",
      });
      break;
    }
  }

  const message = normalizeOptionalText(input.message);
  if (message && message.length > 2000) {
    errors.push({
      field: "message",
      message: "Enquiry message must be 2000 characters or fewer.",
    });
  }

  const sourceDetail = normalizeOptionalText(input.sourceDetail);
  if (sourceDetail && sourceDetail.length > 500) {
    errors.push({
      field: "sourceDetail",
      message: "Source detail must be 500 characters or fewer.",
    });
  }

  if (policy.mode === "executive_self") {
    if (input.assigneeId !== null) {
      errors.push({
        field: "assigneeId",
        message: "Sales executives cannot choose another assignee.",
      });
    }
  } else if (input.assigneeId !== null && !isUuid(input.assigneeId)) {
    errors.push({
      field: "assigneeId",
      message: "Assignee identifier is invalid.",
    });
  }

  if (input.duplicateOverride) {
    const reason = normalizeOptionalText(input.duplicateOverrideReason);
    if (!reason || reason.length < 10 || reason.length > 500) {
      errors.push({
        field: "duplicateOverrideReason",
        message: "Override reason must be between 10 and 500 characters.",
      });
    }
  }

  return errors;
}

export const MANUAL_LEAD_CATALOG_LABELS = {
  service: {
    "complete-home-interiors": "Complete Home Interiors",
    "modular-kitchens": "Modular Kitchens",
    "custom-wardrobes": "Custom Wardrobes",
  },
  property: {
    "apartment-1bhk": "Apartment — 1 BHK",
    "apartment-2bhk": "Apartment — 2 BHK",
    "apartment-3bhk": "Apartment — 3 BHK",
    "apartment-4bhk-plus": "Apartment — 4 BHK+",
    "villa-rowhouse": "Villa / Row House",
    "single-room": "Single Room",
  },
  timeline: {
    immediate: "Immediate",
    "within-1-month": "Within 1 month",
    "within-2-months": "Within 2 months",
    "after-2-months": "After 2 months",
  },
  budget: {
    "under-3l": "Under ₹3L",
    "3-6l": "₹3–6L",
    "6-12l": "₹6–12L",
    "12-20l": "₹12–20L",
    "20-30l": "₹20–30L",
    "30l-plus": "₹30L+",
  },
  room: {
    living: "Living",
    kitchen: "Kitchen",
    bedrooms: "Bedrooms",
    wardrobes: "Wardrobes",
    dining: "Dining",
    other: "Other",
  },
} as const;
