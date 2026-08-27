import {
  CRM_ACTIVITY_PRIORITIES,
  CRM_ACTIVITY_TYPES,
  type CrmActivityOutcomeOption,
  type CrmActivityPriority,
  type CrmActivityType,
} from "../../contracts/activity-contracts.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

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
      return "text-red-300 bg-red-950/40 border-red-900/50";
    case "today":
      return "text-amber-200 bg-amber-950/30 border-amber-800/50";
    default:
      return "text-neutral-300 bg-neutral-900/60 border-neutral-700/60";
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

export function inputClassName(hasError = false): string {
  return [
    "mt-1 w-full rounded-md border bg-neutral-950 px-3 py-2 text-sm text-neutral-100",
    hasError ? "border-red-700" : "border-neutral-700",
  ].join(" ");
}

export function fieldErrorId(field: string): string {
  return `activity-field-error-${field}`;
}
