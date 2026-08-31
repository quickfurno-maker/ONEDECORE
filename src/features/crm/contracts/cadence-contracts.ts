/**
 * CRM 2C — cadence playbook contracts (mirror the 20260830140000 migration).
 *
 * A cadence schedules canonical CRM Activities for a human to perform. It is not
 * marketing automation: nothing here sends a message, and a `whatsapp` step is an
 * internal task only.
 */

import { isUuid } from "./assignment-contracts.ts";
import {
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_TYPES,
  type CrmActivityPriority,
  type CrmActivityType,
} from "./activity-contracts.ts";

export const CRM_CADENCE_TEMPLATE_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;
export type CrmCadenceTemplateStatus =
  (typeof CRM_CADENCE_TEMPLATE_STATUSES)[number];

export const CRM_CADENCE_ENROLLMENT_STATUSES = [
  "active",
  "paused",
  "completed",
  "stopped",
] as const;
export type CrmCadenceEnrollmentStatus =
  (typeof CRM_CADENCE_ENROLLMENT_STATUSES)[number];

export const CRM_CADENCE_STOP_REASONS = [
  "lead_closed_won",
  "lead_closed_lost",
  "owner_not_operable",
  "manual_override",
  "cancelled_by_user",
] as const;
export type CrmCadenceStopReason = (typeof CRM_CADENCE_STOP_REASONS)[number];

export const CRM_CADENCE_MAX_STEPS = 50;
export const CRM_CADENCE_MAX_DELAY_HOURS = 2160;
export const CRM_CADENCE_MAX_REMINDER_OFFSET_MINUTES = 10080;
const NAME_MIN = 2;
const NAME_MAX = 120;
const DESCRIPTION_MAX = 500;
const TITLE_MIN = 1;
const TITLE_MAX = 120;
const DURATION_MIN = 1;
const DURATION_MAX = 1440;

export interface CadenceFieldError {
  readonly field: string;
  readonly message: string;
}

export interface CrmCadenceStep {
  readonly id: string;
  readonly stepOrder: number;
  readonly delayHours: number;
  readonly activityType: CrmActivityType;
  readonly title: string;
  readonly priority: CrmActivityPriority;
  readonly durationMinutes: number | null;
  readonly reminderOffsetMinutes: number | null;
}

/** Step payload before it has an identity (draft editor input). */
export interface CrmCadenceStepInput {
  readonly activityType: CrmActivityType;
  readonly title: string;
  readonly priority: CrmActivityPriority;
  readonly delayHours: number;
  readonly durationMinutes: number | null;
  readonly reminderOffsetMinutes: number | null;
}

export interface CrmCadenceTemplateSummary {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: CrmCadenceTemplateStatus;
  readonly stepCount: number;
  readonly activeEnrollmentCount: number;
  readonly updatedAt: string;
}

export interface CrmCadenceTemplateDetail extends CrmCadenceTemplateSummary {
  readonly steps: readonly CrmCadenceStep[];
  readonly publishedAt: string | null;
  readonly archivedAt: string | null;
}

export interface CrmCadenceEnrollmentEvent {
  readonly id: string;
  readonly eventType: string;
  readonly reasonCode: string | null;
  readonly createdAt: string;
}

/** Cadence state rendered on lead detail. */
export interface CrmLeadCadenceState {
  readonly enrollmentId: string;
  readonly templateId: string;
  readonly templateName: string;
  readonly status: CrmCadenceEnrollmentStatus;
  readonly stopReason: CrmCadenceStopReason | null;
  readonly currentStepOrder: number | null;
  readonly totalSteps: number;
  readonly currentStepTitle: string | null;
  readonly upcomingStepTitle: string | null;
  readonly upcomingStepDelayHours: number | null;
  readonly enrolledAt: string;
  readonly history: readonly CrmCadenceEnrollmentEvent[];
}

export interface CadenceActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly templateId?: string;
}

export const INITIAL_CADENCE_ACTION_STATE: CadenceActionState = {
  success: false,
  message: "",
};

export function isCadenceTemplateStatus(
  value: unknown
): value is CrmCadenceTemplateStatus {
  return (
    typeof value === "string" &&
    (CRM_CADENCE_TEMPLATE_STATUSES as readonly string[]).includes(value)
  );
}

export function isCadenceEnrollmentStatus(
  value: unknown
): value is CrmCadenceEnrollmentStatus {
  return (
    typeof value === "string" &&
    (CRM_CADENCE_ENROLLMENT_STATUSES as readonly string[]).includes(value)
  );
}

/** Only a live enrollment may advance; everything else is read-only history. */
export function isLiveCadenceEnrollment(
  status: CrmCadenceEnrollmentStatus
): boolean {
  return status === "active" || status === "paused";
}

export function formatCadenceStatusLabel(
  status: CrmCadenceEnrollmentStatus
): string {
  switch (status) {
    case "active":
      return "Active";
    case "paused":
      return "Paused";
    case "completed":
      return "Completed";
    case "stopped":
      return "Stopped";
  }
}

export function formatCadenceStopReasonLabel(
  reason: CrmCadenceStopReason | null
): string | null {
  switch (reason) {
    case "lead_closed_won":
      return "Lead closed won";
    case "lead_closed_lost":
      return "Lead closed lost";
    case "owner_not_operable":
      return "Lead owner no longer eligible";
    case "manual_override":
      return "Next action chosen manually";
    case "cancelled_by_user":
      return "Cancelled";
    default:
      return null;
  }
}

/** Human label for a step offset. Storage stays in whole hours. */
export function formatCadenceDelayLabel(delayHours: number): string {
  if (delayHours <= 0) {
    return "Immediately";
  }
  if (delayHours < 24) {
    return `${delayHours} hour${delayHours === 1 ? "" : "s"} later`;
  }
  const days = Math.floor(delayHours / 24);
  const hours = delayHours % 24;
  const dayLabel = `${days} day${days === 1 ? "" : "s"}`;
  return hours === 0 ? `${dayLabel} later` : `${dayLabel} ${hours}h later`;
}

function parseIntegerOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

export function parseCadenceActivityType(
  value: unknown
): CrmActivityType | null {
  const raw = String(value ?? "").trim();
  return (CRM_ACTIVITY_TYPES as readonly string[]).includes(raw)
    ? (raw as CrmActivityType)
    : null;
}

export function parseCadencePriority(
  value: unknown
): CrmActivityPriority | null {
  const raw = String(value ?? "").trim();
  return (CRM_ACTIVITY_PRIORITIES as readonly string[]).includes(raw)
    ? (raw as CrmActivityPriority)
    : null;
}

export interface CadenceTemplateInput {
  readonly name: string;
  readonly description: string | null;
}

export function normalizeCadenceTemplateInput(raw: {
  name: unknown;
  description?: unknown;
}): CadenceTemplateInput {
  const description = String(raw.description ?? "").trim();
  return {
    name: String(raw.name ?? "").trim(),
    description: description.length === 0 ? null : description,
  };
}

export function validateCadenceTemplateInput(
  input: CadenceTemplateInput
): readonly CadenceFieldError[] {
  const errors: CadenceFieldError[] = [];
  if (input.name.length < NAME_MIN || input.name.length > NAME_MAX) {
    errors.push({
      field: "name",
      message: `Cadence name must be ${NAME_MIN}–${NAME_MAX} characters.`,
    });
  }
  if (input.description != null && input.description.length > DESCRIPTION_MAX) {
    errors.push({
      field: "description",
      message: `Description must be at most ${DESCRIPTION_MAX} characters.`,
    });
  }
  return errors;
}

/**
 * Parses the ordered step editor payload. Order is positional — the array index
 * becomes step_order, so the DB never stores a client-supplied ordinal.
 */
export function normalizeCadenceStepInputs(
  rows: readonly {
    activityType: unknown;
    title: unknown;
    priority?: unknown;
    delayHours: unknown;
    durationMinutes?: unknown;
    reminderOffsetMinutes?: unknown;
  }[]
): readonly CrmCadenceStepInput[] {
  return rows.map((row) => ({
    activityType:
      parseCadenceActivityType(row.activityType) ?? ("call" as CrmActivityType),
    title: String(row.title ?? "").trim(),
    priority: parseCadencePriority(row.priority) ?? ("normal" as CrmActivityPriority),
    delayHours: parseIntegerOrNull(row.delayHours) ?? Number.NaN,
    durationMinutes: parseIntegerOrNull(row.durationMinutes),
    reminderOffsetMinutes: parseIntegerOrNull(row.reminderOffsetMinutes),
  }));
}

export function validateCadenceStepInputs(
  steps: readonly CrmCadenceStepInput[]
): readonly CadenceFieldError[] {
  const errors: CadenceFieldError[] = [];

  if (steps.length === 0) {
    errors.push({ field: "steps", message: "Add at least one cadence step." });
    return errors;
  }
  if (steps.length > CRM_CADENCE_MAX_STEPS) {
    errors.push({
      field: "steps",
      message: `A cadence can hold at most ${CRM_CADENCE_MAX_STEPS} steps.`,
    });
    return errors;
  }

  steps.forEach((step, index) => {
    const position = index + 1;
    if (!parseCadenceActivityType(step.activityType)) {
      errors.push({
        field: `steps.${index}.activityType`,
        message: `Step ${position}: activity type is invalid.`,
      });
    }
    if (step.title.length < TITLE_MIN || step.title.length > TITLE_MAX) {
      errors.push({
        field: `steps.${index}.title`,
        message: `Step ${position}: title must be ${TITLE_MIN}–${TITLE_MAX} characters.`,
      });
    }
    if (!parseCadencePriority(step.priority)) {
      errors.push({
        field: `steps.${index}.priority`,
        message: `Step ${position}: priority is invalid.`,
      });
    }
    if (
      !Number.isInteger(step.delayHours) ||
      step.delayHours < 0 ||
      step.delayHours > CRM_CADENCE_MAX_DELAY_HOURS
    ) {
      errors.push({
        field: `steps.${index}.delayHours`,
        message: `Step ${position}: delay must be 0–${CRM_CADENCE_MAX_DELAY_HOURS} hours.`,
      });
    }
    if (
      step.durationMinutes != null &&
      (!Number.isInteger(step.durationMinutes) ||
        step.durationMinutes < DURATION_MIN ||
        step.durationMinutes > DURATION_MAX)
    ) {
      errors.push({
        field: `steps.${index}.durationMinutes`,
        message: `Step ${position}: duration must be ${DURATION_MIN}–${DURATION_MAX} minutes.`,
      });
    }
    if (
      step.reminderOffsetMinutes != null &&
      (!Number.isInteger(step.reminderOffsetMinutes) ||
        step.reminderOffsetMinutes < 0 ||
        step.reminderOffsetMinutes > CRM_CADENCE_MAX_REMINDER_OFFSET_MINUTES)
    ) {
      errors.push({
        field: `steps.${index}.reminderOffsetMinutes`,
        message: `Step ${position}: reminder offset must be 0–${CRM_CADENCE_MAX_REMINDER_OFFSET_MINUTES} minutes.`,
      });
    }
  });

  return errors;
}

/** Maps validated steps to the RPC transport array (plain records only). */
export function cadenceStepInputsToRpcPayload(
  steps: readonly CrmCadenceStepInput[]
): readonly Record<string, string | number | null>[] {
  return steps.map((step) => ({
    activityType: step.activityType,
    title: step.title,
    priority: step.priority,
    delayHours: step.delayHours,
    durationMinutes: step.durationMinutes,
    reminderOffsetMinutes: step.reminderOffsetMinutes,
  }));
}

export interface EnrollLeadInCadenceInput {
  readonly leadId: string;
  readonly templateId: string;
}

export function validateEnrollLeadInCadenceInput(
  input: EnrollLeadInCadenceInput
): readonly CadenceFieldError[] {
  const errors: CadenceFieldError[] = [];
  if (!isUuid(input.leadId)) {
    errors.push({ field: "leadId", message: "Lead identifier is invalid." });
  }
  if (!isUuid(input.templateId)) {
    errors.push({
      field: "templateId",
      message: "Select a published cadence.",
    });
  }
  return errors;
}

export function validateCadenceEnrollmentId(
  enrollmentId: string
): readonly CadenceFieldError[] {
  return isUuid(enrollmentId)
    ? []
    : [
        {
          field: "enrollmentId",
          message: "Cadence enrollment identifier is invalid.",
        },
      ];
}

export function cadenceFieldErrorsToRecord(
  errors: readonly CadenceFieldError[]
): Record<string, string> {
  return Object.fromEntries(errors.map((entry) => [entry.field, entry.message]));
}
