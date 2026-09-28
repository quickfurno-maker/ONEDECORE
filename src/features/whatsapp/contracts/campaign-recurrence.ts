import type { WhatsappMarketingFrequencyRule } from "./send-policy";

export const WHATSAPP_RECURRENCE_CADENCES = [
  "weekly",
  "biweekly",
  "monthly",
] as const;
export type WhatsappRecurrenceCadence =
  (typeof WHATSAPP_RECURRENCE_CADENCES)[number];

const DAY_MS = 86_400_000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function addMonthsIst(iso: string, months: number): string {
  const source = new Date(iso);
  if (Number.isNaN(source.getTime())) return "";
  const ist = new Date(source.getTime() + IST_OFFSET_MS);
  const year = ist.getUTCFullYear();
  const month = ist.getUTCMonth();
  const day = ist.getUTCDate();
  const hour = ist.getUTCHours();
  const minute = ist.getUTCMinutes();
  const second = ist.getUTCSeconds();
  const lastDay = new Date(Date.UTC(year, month + months + 1, 0)).getUTCDate();
  const targetDay = Math.min(day, lastDay);
  return new Date(
    Date.UTC(year, month + months, targetDay, hour, minute, second) -
      IST_OFFSET_MS
  ).toISOString();
}

export function buildWhatsappRecurrenceOccurrences(input: {
  readonly firstScheduledFor: string;
  readonly cadence: WhatsappRecurrenceCadence;
  readonly count: number;
}): readonly string[] {
  const first = new Date(input.firstScheduledFor);
  if (Number.isNaN(first.getTime())) return [];
  const count = Math.min(Math.max(Math.trunc(input.count), 2), 24);
  return Array.from({ length: count }, (_, index) => {
    if (input.cadence === "monthly") {
      return addMonthsIst(first.toISOString(), index);
    }
    const days = input.cadence === "weekly" ? 7 : 14;
    return new Date(first.getTime() + index * days * DAY_MS).toISOString();
  });
}

export interface WhatsappRecurrenceWarning {
  readonly code: "frequency_cap_overlap" | "outside_run_window";
  readonly message: string;
}

export function whatsappRecurrenceWarnings(input: {
  readonly occurrences: readonly string[];
  readonly frequencyRules: readonly WhatsappMarketingFrequencyRule[];
  readonly now?: Date;
}): readonly WhatsappRecurrenceWarning[] {
  const warnings: WhatsappRecurrenceWarning[] = [];
  const instants = input.occurrences
    .map((iso) => Date.parse(iso))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  for (const rule of input.frequencyRules) {
    const windowMs = rule.windowHours * 60 * 60 * 1000;
    let maxInside = 0;
    for (let left = 0; left < instants.length; left += 1) {
      let count = 0;
      for (let right = left; right < instants.length; right += 1) {
        if (instants[right]! - instants[left]! >= windowMs) break;
        count += 1;
      }
      maxInside = Math.max(maxInside, count);
    }
    if (maxInside > rule.maxMessages) {
      warnings.push({
        code: "frequency_cap_overlap",
        message:
          "This plan can place " +
          maxInside +
          " occurrences inside the " +
          rule.windowHours +
          "h cap window, while policy allows " +
          rule.maxMessages +
          ". Some recipients may be skipped at send time.",
      });
    }
  }

  const now = input.now ?? new Date();
  const latestAllowed = now.getTime() + 90 * DAY_MS;
  if (instants.some((instant) => instant > latestAllowed)) {
    warnings.push({
      code: "outside_run_window",
      message:
        "Some occurrences are more than 90 days away. Keep them in the recurrence plan and approve/schedule each version closer to its delivery date.",
    });
  }

  return warnings;
}

export function whatsappRecurrenceCadenceLabel(
  cadence: WhatsappRecurrenceCadence
): string {
  if (cadence === "weekly") return "Every week";
  if (cadence === "biweekly") return "Every 2 weeks";
  return "Every month";
}
