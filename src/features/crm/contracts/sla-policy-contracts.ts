/**
 * CRM SLA admin settings — first-contact policy contracts.
 *
 * Pure, transport-free shapes shared by the server service, the server action
 * and the Super Admin settings panel. Mirrors the DB validator in
 * `private.validate_crm_sla_business_hours_config`: weekday keys only, exactly
 * `start` + `end` as HH:MM strings, start strictly before end, closed days
 * OMITTED from the object (never serialized as null/false).
 *
 * This module never writes: activation timestamps (`effective_from`,
 * `activated_at`) and `updated_by` are owned exclusively by
 * `public.update_crm_sla_policy`.
 */

export const FIRST_CONTACT_SLA_POLICY_CODE = "first_contact";

export const CRM_SLA_SETTINGS_PATH = "/admin/crm/settings/sla";

export const SLA_TARGET_MINUTES_MIN = 1;
export const SLA_TARGET_MINUTES_MAX = 10_080;

export const SLA_WEEKDAY_KEYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type SlaWeekdayKey = (typeof SLA_WEEKDAY_KEYS)[number];

export const SLA_WEEKDAY_LABELS: Readonly<Record<SlaWeekdayKey, string>> = {
  monday: "Monday",
  tuesday: "Tuesday",
  wednesday: "Wednesday",
  thursday: "Thursday",
  friday: "Friday",
  saturday: "Saturday",
  sunday: "Sunday",
};

export interface SlaBusinessHoursWindow {
  readonly start: string;
  readonly end: string;
}

/** Closed days are absent keys — never `null` values. */
export type SlaBusinessHoursConfig = Readonly<
  Partial<Record<SlaWeekdayKey, SlaBusinessHoursWindow>>
>;

export interface CrmSlaPolicyDto {
  readonly policyCode: string;
  readonly targetBusinessMinutes: number;
  readonly timezone: string;
  readonly businessHoursEnabled: boolean;
  readonly businessHoursConfig: SlaBusinessHoursConfig | null;
  readonly isActive: boolean;
  readonly effectiveFrom: string | null;
  readonly activatedAt: string | null;
  readonly updatedAt: string;
}

export interface SlaWeekdayFormRow {
  readonly day: SlaWeekdayKey;
  readonly open: boolean;
  readonly start: string;
  readonly end: string;
}

export interface UpdateCrmSlaPolicyInput {
  readonly targetBusinessMinutes: number;
  readonly timezone: string;
  readonly businessHoursEnabled: boolean;
  readonly isActive: boolean;
  readonly weekdays: readonly SlaWeekdayFormRow[];
}

export interface SlaPolicyValidationError {
  readonly field: string;
  readonly message: string;
}

export interface SlaPolicyActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

/**
 * Owner-approved starting point offered when the DB config is still null.
 * It is a FORM DRAFT only — nothing is written until an explicit Save.
 */
export const DEFAULT_BUSINESS_HOURS_DRAFT: SlaBusinessHoursConfig = {
  monday: { start: "09:00", end: "19:00" },
  tuesday: { start: "09:00", end: "19:00" },
  wednesday: { start: "09:00", end: "19:00" },
  thursday: { start: "09:00", end: "19:00" },
  friday: { start: "09:00", end: "19:00" },
  saturday: { start: "09:00", end: "19:00" },
};

const HHMM_PATTERN = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

export function isValidHhMm(value: string): boolean {
  return HHMM_PATTERN.test(value);
}

export function hhmmToMinutes(value: string): number | null {
  if (!isValidHhMm(value)) {
    return null;
  }
  const [hours, minutes] = value.split(":");
  return Number.parseInt(hours ?? "", 10) * 60 + Number.parseInt(minutes ?? "", 10);
}

function isWeekdayKey(value: string): value is SlaWeekdayKey {
  return (SLA_WEEKDAY_KEYS as readonly string[]).includes(value);
}

/**
 * Narrows an untyped `business_hours_config` jsonb payload. Anything that does
 * not match the DB validator shape is discarded rather than guessed at.
 */
export function parseBusinessHoursConfig(
  value: unknown
): SlaBusinessHoursConfig | null {
  if (value == null || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const parsed: Record<string, SlaBusinessHoursWindow> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!isWeekdayKey(key) || raw == null || typeof raw !== "object") {
      continue;
    }
    const day = raw as Record<string, unknown>;
    const start = day.start;
    const end = day.end;
    if (
      typeof start !== "string" ||
      typeof end !== "string" ||
      !isValidHhMm(start) ||
      !isValidHhMm(end)
    ) {
      continue;
    }
    parsed[key] = { start, end };
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

interface CrmSlaPolicyRow {
  readonly policy_code: string;
  readonly target_business_minutes: number;
  readonly timezone: string;
  readonly business_hours_enabled: boolean;
  readonly business_hours_config: unknown;
  readonly is_active: boolean;
  readonly effective_from: string | null;
  readonly activated_at: string | null;
  readonly updated_at: string;
}

export function mapCrmSlaPolicyRow(row: CrmSlaPolicyRow): CrmSlaPolicyDto {
  return {
    policyCode: row.policy_code,
    targetBusinessMinutes: row.target_business_minutes,
    timezone: row.timezone,
    businessHoursEnabled: row.business_hours_enabled,
    businessHoursConfig: parseBusinessHoursConfig(row.business_hours_config),
    isActive: row.is_active,
    effectiveFrom: row.effective_from,
    activatedAt: row.activated_at,
    updatedAt: row.updated_at,
  };
}

export interface CrmSlaPolicyFormModel {
  readonly targetBusinessMinutes: number;
  readonly timezone: string;
  readonly businessHoursEnabled: boolean;
  readonly isActive: boolean;
  readonly weekdays: readonly SlaWeekdayFormRow[];
  /** True when the DB config is still null and the rows shown are an unsaved draft. */
  readonly isBusinessHoursDraft: boolean;
}

/**
 * Builds the seven editable weekday rows. When the DB config is null the
 * owner-approved Mon–Sat 09:00–19:00 draft is shown and flagged as unsaved;
 * Sunday stays closed.
 */
export function buildSlaPolicyFormModel(
  policy: CrmSlaPolicyDto
): CrmSlaPolicyFormModel {
  const isBusinessHoursDraft = policy.businessHoursConfig == null;
  const config = policy.businessHoursConfig ?? DEFAULT_BUSINESS_HOURS_DRAFT;

  return {
    targetBusinessMinutes: policy.targetBusinessMinutes,
    timezone: policy.timezone,
    businessHoursEnabled: policy.businessHoursEnabled,
    isActive: policy.isActive,
    isBusinessHoursDraft,
    weekdays: SLA_WEEKDAY_KEYS.map((day) => {
      const window = config[day];
      return {
        day,
        open: window != null,
        start: window?.start ?? "09:00",
        end: window?.end ?? "19:00",
      };
    }),
  };
}

/**
 * Serializes weekday rows to the jsonb payload. Closed days are omitted.
 * Returns null when no day is open so the caller clears the config instead of
 * sending `{}`, which the DB validator rejects.
 */
export function serializeBusinessHoursConfig(
  weekdays: readonly SlaWeekdayFormRow[]
): SlaBusinessHoursConfig | null {
  const config: Record<string, SlaBusinessHoursWindow> = {};

  for (const day of SLA_WEEKDAY_KEYS) {
    const row = weekdays.find((entry) => entry.day === day);
    if (!row || !row.open) {
      continue;
    }
    config[day] = { start: row.start, end: row.end };
  }

  return Object.keys(config).length > 0 ? config : null;
}

export function validateUpdateCrmSlaPolicyInput(
  input: UpdateCrmSlaPolicyInput
): readonly SlaPolicyValidationError[] {
  const errors: SlaPolicyValidationError[] = [];

  if (
    !Number.isInteger(input.targetBusinessMinutes) ||
    input.targetBusinessMinutes < SLA_TARGET_MINUTES_MIN ||
    input.targetBusinessMinutes > SLA_TARGET_MINUTES_MAX
  ) {
    errors.push({
      field: "targetBusinessMinutes",
      message: `Target response must be a whole number between ${SLA_TARGET_MINUTES_MIN} and ${SLA_TARGET_MINUTES_MAX} business minutes.`,
    });
  }

  if (input.timezone.trim().length === 0) {
    errors.push({ field: "timezone", message: "Timezone is required." });
  }

  const openDays = input.weekdays.filter((row) => row.open);

  for (const row of openDays) {
    const start = hhmmToMinutes(row.start);
    const end = hhmmToMinutes(row.end);
    const label = SLA_WEEKDAY_LABELS[row.day];

    if (start == null || end == null) {
      errors.push({
        field: `weekday.${row.day}`,
        message: `${label} start and end must be HH:MM times.`,
      });
      continue;
    }

    if (start >= end) {
      errors.push({
        field: `weekday.${row.day}`,
        message: `${label} start time must be before its end time.`,
      });
    }
  }

  if (input.businessHoursEnabled && openDays.length === 0) {
    errors.push({
      field: "businessHoursEnabled",
      message: "Business hours are enabled, so at least one day must be open.",
    });
  }

  if (input.isActive) {
    if (!input.businessHoursEnabled) {
      errors.push({
        field: "isActive",
        message: "Activating this policy requires business hours to be enabled.",
      });
    }
    if (openDays.length === 0) {
      errors.push({
        field: "isActive",
        message: "Activating this policy requires at least one open day.",
      });
    }
  }

  return errors;
}

/**
 * Reads the settings form. Kept pure (a plain name -> value reader) so both the
 * server action and its tests exercise identical parsing.
 */
export function readSlaPolicyForm(
  get: (name: string) => string | null
): UpdateCrmSlaPolicyInput {
  const targetRaw = (get("targetBusinessMinutes") ?? "").trim();

  return {
    targetBusinessMinutes: /^-?\d+$/.test(targetRaw)
      ? Number.parseInt(targetRaw, 10)
      : Number.NaN,
    timezone: (get("timezone") ?? "").trim(),
    businessHoursEnabled: get("businessHoursEnabled") === "on",
    isActive: get("isActive") === "on",
    weekdays: SLA_WEEKDAY_KEYS.map((day) => ({
      day,
      open: get(`weekday.${day}.open`) === "on",
      start: (get(`weekday.${day}.start`) ?? "").trim(),
      end: (get(`weekday.${day}.end`) ?? "").trim(),
    })),
  };
}

export function formatSlaTimestamp(value: string | null): string {
  if (!value) {
    return "—";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }
  return parsed.toISOString().replace("T", " ").slice(0, 16) + " UTC";
}

export const SLA_NON_RETROACTIVE_NOTE =
  "First activation is non-retroactive. Existing SLA clocks are not silently rescoped.";
