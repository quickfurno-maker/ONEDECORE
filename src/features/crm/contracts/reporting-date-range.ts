import {
  REPORT_CUSTOM_MAX_DAYS,
  REPORT_TIMEZONE,
  type ReportDatePreset,
  type ReportDateRange,
} from "./reporting-contracts.ts";

const MS_PER_DAY = 86_400_000;

function istParts(date: Date): { year: number; month: number; day: number } {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");
  return { year: get("year"), month: get("month"), day: get("day") };
}

function istDayStartIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}T00:00:00+05:30`;
}

function istDayEndIso(year: number, month: number, day: number): string {
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}T23:59:59.999+05:30`;
}

function addDays(year: number, month: number, day: number, delta: number) {
  const utc = Date.UTC(year, month - 1, day + delta);
  const d = new Date(utc);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function resolveReportDateRange(input: {
  readonly preset: ReportDatePreset;
  readonly customStart?: string | null;
  readonly customEnd?: string | null;
  readonly now?: Date;
}): { readonly range?: ReportDateRange; readonly error?: string } {
  const now = input.now ?? new Date();
  const today = istParts(now);

  if (input.preset === "this_month") {
    const endDay = daysInMonth(today.year, today.month);
    return {
      range: {
        preset: "this_month",
        startIso: istDayStartIso(today.year, today.month, 1),
        endIso: istDayEndIso(today.year, today.month, endDay),
        label: "This month (IST)",
      },
    };
  }

  if (input.preset === "last_month") {
    const prevMonth = today.month === 1 ? 12 : today.month - 1;
    const prevYear = today.month === 1 ? today.year - 1 : today.year;
    const endDay = daysInMonth(prevYear, prevMonth);
    return {
      range: {
        preset: "last_month",
        startIso: istDayStartIso(prevYear, prevMonth, 1),
        endIso: istDayEndIso(prevYear, prevMonth, endDay),
        label: "Last month (IST)",
      },
    };
  }

  if (input.preset === "last_30_days") {
    const start = addDays(today.year, today.month, today.day, -29);
    return {
      range: {
        preset: "last_30_days",
        startIso: istDayStartIso(start.year, start.month, start.day),
        endIso: istDayEndIso(today.year, today.month, today.day),
        label: "Last 30 days (IST)",
      },
    };
  }

  const start = input.customStart?.trim() ?? "";
  const end = input.customEnd?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { error: "Custom range requires YYYY-MM-DD start and end dates." };
  }

  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startMs = Date.parse(istDayStartIso(sy, sm, sd));
  const endMs = Date.parse(istDayEndIso(ey, em, ed));
  if (startMs > endMs) {
    return { error: "Custom range start must be on or before end." };
  }

  const spanDays = Math.floor((endMs - startMs) / MS_PER_DAY) + 1;
  if (spanDays > REPORT_CUSTOM_MAX_DAYS) {
    return {
      error: `Custom range cannot exceed ${REPORT_CUSTOM_MAX_DAYS} days.`,
    };
  }

  return {
    range: {
      preset: "custom",
      startIso: istDayStartIso(sy, sm, sd),
      endIso: istDayEndIso(ey, em, ed),
      label: `${start} – ${end} (IST)`,
    },
  };
}

export function parseReportFiltersFromSearchParams(
  params: URLSearchParams,
  now?: Date
): { readonly filters?: import("./reporting-contracts.ts").ReportFilters; readonly error?: string } {
  const presetRaw = params.get("preset") ?? "this_month";
  const preset = (
    ["this_month", "last_month", "last_30_days", "custom"] as const
  ).includes(presetRaw as ReportDatePreset)
    ? (presetRaw as ReportDatePreset)
    : "this_month";

  const rangeResult = resolveReportDateRange({
    preset,
    customStart: params.get("start"),
    customEnd: params.get("end"),
    now,
  });
  if (!rangeResult.range) {
    return { error: rangeResult.error };
  }

  const sourceId = params.get("source")?.trim() || null;
  const status = params.get("status")?.trim() || null;
  const assigneeId = params.get("assignee")?.trim() || null;

  return {
    filters: {
      dateRange: rangeResult.range,
      sourceId,
      status,
      assigneeId,
    },
  };
}
