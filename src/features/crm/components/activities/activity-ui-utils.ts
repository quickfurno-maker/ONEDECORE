import {
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_TYPES,
  type CrmActivityOutcomeOption,
  type CrmActivityPriority,
  type CrmActivityResolution,
  type CrmActivityType,
} from "../../contracts/activity-contracts.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import {
  isTerminalLeadStage,
  type LeadStageCode,
} from "../../contracts/lead-stages.ts";

export const CRM_ACTIVITY_DEFAULT_DURATIONS: Readonly<
  Record<CrmActivityType, number>
> = {
  call: 15,
  whatsapp: 10,
  consultation: 60,
  site_visit: 90,
  quotation_follow_up: 15,
  internal_task: 15,
};

export const CRM_ACTIVITY_SUGGESTED_TITLES: Readonly<
  Record<CrmActivityType, string>
> = {
  call: "Follow-up call",
  whatsapp: "WhatsApp follow-up",
  consultation: "Design consultation",
  site_visit: "Site visit",
  quotation_follow_up: "Quotation follow-up",
  internal_task: "Internal task",
};

export type ActivityDueState = "overdue" | "today" | "upcoming";

const DISPLAY_TIMEZONE = "Asia/Kolkata";

export function formatActivityTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIMEZONE,
  }).format(new Date(value));
}

export function formatActivityTypeLabel(type: string): string {
  return formatCrmCodeLabel(type);
}

export function formatActivityPriorityLabel(priority: string): string {
  return formatCrmCodeLabel(priority);
}

export function getActivityDueState(dueAt: string): ActivityDueState {
  const dueMs = Date.parse(dueAt);
  if (Number.isNaN(dueMs)) {
    return "upcoming";
  }

  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: DISPLAY_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const dueDay = formatter.format(new Date(dueMs));
  const today = formatter.format(now);

  if (dueMs < now.getTime()) {
    return "overdue";
  }
  if (dueDay === today) {
    return "today";
  }
  return "upcoming";
}

export function activityDueStateLabel(state: ActivityDueState): string {
  switch (state) {
    case "overdue":
      return "Overdue";
    case "today":
      return "Due today";
    default:
      return "Upcoming";
  }
}

export function activityDueStateClassName(state: ActivityDueState): string {
  switch (state) {
    case "overdue":
      return "text-[var(--crm-danger)] bg-[var(--crm-danger-soft)] border-[var(--crm-danger)]/25";
    case "today":
      return "text-[var(--crm-warning)] bg-[var(--crm-warning-soft)] border-[var(--crm-warning)]/25";
    default:
      return "text-[var(--crm-text-secondary)] bg-[var(--crm-surface-subtle)] border-[var(--crm-border)]";
  }
}

export function filterOutcomeOptionsForActivityType(
  options: readonly CrmActivityOutcomeOption[],
  activityType: string
): readonly CrmActivityOutcomeOption[] {
  return options.filter(
    (option) =>
      option.activityTypes.length === 0 ||
      option.activityTypes.includes(activityType)
  );
}

export function suggestNextActivityType(
  currentType: string
): CrmActivityType {
  const parsed = CRM_ACTIVITY_TYPES.find((entry) => entry === currentType);
  if (parsed === "whatsapp") {
    return "call";
  }
  if (parsed === "call") {
    return "whatsapp";
  }
  return parsed ?? "call";
}

export function activityTypeOptions(): readonly CrmActivityType[] {
  return CRM_ACTIVITY_TYPES;
}

export function activityPriorityOptions(): readonly CrmActivityPriority[] {
  return CRM_ACTIVITY_PRIORITIES;
}

export const CRM_ACTIVITY_RESOLUTION_LABELS = {
  NEXT_PRIMARY: "Schedule next action",
  ON_HOLD: "Put lead on hold",
  CLOSED_LOST: "Close lost",
  NONE: "Complete only",
} as const;

/**
 * Completion resolution matrix aligned with CRM 2A-3 complete_lead_activity.
 * CLOSED_WON is never offered. on_hold leads omit ON_HOLD (already held).
 */
export function getCompletionResolutionOptions(input: {
  readonly leadStatus: LeadStageCode;
  readonly isPrimary: boolean;
  readonly hasOtherOpenPrimary: boolean;
}): readonly CrmActivityResolution[] {
  if (isTerminalLeadStage(input.leadStatus)) {
    return ["NONE"];
  }

  const allowOnHold = input.leadStatus !== "on_hold";
  const withOnHold = (
    options: readonly CrmActivityResolution[]
  ): readonly CrmActivityResolution[] =>
    allowOnHold ? options : options.filter((entry) => entry !== "ON_HOLD");

  if (input.isPrimary) {
    return withOnHold(["NEXT_PRIMARY", "ON_HOLD", "CLOSED_LOST"]);
  }

  if (input.hasOtherOpenPrimary) {
    return withOnHold(["NONE", "NEXT_PRIMARY", "ON_HOLD", "CLOSED_LOST"]);
  }

  return withOnHold(["NEXT_PRIMARY", "ON_HOLD", "CLOSED_LOST"]);
}

export function getDefaultCompletionResolution(
  options: readonly CrmActivityResolution[]
): CrmActivityResolution {
  if (options.includes("NONE") && options.length === 1) {
    return "NONE";
  }
  if (options.includes("NONE") && options.includes("NEXT_PRIMARY")) {
    return "NONE";
  }
  if (options.includes("NEXT_PRIMARY")) {
    return "NEXT_PRIMARY";
  }
  return options[0] ?? "NONE";
}

export function inputClassName(hasError = false): string {
  return [
    "crm-input mt-1 w-full text-base sm:text-sm",
    hasError ? "border-[var(--crm-danger)]" : "",
  ].filter(Boolean).join(" ");
}

export function fieldErrorId(field: string): string {
  return `activity-field-error-${field}`;
}
