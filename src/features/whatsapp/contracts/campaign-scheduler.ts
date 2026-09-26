import type { WhatsappCampaignVersionSummary } from "./campaign-execution.ts";

export const WHATSAPP_SCHEDULER_TIME_ZONE = "Asia/Kolkata";
export const WHATSAPP_SCHEDULER_VIEWS = ["month", "week", "agenda"] as const;
export type WhatsappSchedulerView = (typeof WHATSAPP_SCHEDULER_VIEWS)[number];

export interface WhatsappSchedulerEvent {
  readonly runId: string;
  readonly campaignVersionId: string;
  readonly campaignName: string;
  readonly versionTitle: string;
  readonly templateName: string | null;
  readonly scheduledFor: string;
  readonly status: string;
  readonly eligibleCount: number;
  readonly totalCount: number;
  readonly sentCount: number;
  readonly canReschedule: boolean;
}

const DATE_KEY = new Intl.DateTimeFormat("en-CA", {
  timeZone: WHATSAPP_SCHEDULER_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});
const TIME = new Intl.DateTimeFormat("en-IN", {
  timeZone: WHATSAPP_SCHEDULER_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

export function parseWhatsappSchedulerView(value: unknown): WhatsappSchedulerView {
  return typeof value === "string" &&
    (WHATSAPP_SCHEDULER_VIEWS as readonly string[]).includes(value)
    ? (value as WhatsappSchedulerView)
    : "month";
}

export function currentIstDateKey(now = new Date()): string {
  return schedulerDateKey(now.toISOString());
}

export function schedulerDateKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const parts = DATE_KEY.formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "";
  const month = parts.find((part) => part.type === "month")?.value ?? "";
  const day = parts.find((part) => part.type === "day")?.value ?? "";
  return year && month && day ? `${year}-${month}-${day}` : "";
}
export function schedulerTimeLabel(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "—" : TIME.format(date);
}

export function parseWhatsappSchedulerMonth(
  value: unknown,
  fallbackDateKey = currentIstDateKey()
): string {
  const fallback = fallbackDateKey.slice(0, 7);
  if (typeof value !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    return fallback;
  }
  return value;
}

export function shiftWhatsappSchedulerMonth(month: string, delta: number): string {
  const [year, rawMonth] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year!, rawMonth! - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function schedulerMonthLabel(month: string): string {
  const [year, rawMonth] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year!, rawMonth! - 1, 15)));
}
function addUtcDays(dateKey: string, amount: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day! + amount));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(
    date.getUTCDate()
  ).padStart(2, "0")}`;
}

export function schedulerMonthCells(month: string): readonly string[] {
  const first = `${month}-01`;
  const [year, rawMonth] = month.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, rawMonth! - 1, 1)).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const start = addUtcDays(first, -mondayOffset);
  return Array.from({ length: 42 }, (_, index) => addUtcDays(start, index));
}

export function schedulerWeekDates(anchorDateKey: string): readonly string[] {
  const [year, month, day] = anchorDateKey.split("-").map(Number);
  const weekday = new Date(Date.UTC(year!, month! - 1, day!)).getUTCDay();
  const mondayOffset = (weekday + 6) % 7;
  const monday = addUtcDays(anchorDateKey, -mondayOffset);
  return Array.from({ length: 7 }, (_, index) => addUtcDays(monday, index));
}
export function moveScheduledInstantToDate(
  scheduledFor: string,
  targetDateKey: string
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDateKey)) return null;
  const source = new Date(scheduledFor);
  if (Number.isNaN(source.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: WHATSAPP_SCHEDULER_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(source);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "09";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const second = parts.find((part) => part.type === "second")?.value ?? "00";
  const moved = new Date(`${targetDateKey}T${hour}:${minute}:${second}+05:30`);
  return Number.isNaN(moved.getTime()) ? null : moved.toISOString();
}

export function whatsappSchedulerEvents(
  versions: readonly WhatsappCampaignVersionSummary[]
): readonly WhatsappSchedulerEvent[] {
  return versions.flatMap((version) => {
    const run = version.latestRun;
    if (!run?.scheduledFor) return [];
    return [{
      runId: run.id,
      campaignVersionId: version.versionId,
      campaignName: version.campaignName,
      versionTitle: version.title,
      templateName: version.templateName,
      scheduledFor: run.scheduledFor,
      status: run.status,
      eligibleCount: run.eligibleCount,
      totalCount: run.totalCount,
      sentCount: run.sentCount,
      canReschedule: run.status === "scheduled",
    }];
  }).sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));
}
export function schedulerStatusLabel(status: string): string {
  switch (status) {
    case "scheduled":
      return "Scheduled";
    case "materializing":
      return "Preparing audience";
    case "ready":
      return "Ready";
    case "dispatching":
      return "Sending";
    case "paused":
      return "Paused";
    case "reconciling":
      return "Needs attention";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "failed":
      return "Failed";
    default:
      return status.replace(/_/g, " ");
  }
}

export function schedulerStatusTone(
  status: string
): "positive" | "warning" | "negative" | "active" | undefined {
  if (status === "completed") return "positive";
  if (status === "dispatching" || status === "ready") return "active";
  if (status === "paused" || status === "reconciling") return "warning";
  if (status === "cancelled" || status === "failed") return "negative";
  return undefined;
}

export function schedulerCalendarWindow(month: string): {
  readonly fromIso: string;
  readonly toIso: string;
} {
  const cells = schedulerMonthCells(month);
  const first = cells[0]!;
  const afterLast = addUtcDays(cells[cells.length - 1]!, 1);
  return {
    fromIso: new Date(`${first}T00:00:00+05:30`).toISOString(),
    toIso: new Date(`${afterLast}T00:00:00+05:30`).toISOString(),
  };
}

function schedulerString(row: Record<string, unknown>, key: string): string | null {
  const value = row[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function schedulerCount(row: Record<string, unknown>, key: string): number {
  const value = row[key];
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : 0;
}

export function parseWhatsappSchedulerEvents(input: unknown): readonly WhatsappSchedulerEvent[] {
  if (!Array.isArray(input)) return [];
  return input.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    const runId = schedulerString(row, "run_id");
    const campaignVersionId = schedulerString(row, "campaign_version_id");
    const campaignName = schedulerString(row, "campaign_name");
    const versionTitle = schedulerString(row, "version_title");
    const scheduledFor = schedulerString(row, "scheduled_for");
    const status = schedulerString(row, "status");
    if (!runId || !campaignVersionId || !campaignName || !versionTitle || !scheduledFor || !status) {
      return [];
    }
    if (Number.isNaN(Date.parse(scheduledFor))) return [];
    return [{
      runId,
      campaignVersionId,
      campaignName,
      versionTitle,
      templateName: schedulerString(row, "template_name"),
      scheduledFor,
      status,
      eligibleCount: schedulerCount(row, "eligible_count"),
      totalCount: schedulerCount(row, "total_count"),
      sentCount: schedulerCount(row, "sent_count"),
      canReschedule: status === "scheduled",
    }];
  }).sort((a, b) => Date.parse(a.scheduledFor) - Date.parse(b.scheduledFor));
}
