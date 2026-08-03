/**
 * Phase 5E-B — non-commercial CRM reporting contracts.
 * No achievement, attainment, forecast, or commercial value metrics.
 */

export const REPORT_DATE_PRESETS = [
  "this_month",
  "last_month",
  "last_30_days",
  "custom",
] as const;

export type ReportDatePreset = (typeof REPORT_DATE_PRESETS)[number];

export const REPORT_TIMEZONE = "Asia/Kolkata";
export const REPORT_CUSTOM_MAX_DAYS = 366;

export interface ReportDateRange {
  readonly preset: ReportDatePreset;
  readonly startIso: string;
  readonly endIso: string;
  readonly label: string;
}

export interface ReportFilters {
  readonly dateRange: ReportDateRange;
  readonly sourceId: string | null;
  readonly status: string | null;
  readonly assigneeId: string | null;
}

export interface ReportSummaryMetrics {
  readonly totalLeads: number;
  readonly statusCounts: Readonly<Record<string, number>>;
  readonly closedLostCount: number;
  readonly closedWonCount: number;
}

export interface ReportTrendPoint {
  readonly bucket: string;
  readonly count: number;
}

export interface ReportSourceMixItem {
  readonly sourceId: string;
  readonly sourceName: string;
  readonly count: number;
}

export interface ReportAssigneeWorkloadItem {
  readonly assigneeId: string | null;
  readonly assigneeName: string;
  readonly leadCount: number;
}

export interface ReportFollowUpMetrics {
  readonly open: number;
  readonly overdue: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly dueSoon: number;
}

export interface ReportClosedLostReasonItem {
  readonly reasonCode: string;
  readonly reasonName: string;
  readonly count: number;
}

export interface ReportAgingBucket {
  readonly label: string;
  readonly minDays: number;
  readonly maxDays: number | null;
  readonly count: number;
}

export interface CrmReportingSnapshot {
  readonly summary: ReportSummaryMetrics;
  readonly trend: readonly ReportTrendPoint[];
  readonly sourceMix: readonly ReportSourceMixItem[];
  readonly assigneeWorkload: readonly ReportAssigneeWorkloadItem[];
  readonly followUps: ReportFollowUpMetrics;
  readonly closedLostReasons: readonly ReportClosedLostReasonItem[];
  readonly agingBuckets: readonly ReportAgingBucket[];
}

export const REPORT_AGING_BUCKET_DEFS = [
  { label: "0–7 days", minDays: 0, maxDays: 7 },
  { label: "8–14 days", minDays: 8, maxDays: 14 },
  { label: "15–30 days", minDays: 15, maxDays: 30 },
  { label: "31–60 days", minDays: 31, maxDays: 60 },
  { label: "61+ days", minDays: 61, maxDays: null },
] as const;
