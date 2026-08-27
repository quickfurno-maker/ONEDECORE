/**
 * CRM 2A-4 — activity domain contracts (mirror DB 2A-1 / 2A-3).
 */

import { isUuid } from "./assignment-contracts.ts";

export const CRM_ACTIVITY_TYPES = [
  "call",
  "whatsapp",
  "consultation",
  "site_visit",
  "quotation_follow_up",
  "internal_task",
] as const;
export type CrmActivityType = (typeof CRM_ACTIVITY_TYPES)[number];

export const CRM_ACTIVITY_PRIORITIES = [
  "low",
  "normal",
  "high",
  "urgent",
] as const;
export type CrmActivityPriority = (typeof CRM_ACTIVITY_PRIORITIES)[number];

export const CRM_ACTIVITY_STATUSES = [
  "open",
  "completed",
  "cancelled",
] as const;
export type CrmActivityStatus = (typeof CRM_ACTIVITY_STATUSES)[number];

export const CRM_ACTIVITY_RESOLUTIONS = [
  "NONE",
  "NEXT_PRIMARY",
  "ON_HOLD",
  "CLOSED_LOST",
] as const;
export type CrmActivityResolution = (typeof CRM_ACTIVITY_RESOLUTIONS)[number];

export const CRM_ACTIVITY_SOURCES = [
  "manual",
  "completion_chain",
  "on_hold_review",
  "sla_auto",
  "import",
] as const;
export type CrmActivitySource = (typeof CRM_ACTIVITY_SOURCES)[number];

export interface ActivityFieldError {
  readonly field: string;
  readonly message: string;
}

export interface CreateLeadActivityInput {
  readonly leadId: string;
  readonly activityType: CrmActivityType;
  readonly title: string;
  readonly dueAt: string;
  readonly priority: CrmActivityPriority;
  readonly ownerId: string | null;
  readonly isPrimary: boolean;
  readonly durationMinutes: number | null;
  readonly reminderAt: string | null;
  readonly quotationId: string | null;
}

export interface RescheduleLeadActivityInput {
  readonly activityId: string;
  readonly dueAt: string;
  readonly reminderAt: string | null;
  readonly clearReminder: boolean;
}

export interface TransferActivityOwnershipInput {
  readonly activityId: string;
  readonly newOwnerId: string;
}

export interface DesignatePrimaryNextActionInput {
  readonly activityId: string;
}

interface CompleteLeadActivityBase {
  readonly activityId: string;
  readonly outcomeCode: string;
  readonly completionNote: string | null;
  readonly whatsappSendIntentId: string | null;
}

export type CompleteLeadActivityInput =
  | (CompleteLeadActivityBase & { readonly resolution: "NONE" })
  | (CompleteLeadActivityBase & {
      readonly resolution: "NEXT_PRIMARY";
      readonly nextActivityType: CrmActivityType;
      readonly nextTitle: string;
      readonly nextDueAt: string;
      readonly nextPriority: CrmActivityPriority;
      readonly nextDurationMinutes: number | null;
      readonly nextReminderAt: string | null;
      readonly nextQuotationId: string | null;
    })
  | (CompleteLeadActivityBase & {
      readonly resolution: "ON_HOLD";
      readonly onHoldReason: string;
      readonly onHoldReviewAt: string;
    })
  | (CompleteLeadActivityBase & {
      readonly resolution: "CLOSED_LOST";
      readonly closedLostReason: string;
      readonly closureReasonCode: string | null;
    });

export interface CrmActivityOutcomeOption {
  readonly code: string;
  readonly displayName: string;
  readonly activityTypes: readonly string[];
  readonly closesContactAttempt: boolean;
  readonly displayOrder: number;
}

export interface CrmActivityMutationResult {
  readonly id: string;
  readonly leadId: string;
  readonly status: string;
  readonly dueAt: string;
  readonly ownerId: string;
  readonly activityType: string;
  readonly title: string;
  readonly priority: string;
  readonly isPrimaryNextAction: boolean;
  readonly outcomeCode: string | null;
  readonly resolution?: CrmActivityResolution;
}

export interface CrmActivityActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
  readonly activityId?: string;
  readonly leadId?: string;
}

export const INITIAL_CRM_ACTIVITY_ACTION_STATE: CrmActivityActionState = {
  success: false,
  message: "",
};

const TITLE_MIN = 1;
const TITLE_MAX = 120;
const DURATION_MIN = 1;
const DURATION_MAX = 1440;
const NOTE_MAX = 1000;

export function parseActivityType(value: unknown): CrmActivityType | null {
  if (typeof value !== "string") {
    return null;
  }
  return (CRM_ACTIVITY_TYPES as readonly string[]).includes(value)
    ? (value as CrmActivityType)
    : null;
}

export function parseActivityPriority(
  value: unknown
): CrmActivityPriority | null {
  if (typeof value !== "string") {
    return null;
  }
  return (CRM_ACTIVITY_PRIORITIES as readonly string[]).includes(value)
    ? (value as CrmActivityPriority)
    : null;
}

export function parseActivityResolution(
  value: unknown
): CrmActivityResolution | null {
  if (typeof value !== "string") {
    return null;
  }
  const upper = value.trim().toUpperCase();
  return (CRM_ACTIVITY_RESOLUTIONS as readonly string[]).includes(upper)
    ? (upper as CrmActivityResolution)
    : null;
}

export function parseRequiredUuid(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const raw = String(value).trim();
  return isUuid(raw) ? raw : null;
}

export function parseNullableUuid(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const raw = String(value).trim();
  if (raw.length === 0 || raw === "null") {
    return null;
  }
  return isUuid(raw) ? raw : null;
}

export function parseBooleanFormValue(value: unknown): boolean | null {
  if (typeof value === "boolean") {
    return value;
  }
  if (value == null) {
    return null;
  }
  const raw = String(value).trim().toLowerCase();
  if (raw === "true" || raw === "1" || raw === "on") {
    return true;
  }
  if (raw === "false" || raw === "0" || raw === "off") {
    return false;
  }
  return null;
}

export function parseIntegerFormValue(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  const raw = String(value).trim();
  if (!/^-?\d+$/.test(raw)) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isSafeInteger(parsed) ? parsed : null;
}

const ABSOLUTE_TIMESTAMP_SUFFIX = /(?:Z|[+-]\d{2}:\d{2})$/;

/** Requires `Z` or explicit numeric offset — rejects timezone-less local strings. */
export function parseIsoTimestamp(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const raw = String(value).trim();
  if (raw.length === 0) {
    return null;
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return null;
  }
  if (!ABSOLUTE_TIMESTAMP_SUFFIX.test(raw)) {
    return null;
  }
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    return null;
  }
  return new Date(ms).toISOString();
}

type FieldParseResult<T> =
  | { readonly kind: "absent" }
  | { readonly kind: "value"; readonly value: T }
  | { readonly kind: "error"; readonly message: string };

export type ActivityFormParseResult<T> =
  | { readonly success: true; readonly input: T }
  | {
      readonly success: false;
      readonly message: string;
      readonly code: "VALIDATION_FAILED" | "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE";
      readonly fieldErrors: Readonly<Record<string, string>>;
    };

function trimFormValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  return String(value).trim();
}

function isFormValueAbsent(value: unknown): boolean {
  const raw = trimFormValue(value);
  return raw.length === 0 || raw === "null";
}

function isFormValuePresent(value: unknown): boolean {
  return !isFormValueAbsent(value);
}

function pushFieldParseError(
  errors: ActivityFieldError[],
  field: string,
  result: FieldParseResult<unknown>
): void {
  if (result.kind === "error") {
    errors.push({ field, message: result.message });
  }
}

function parseRequiredString(
  value: unknown,
  field: string,
  message = `${field} is required.`
): FieldParseResult<string> {
  if (isFormValueAbsent(value)) {
    return { kind: "error", message };
  }
  return { kind: "value", value: trimFormValue(value) };
}

function parseRequiredActivityType(value: unknown): FieldParseResult<CrmActivityType> {
  const raw = parseRequiredString(
    value,
    "activityType",
    "Activity type is required."
  );
  if (raw.kind === "error") {
    return raw;
  }
  if (raw.kind !== "value") {
    return { kind: "error", message: "Activity type is required." };
  }
  const parsed = parseActivityType(raw.value);
  if (!parsed) {
    return { kind: "error", message: "Activity type is invalid." };
  }
  return { kind: "value", value: parsed };
}

function parseRequiredActivityTypeField(
  value: unknown,
  requiredMessage: string,
  invalidMessage = "Activity type is invalid."
): FieldParseResult<CrmActivityType> {
  if (isFormValueAbsent(value)) {
    return { kind: "error", message: requiredMessage };
  }
  const parsed = parseActivityType(trimFormValue(value));
  if (!parsed) {
    return { kind: "error", message: invalidMessage };
  }
  return { kind: "value", value: parsed };
}

function parseOptionalPriorityWithDefault(
  value: unknown,
  invalidMessage = "Priority is invalid."
): FieldParseResult<CrmActivityPriority> {
  if (isFormValueAbsent(value)) {
    return { kind: "value", value: "normal" };
  }
  const parsed = parseActivityPriority(trimFormValue(value));
  if (!parsed) {
    return { kind: "error", message: invalidMessage };
  }
  return { kind: "value", value: parsed };
}

function parseOptionalBooleanWithDefault(
  value: unknown,
  defaultValue: boolean,
  invalidMessage: string
): FieldParseResult<boolean> {
  if (isFormValueAbsent(value)) {
    return { kind: "value", value: defaultValue };
  }
  const parsed = parseBooleanFormValue(value);
  if (parsed === null) {
    return { kind: "error", message: invalidMessage };
  }
  return { kind: "value", value: parsed };
}

function parseOptionalIntegerField(
  value: unknown
): FieldParseResult<number | null> {
  if (isFormValueAbsent(value)) {
    return { kind: "value", value: null };
  }
  const parsed = parseIntegerFormValue(value);
  if (parsed === null) {
    return { kind: "error", message: "Duration must be a whole number." };
  }
  return { kind: "value", value: parsed };
}

function parseOptionalUuidField(
  value: unknown,
  invalidMessage: string
): FieldParseResult<string | null> {
  if (isFormValueAbsent(value)) {
    return { kind: "value", value: null };
  }
  const raw = trimFormValue(value);
  if (!isUuid(raw)) {
    return { kind: "error", message: invalidMessage };
  }
  return { kind: "value", value: raw };
}

function parseRequiredAbsoluteTimestampField(
  value: unknown
): FieldParseResult<string> {
  if (isFormValueAbsent(value)) {
    return {
      kind: "error",
      message: "Due date and time are required.",
    };
  }
  const parsed = parseIsoTimestamp(trimFormValue(value));
  if (!parsed) {
    return {
      kind: "error",
      message:
        "Date and time must be an absolute ISO timestamp with Z or a numeric offset.",
    };
  }
  return { kind: "value", value: parsed };
}

function parseOptionalAbsoluteTimestampField(
  value: unknown
): FieldParseResult<string | null> {
  if (isFormValueAbsent(value)) {
    return { kind: "value", value: null };
  }
  const parsed = parseIsoTimestamp(trimFormValue(value));
  if (!parsed) {
    return {
      kind: "error",
      message:
        "Date and time must be an absolute ISO timestamp with Z or a numeric offset.",
    };
  }
  return { kind: "value", value: parsed };
}

function formFailure(
  fieldErrors: readonly ActivityFieldError[],
  code: "VALIDATION_FAILED" | "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE" = "VALIDATION_FAILED"
): ActivityFormParseResult<never> {
  const record = activityFieldErrorsToRecord(fieldErrors);
  return {
    success: false,
    code,
    message: fieldErrors[0]?.message ?? "Validation failed.",
    fieldErrors: record,
  };
}

function closedWonFailure(): ActivityFormParseResult<never> {
  return {
    success: false,
    code: "CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE",
    message: "Closed Won is created only through accepted quotation.",
    fieldErrors: {},
  };
}

function trimNullableText(value: unknown): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed.length === 0 ? null : trimmed;
}

function isFutureIso(iso: string, nowMs: number = Date.now()): boolean {
  const ms = Date.parse(iso);
  return !Number.isNaN(ms) && ms > nowMs;
}

function pushDurationError(
  errors: ActivityFieldError[],
  field: string,
  durationMinutes: number | null
): void {
  if (
    durationMinutes != null &&
    (durationMinutes < DURATION_MIN || durationMinutes > DURATION_MAX)
  ) {
    errors.push({
      field,
      message: `Duration must be between ${DURATION_MIN} and ${DURATION_MAX} minutes.`,
    });
  }
}

function pushReminderError(
  errors: ActivityFieldError[],
  field: string,
  reminderAt: string | null,
  dueAt: string
): void {
  if (reminderAt == null) {
    return;
  }
  const reminderMs = Date.parse(reminderAt);
  const dueMs = Date.parse(dueAt);
  if (Number.isNaN(reminderMs) || Number.isNaN(dueMs) || reminderMs > dueMs) {
    errors.push({
      field,
      message: "Reminder must be at or before the due time.",
    });
  }
}

export function activityFieldErrorsToRecord(
  errors: readonly ActivityFieldError[]
): Record<string, string> {
  return Object.fromEntries(errors.map((entry) => [entry.field, entry.message]));
}

const CROSS_RESOLUTION_MESSAGE =
  "Resolution payload includes fields that are not allowed for the selected resolution.";

type CompleteLeadActivityFormRaw = {
  activityId: unknown;
  outcomeCode: unknown;
  completionNote?: unknown;
  whatsappSendIntentId?: unknown;
  resolution: unknown;
  nextActivityType?: unknown;
  nextTitle?: unknown;
  nextDueAt?: unknown;
  nextPriority?: unknown;
  nextDurationMinutes?: unknown;
  nextReminderAt?: unknown;
  nextQuotationId?: unknown;
  onHoldReason?: unknown;
  onHoldReviewAt?: unknown;
  closedLostReason?: unknown;
  closureReasonCode?: unknown;
};

function hasNextPrimaryPayload(raw: CompleteLeadActivityFormRaw): boolean {
  return (
    isFormValuePresent(raw.nextActivityType) ||
    isFormValuePresent(raw.nextTitle) ||
    isFormValuePresent(raw.nextDueAt) ||
    isFormValuePresent(raw.nextPriority) ||
    isFormValuePresent(raw.nextDurationMinutes) ||
    isFormValuePresent(raw.nextReminderAt) ||
    isFormValuePresent(raw.nextQuotationId)
  );
}

function hasOnHoldPayload(raw: CompleteLeadActivityFormRaw): boolean {
  return (
    isFormValuePresent(raw.onHoldReason) ||
    isFormValuePresent(raw.onHoldReviewAt)
  );
}

function hasClosedLostPayload(raw: CompleteLeadActivityFormRaw): boolean {
  return (
    isFormValuePresent(raw.closedLostReason) ||
    isFormValuePresent(raw.closureReasonCode)
  );
}

function crossResolutionFieldErrors(
  resolution: CrmActivityResolution,
  raw: CompleteLeadActivityFormRaw
): ActivityFieldError[] {
  const hasNext = hasNextPrimaryPayload(raw);
  const hasOnHold = hasOnHoldPayload(raw);
  const hasClosedLost = hasClosedLostPayload(raw);

  if (resolution === "NONE" && (hasNext || hasOnHold || hasClosedLost)) {
    return [{ field: "resolution", message: CROSS_RESOLUTION_MESSAGE }];
  }
  if (resolution === "NEXT_PRIMARY" && (hasOnHold || hasClosedLost)) {
    return [{ field: "resolution", message: CROSS_RESOLUTION_MESSAGE }];
  }
  if (resolution === "ON_HOLD" && (hasNext || hasClosedLost)) {
    return [{ field: "resolution", message: CROSS_RESOLUTION_MESSAGE }];
  }
  if (resolution === "CLOSED_LOST" && (hasNext || hasOnHold)) {
    return [{ field: "resolution", message: CROSS_RESOLUTION_MESSAGE }];
  }
  return [];
}

function unwrapFieldValue<T>(result: FieldParseResult<T>): T {
  if (result.kind !== "value") {
    throw new Error("Expected parsed field value.");
  }
  return result.value;
}

export function parseCreateLeadActivityForm(raw: {
  leadId: unknown;
  activityType: unknown;
  title: unknown;
  dueAt: unknown;
  priority?: unknown;
  ownerId?: unknown;
  isPrimary?: unknown;
  durationMinutes?: unknown;
  reminderAt?: unknown;
  quotationId?: unknown;
}): ActivityFormParseResult<CreateLeadActivityInput> {
  const errors: ActivityFieldError[] = [];

  const activityType = parseRequiredActivityType(raw.activityType);
  pushFieldParseError(errors, "activityType", activityType);

  const priority = parseOptionalPriorityWithDefault(raw.priority);
  pushFieldParseError(errors, "priority", priority);

  const dueAt = parseRequiredAbsoluteTimestampField(raw.dueAt);
  pushFieldParseError(errors, "dueAt", dueAt);

  const isPrimary = parseOptionalBooleanWithDefault(
    raw.isPrimary,
    false,
    "Primary flag is invalid."
  );
  pushFieldParseError(errors, "isPrimary", isPrimary);

  const durationMinutes = parseOptionalIntegerField(raw.durationMinutes);
  pushFieldParseError(errors, "durationMinutes", durationMinutes);

  const ownerId = parseOptionalUuidField(
    raw.ownerId,
    "Owner identifier is invalid."
  );
  pushFieldParseError(errors, "ownerId", ownerId);

  const reminderAt = parseOptionalAbsoluteTimestampField(raw.reminderAt);
  pushFieldParseError(errors, "reminderAt", reminderAt);

  const quotationId = parseOptionalUuidField(
    raw.quotationId,
    "Quotation identifier is invalid."
  );
  pushFieldParseError(errors, "quotationId", quotationId);

  if (errors.length > 0) {
    return formFailure(errors);
  }

  const input: CreateLeadActivityInput = {
    leadId: trimFormValue(raw.leadId),
    activityType: unwrapFieldValue(activityType),
    title: trimFormValue(raw.title),
    dueAt: unwrapFieldValue(dueAt),
    priority: unwrapFieldValue(priority),
    ownerId: unwrapFieldValue(ownerId),
    isPrimary: unwrapFieldValue(isPrimary),
    durationMinutes: unwrapFieldValue(durationMinutes),
    reminderAt: unwrapFieldValue(reminderAt),
    quotationId: unwrapFieldValue(quotationId),
  };

  const semanticErrors = validateCreateLeadActivityInput(input);
  if (semanticErrors.length > 0) {
    return formFailure(semanticErrors);
  }

  return { success: true, input };
}

export function parseRescheduleLeadActivityForm(raw: {
  activityId: unknown;
  dueAt: unknown;
  reminderAt?: unknown;
  clearReminder?: unknown;
}): ActivityFormParseResult<RescheduleLeadActivityInput> {
  const errors: ActivityFieldError[] = [];

  const clearReminder = parseOptionalBooleanWithDefault(
    raw.clearReminder,
    false,
    "Clear reminder flag is invalid."
  );
  pushFieldParseError(errors, "clearReminder", clearReminder);

  const dueAt = parseRequiredAbsoluteTimestampField(raw.dueAt);
  pushFieldParseError(errors, "dueAt", dueAt);

  let reminderAt: FieldParseResult<string | null> = { kind: "value", value: null };
  if (clearReminder.kind === "value" && clearReminder.value) {
    reminderAt = { kind: "value", value: null };
  } else {
    reminderAt = parseOptionalAbsoluteTimestampField(raw.reminderAt);
    pushFieldParseError(errors, "reminderAt", reminderAt);
  }

  if (errors.length > 0) {
    return formFailure(errors);
  }

  const input: RescheduleLeadActivityInput = {
    activityId: trimFormValue(raw.activityId),
    dueAt: unwrapFieldValue(dueAt),
    reminderAt: unwrapFieldValue(reminderAt),
    clearReminder: unwrapFieldValue(clearReminder),
  };

  const semanticErrors = validateRescheduleLeadActivityInput(input);
  if (semanticErrors.length > 0) {
    return formFailure(semanticErrors);
  }

  return { success: true, input };
}

export function parseCompleteLeadActivityForm(
  raw: CompleteLeadActivityFormRaw
): ActivityFormParseResult<CompleteLeadActivityInput> {
  const resolutionLabel = trimFormValue(raw.resolution).toUpperCase();
  if (resolutionLabel === "CLOSED_WON") {
    return closedWonFailure();
  }

  const resolution = parseActivityResolution(raw.resolution);
  if (!resolution) {
    return formFailure([
      { field: "resolution", message: "Resolution is invalid." },
    ]);
  }

  const crossErrors = crossResolutionFieldErrors(resolution, raw);
  if (crossErrors.length > 0) {
    return formFailure(crossErrors);
  }

  const errors: ActivityFieldError[] = [];

  const whatsappSendIntentId = parseOptionalUuidField(
    raw.whatsappSendIntentId,
    "WhatsApp send intent identifier is invalid."
  );
  pushFieldParseError(errors, "whatsappSendIntentId", whatsappSendIntentId);

  if (errors.length > 0) {
    return formFailure(errors);
  }

  const base = {
    activityId: trimFormValue(raw.activityId),
    outcomeCode: trimFormValue(raw.outcomeCode),
    completionNote: trimNullableText(raw.completionNote),
    whatsappSendIntentId: unwrapFieldValue(whatsappSendIntentId),
  };

  if (resolution === "NONE") {
    const input: CompleteLeadActivityInput = { ...base, resolution: "NONE" };
    const semanticErrors = validateCompleteLeadActivityInput(input);
    if (semanticErrors.length > 0) {
      return formFailure(semanticErrors);
    }
    return { success: true, input };
  }

  if (resolution === "NEXT_PRIMARY") {
    const nextErrors: ActivityFieldError[] = [];

    const nextActivityType = parseRequiredActivityTypeField(
      raw.nextActivityType,
      "Next activity type is required.",
      "Next activity type is invalid."
    );
    pushFieldParseError(nextErrors, "nextActivityType", nextActivityType);

    const nextPriority = parseOptionalPriorityWithDefault(
      raw.nextPriority,
      "Next priority is invalid."
    );
    pushFieldParseError(nextErrors, "nextPriority", nextPriority);

    const nextDueAt = parseRequiredAbsoluteTimestampField(raw.nextDueAt);
    pushFieldParseError(nextErrors, "nextDueAt", nextDueAt);

    const nextDurationMinutes = parseOptionalIntegerField(
      raw.nextDurationMinutes
    );
    pushFieldParseError(nextErrors, "nextDurationMinutes", nextDurationMinutes);

    const nextReminderAt = parseOptionalAbsoluteTimestampField(raw.nextReminderAt);
    pushFieldParseError(nextErrors, "nextReminderAt", nextReminderAt);

    const nextQuotationId = parseOptionalUuidField(
      raw.nextQuotationId,
      "Next quotation identifier is invalid."
    );
    pushFieldParseError(nextErrors, "nextQuotationId", nextQuotationId);

    if (nextErrors.length > 0) {
      return formFailure(nextErrors);
    }

    const input: CompleteLeadActivityInput = {
      ...base,
      resolution: "NEXT_PRIMARY",
      nextActivityType: unwrapFieldValue(nextActivityType),
      nextTitle: trimFormValue(raw.nextTitle),
      nextDueAt: unwrapFieldValue(nextDueAt),
      nextPriority: unwrapFieldValue(nextPriority),
      nextDurationMinutes: unwrapFieldValue(nextDurationMinutes),
      nextReminderAt: unwrapFieldValue(nextReminderAt),
      nextQuotationId: unwrapFieldValue(nextQuotationId),
    };

    const semanticErrors = validateCompleteLeadActivityInput(input);
    if (semanticErrors.length > 0) {
      return formFailure(semanticErrors);
    }
    return { success: true, input };
  }

  if (resolution === "ON_HOLD") {
    const onHoldErrors: ActivityFieldError[] = [];

    const onHoldReviewAt = parseRequiredAbsoluteTimestampField(
      raw.onHoldReviewAt
    );
    pushFieldParseError(onHoldErrors, "onHoldReviewAt", onHoldReviewAt);

    if (onHoldErrors.length > 0) {
      return formFailure(onHoldErrors);
    }

    const input: CompleteLeadActivityInput = {
      ...base,
      resolution: "ON_HOLD",
      onHoldReason: trimFormValue(raw.onHoldReason),
      onHoldReviewAt: unwrapFieldValue(onHoldReviewAt),
    };

    const semanticErrors = validateCompleteLeadActivityInput(input);
    if (semanticErrors.length > 0) {
      return formFailure(semanticErrors);
    }
    return { success: true, input };
  }

  const input: CompleteLeadActivityInput = {
    ...base,
    resolution: "CLOSED_LOST",
    closedLostReason: trimFormValue(raw.closedLostReason),
    closureReasonCode: trimNullableText(raw.closureReasonCode),
  };

  const semanticErrors = validateCompleteLeadActivityInput(input);
  if (semanticErrors.length > 0) {
    return formFailure(semanticErrors);
  }
  return { success: true, input };
}

export function normalizeCreateLeadActivityInput(raw: {
  leadId: unknown;
  activityType: unknown;
  title: unknown;
  dueAt: unknown;
  priority?: unknown;
  ownerId?: unknown;
  isPrimary?: unknown;
  durationMinutes?: unknown;
  reminderAt?: unknown;
  quotationId?: unknown;
}): CreateLeadActivityInput {
  const activityType =
    parseActivityType(raw.activityType) ?? ("call" as CrmActivityType);
  const priority =
    parseActivityPriority(raw.priority) ?? ("normal" as CrmActivityPriority);
  const dueParsed = parseIsoTimestamp(raw.dueAt);
  const isPrimary = parseBooleanFormValue(raw.isPrimary) ?? false;
  const duration =
    raw.durationMinutes === undefined ||
    raw.durationMinutes === null ||
    raw.durationMinutes === ""
      ? null
      : parseIntegerFormValue(raw.durationMinutes);

  return {
    leadId: String(raw.leadId ?? "").trim(),
    activityType,
    title: String(raw.title ?? "").trim(),
    dueAt: dueParsed ?? String(raw.dueAt ?? "").trim(),
    priority,
    ownerId: parseNullableUuid(raw.ownerId),
    isPrimary,
    durationMinutes: duration,
    reminderAt: parseIsoTimestamp(raw.reminderAt),
    quotationId: parseNullableUuid(raw.quotationId),
  };
}

export function validateCreateLeadActivityInput(
  input: CreateLeadActivityInput
): readonly ActivityFieldError[] {
  const errors: ActivityFieldError[] = [];

  if (!isUuid(input.leadId)) {
    errors.push({ field: "leadId", message: "Lead identifier is invalid." });
  }
  if (!parseActivityType(input.activityType)) {
    errors.push({ field: "activityType", message: "Activity type is invalid." });
  }
  if (input.title.length < TITLE_MIN || input.title.length > TITLE_MAX) {
    errors.push({
      field: "title",
      message: `Title must be ${TITLE_MIN}–${TITLE_MAX} characters.`,
    });
  }
  if (!parseIsoTimestamp(input.dueAt)) {
    errors.push({ field: "dueAt", message: "Due date and time are invalid." });
  }
  if (!parseActivityPriority(input.priority)) {
    errors.push({ field: "priority", message: "Priority is invalid." });
  }
  if (input.ownerId != null && !isUuid(input.ownerId)) {
    errors.push({ field: "ownerId", message: "Owner identifier is invalid." });
  }
  pushDurationError(errors, "durationMinutes", input.durationMinutes);
  if (input.reminderAt != null && !parseIsoTimestamp(input.reminderAt)) {
    errors.push({
      field: "reminderAt",
      message: "Reminder date and time are invalid.",
    });
  } else {
    pushReminderError(errors, "reminderAt", input.reminderAt, input.dueAt);
  }
  if (input.quotationId != null && !isUuid(input.quotationId)) {
    errors.push({
      field: "quotationId",
      message: "Quotation identifier is invalid.",
    });
  }

  return errors;
}

export function normalizeRescheduleLeadActivityInput(raw: {
  activityId: unknown;
  dueAt: unknown;
  reminderAt?: unknown;
  clearReminder?: unknown;
}): RescheduleLeadActivityInput {
  const clearReminder = parseBooleanFormValue(raw.clearReminder) ?? false;
  const reminderAt = clearReminder ? null : parseIsoTimestamp(raw.reminderAt);
  return {
    activityId: String(raw.activityId ?? "").trim(),
    dueAt: parseIsoTimestamp(raw.dueAt) ?? String(raw.dueAt ?? "").trim(),
    reminderAt,
    clearReminder,
  };
}

export function validateRescheduleLeadActivityInput(
  input: RescheduleLeadActivityInput
): readonly ActivityFieldError[] {
  const errors: ActivityFieldError[] = [];

  if (!isUuid(input.activityId)) {
    errors.push({
      field: "activityId",
      message: "Activity identifier is invalid.",
    });
  }
  if (!parseIsoTimestamp(input.dueAt)) {
    errors.push({ field: "dueAt", message: "Due date and time are invalid." });
  } else if (!isFutureIso(input.dueAt)) {
    errors.push({
      field: "dueAt",
      message: "Due date and time must be in the future.",
    });
  }
  if (!input.clearReminder && input.reminderAt != null) {
    if (!parseIsoTimestamp(input.reminderAt)) {
      errors.push({
        field: "reminderAt",
        message: "Reminder date and time are invalid.",
      });
    } else {
      pushReminderError(errors, "reminderAt", input.reminderAt, input.dueAt);
    }
  }

  return errors;
}

export function normalizeTransferActivityOwnershipInput(raw: {
  activityId: unknown;
  newOwnerId: unknown;
}): TransferActivityOwnershipInput {
  return {
    activityId: String(raw.activityId ?? "").trim(),
    newOwnerId: String(raw.newOwnerId ?? "").trim(),
  };
}

export function validateTransferActivityOwnershipInput(
  input: TransferActivityOwnershipInput
): readonly ActivityFieldError[] {
  const errors: ActivityFieldError[] = [];
  if (!isUuid(input.activityId)) {
    errors.push({
      field: "activityId",
      message: "Activity identifier is invalid.",
    });
  }
  if (!isUuid(input.newOwnerId)) {
    errors.push({
      field: "newOwnerId",
      message: "New owner identifier is invalid.",
    });
  }
  return errors;
}

export function normalizeDesignatePrimaryNextActionInput(raw: {
  activityId: unknown;
}): DesignatePrimaryNextActionInput {
  return { activityId: String(raw.activityId ?? "").trim() };
}

export function validateDesignatePrimaryNextActionInput(
  input: DesignatePrimaryNextActionInput
): readonly ActivityFieldError[] {
  if (!isUuid(input.activityId)) {
    return [
      {
        field: "activityId",
        message: "Activity identifier is invalid.",
      },
    ];
  }
  return [];
}

export function normalizeCompleteLeadActivityInput(raw: {
  activityId: unknown;
  outcomeCode: unknown;
  completionNote?: unknown;
  whatsappSendIntentId?: unknown;
  resolution: unknown;
  nextActivityType?: unknown;
  nextTitle?: unknown;
  nextDueAt?: unknown;
  nextPriority?: unknown;
  nextDurationMinutes?: unknown;
  nextReminderAt?: unknown;
  nextQuotationId?: unknown;
  onHoldReason?: unknown;
  onHoldReviewAt?: unknown;
  closedLostReason?: unknown;
  closureReasonCode?: unknown;
}): CompleteLeadActivityInput {
  const resolution = parseActivityResolution(raw.resolution);
  if (!resolution) {
    const label = String(raw.resolution ?? "").trim().toUpperCase();
    if (label === "CLOSED_WON") {
      throw new Error("CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE");
    }
    throw new Error("NEXT_ACTION_REQUIRED");
  }

  const base = {
    activityId: String(raw.activityId ?? "").trim(),
    outcomeCode: String(raw.outcomeCode ?? "").trim(),
    completionNote: trimNullableText(raw.completionNote),
    whatsappSendIntentId: parseNullableUuid(raw.whatsappSendIntentId),
  };

  if (resolution === "NONE") {
    return { ...base, resolution: "NONE" };
  }

  if (resolution === "NEXT_PRIMARY") {
    const nextType = parseActivityType(raw.nextActivityType);
    const nextPriority =
      parseActivityPriority(raw.nextPriority) ??
      ("normal" as CrmActivityPriority);
    const nextDuration =
      raw.nextDurationMinutes === undefined ||
      raw.nextDurationMinutes === null ||
      raw.nextDurationMinutes === ""
        ? null
        : parseIntegerFormValue(raw.nextDurationMinutes);
    return {
      ...base,
      resolution: "NEXT_PRIMARY",
      nextActivityType: nextType ?? ("call" as CrmActivityType),
      nextTitle: String(raw.nextTitle ?? "").trim(),
      nextDueAt:
        parseIsoTimestamp(raw.nextDueAt) ?? String(raw.nextDueAt ?? "").trim(),
      nextPriority,
      nextDurationMinutes: nextDuration,
      nextReminderAt: parseIsoTimestamp(raw.nextReminderAt),
      nextQuotationId: parseNullableUuid(raw.nextQuotationId),
    };
  }

  if (resolution === "ON_HOLD") {
    return {
      ...base,
      resolution: "ON_HOLD",
      onHoldReason: String(raw.onHoldReason ?? "").trim(),
      onHoldReviewAt:
        parseIsoTimestamp(raw.onHoldReviewAt) ??
        String(raw.onHoldReviewAt ?? "").trim(),
    };
  }

  return {
    ...base,
    resolution: "CLOSED_LOST",
    closedLostReason: String(raw.closedLostReason ?? "").trim(),
    closureReasonCode: trimNullableText(raw.closureReasonCode),
  };
}

export function validateCompleteLeadActivityInput(
  input: CompleteLeadActivityInput
): readonly ActivityFieldError[] {
  const errors: ActivityFieldError[] = [];

  if (!isUuid(input.activityId)) {
    errors.push({
      field: "activityId",
      message: "Activity identifier is invalid.",
    });
  }
  if (!input.outcomeCode) {
    errors.push({ field: "outcomeCode", message: "Outcome is required." });
  }
  if (
    input.completionNote != null &&
    (input.completionNote.length < 1 || input.completionNote.length > NOTE_MAX)
  ) {
    errors.push({
      field: "completionNote",
      message: `Completion note must be at most ${NOTE_MAX} characters.`,
    });
  }
  if (
    input.whatsappSendIntentId != null &&
    !isUuid(input.whatsappSendIntentId)
  ) {
    errors.push({
      field: "whatsappSendIntentId",
      message: "WhatsApp send intent identifier is invalid.",
    });
  }

  if (input.resolution === "NEXT_PRIMARY") {
    if (!parseActivityType(input.nextActivityType)) {
      errors.push({
        field: "nextActivityType",
        message: "Next activity type is invalid.",
      });
    }
    if (
      input.nextTitle.length < TITLE_MIN ||
      input.nextTitle.length > TITLE_MAX
    ) {
      errors.push({
        field: "nextTitle",
        message: `Next title must be ${TITLE_MIN}–${TITLE_MAX} characters.`,
      });
    }
    if (!parseIsoTimestamp(input.nextDueAt)) {
      errors.push({
        field: "nextDueAt",
        message: "Next due date and time are invalid.",
      });
    } else if (!isFutureIso(input.nextDueAt)) {
      errors.push({
        field: "nextDueAt",
        message: "Next due date and time must be in the future.",
      });
    }
    if (!parseActivityPriority(input.nextPriority)) {
      errors.push({
        field: "nextPriority",
        message: "Next priority is invalid.",
      });
    }
    pushDurationError(errors, "nextDurationMinutes", input.nextDurationMinutes);
    if (input.nextReminderAt != null) {
      if (!parseIsoTimestamp(input.nextReminderAt)) {
        errors.push({
          field: "nextReminderAt",
          message: "Next reminder date and time are invalid.",
        });
      } else {
        pushReminderError(
          errors,
          "nextReminderAt",
          input.nextReminderAt,
          input.nextDueAt
        );
      }
    }
    if (input.nextQuotationId != null && !isUuid(input.nextQuotationId)) {
      errors.push({
        field: "nextQuotationId",
        message: "Next quotation identifier is invalid.",
      });
    }
  }

  if (input.resolution === "ON_HOLD") {
    if (input.onHoldReason.length === 0) {
      errors.push({
        field: "onHoldReason",
        message: "On-hold reason is required.",
      });
    }
    if (!parseIsoTimestamp(input.onHoldReviewAt)) {
      errors.push({
        field: "onHoldReviewAt",
        message: "On-hold review time is invalid.",
      });
    } else if (!isFutureIso(input.onHoldReviewAt)) {
      errors.push({
        field: "onHoldReviewAt",
        message: "On-hold review time must be in the future.",
      });
    }
  }

  if (input.resolution === "CLOSED_LOST") {
    if (input.closedLostReason.length === 0) {
      errors.push({
        field: "closedLostReason",
        message: "Closed-lost reason is required.",
      });
    }
  }

  return errors;
}

/** Maps complete input to the 16 RPC args (irrelevant fields null). */
export function completeInputToRpcArgs(input: CompleteLeadActivityInput): {
  readonly p_activity_id: string;
  readonly p_outcome_code: string;
  readonly p_completion_note: string | null;
  readonly p_resolution: string;
  readonly p_next_activity_type: string | null;
  readonly p_next_title: string | null;
  readonly p_next_due_at: string | null;
  readonly p_next_priority: string | null;
  readonly p_next_duration_minutes: number | null;
  readonly p_next_reminder_at: string | null;
  readonly p_next_quotation_id: string | null;
  readonly p_on_hold_reason: string | null;
  readonly p_on_hold_review_at: string | null;
  readonly p_closed_lost_reason: string | null;
  readonly p_closure_reason_code: string | null;
  readonly p_whatsapp_send_intent_id: string | null;
} {
  const common = {
    p_activity_id: input.activityId,
    p_outcome_code: input.outcomeCode,
    p_completion_note: input.completionNote,
    p_resolution: input.resolution,
    p_whatsapp_send_intent_id: input.whatsappSendIntentId,
    p_next_activity_type: null as string | null,
    p_next_title: null as string | null,
    p_next_due_at: null as string | null,
    p_next_priority: null as string | null,
    p_next_duration_minutes: null as number | null,
    p_next_reminder_at: null as string | null,
    p_next_quotation_id: null as string | null,
    p_on_hold_reason: null as string | null,
    p_on_hold_review_at: null as string | null,
    p_closed_lost_reason: null as string | null,
    p_closure_reason_code: null as string | null,
  };

  if (input.resolution === "NEXT_PRIMARY") {
    return {
      ...common,
      p_next_activity_type: input.nextActivityType,
      p_next_title: input.nextTitle,
      p_next_due_at: input.nextDueAt,
      p_next_priority: input.nextPriority,
      p_next_duration_minutes: input.nextDurationMinutes,
      p_next_reminder_at: input.nextReminderAt,
      p_next_quotation_id: input.nextQuotationId,
    };
  }

  if (input.resolution === "ON_HOLD") {
    return {
      ...common,
      p_on_hold_reason: input.onHoldReason,
      p_on_hold_review_at: input.onHoldReviewAt,
    };
  }

  if (input.resolution === "CLOSED_LOST") {
    return {
      ...common,
      p_closed_lost_reason: input.closedLostReason,
      p_closure_reason_code: input.closureReasonCode,
    };
  }

  return common;
}
