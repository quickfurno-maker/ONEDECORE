/**
 * CRM 2A-6 — My Day workspace contracts and DTO mappers.
 */

import type { LeadStageCode } from "./lead-stages.ts";
import { REPORT_TIMEZONE } from "./reporting-contracts.ts";

export const MY_DAY_ATTENTION_REASONS = [
  "no_next_action",
  "new_uncontacted",
  "unassigned",
  "sla_breach",
] as const;

export type MyDayAttentionReason = (typeof MY_DAY_ATTENTION_REASONS)[number];

export interface MyDayTaskRow {
  readonly activityId: string;
  readonly leadId: string;
  readonly leadDisplayLabel: string;
  readonly ownerId: string;
  readonly ownerLabel: string;
  readonly activityType: string;
  readonly title: string;
  readonly priority: string;
  readonly dueAt: string;
  readonly reminderAt: string | null;
  readonly source: string;
  readonly leadStatus: LeadStageCode;
}

export interface MyDayAttentionRow {
  readonly leadId: string;
  readonly leadDisplayLabel: string;
  readonly assigneeId: string | null;
  readonly assigneeLabel: string | null;
  readonly leadStatus: LeadStageCode;
  readonly receivedAt: string;
  readonly slaDueAt: string | null;
  readonly attentionReason: MyDayAttentionReason;
}

export interface MyDaySummary {
  readonly overdue: number;
  readonly dueToday: number;
  readonly upcoming: number;
  readonly noNextAction: number;
  readonly newUncontacted: number;
  readonly unassigned: number;
  readonly slaBreaches: number;
}

export interface MyDaySnapshot {
  readonly capturedAt: string;
  readonly localDate: string;
  readonly scopeOwnerId: string | null;
  readonly isTeamScope: boolean;
  readonly canViewManagerSections: boolean;
  readonly summary: MyDaySummary;
  readonly tasks: {
    readonly overdue: readonly MyDayTaskRow[];
    readonly dueToday: readonly MyDayTaskRow[];
    readonly upcoming: readonly MyDayTaskRow[];
  };
  readonly attention: {
    readonly noNextAction: readonly MyDayAttentionRow[];
    readonly newUncontacted: readonly MyDayAttentionRow[];
    readonly unassigned: readonly MyDayAttentionRow[];
    readonly slaBreaches: readonly MyDayAttentionRow[];
  };
}

export const MY_DAY_TASK_PUBLIC_KEYS = [
  "activityId",
  "leadId",
  "leadDisplayLabel",
  "ownerId",
  "ownerLabel",
  "activityType",
  "title",
  "priority",
  "dueAt",
  "reminderAt",
  "source",
  "leadStatus",
] as const satisfies readonly (keyof MyDayTaskRow)[];

export const MY_DAY_ATTENTION_PUBLIC_KEYS = [
  "leadId",
  "leadDisplayLabel",
  "assigneeId",
  "assigneeLabel",
  "leadStatus",
  "receivedAt",
  "slaDueAt",
  "attentionReason",
] as const satisfies readonly (keyof MyDayAttentionRow)[];

const FORBIDDEN_MY_DAY_FIELDS = [
  "message",
  "notes",
  "evidence",
  "submitted_email",
  "submittedEmail",
  "contact_id",
  "contactId",
] as const;

export const MY_DAY_FORBIDDEN_FIELDS: readonly string[] = [
  ...FORBIDDEN_MY_DAY_FIELDS,
];

export function formatMyDayLocalDateLabel(localDate: string): string {
  const [year, month, day] = localDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: REPORT_TIMEZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function formatMyDayTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: REPORT_TIMEZONE,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

interface RawMyDayRpcPayload {
  readonly capturedAt: string;
  readonly localDate: string;
  readonly scopeOwnerId: string | null;
  readonly isTeamScope: boolean;
  readonly canViewManagerSections: boolean;
  readonly summary: MyDaySummary;
  readonly tasks: {
    readonly overdue: readonly Record<string, unknown>[];
    readonly dueToday: readonly Record<string, unknown>[];
    readonly upcoming: readonly Record<string, unknown>[];
  };
  readonly attention: {
    readonly noNextAction: readonly Record<string, unknown>[];
    readonly newUncontacted: readonly Record<string, unknown>[];
    readonly unassigned: readonly Record<string, unknown>[];
    readonly slaBreaches: readonly Record<string, unknown>[];
  };
}

function mapTaskRow(raw: Record<string, unknown>): MyDayTaskRow {
  return {
    activityId: String(raw.activityId),
    leadId: String(raw.leadId),
    leadDisplayLabel: String(raw.leadDisplayLabel),
    ownerId: String(raw.ownerId),
    ownerLabel: String(raw.ownerLabel),
    activityType: String(raw.activityType),
    title: String(raw.title),
    priority: String(raw.priority),
    dueAt: String(raw.dueAt),
    reminderAt: raw.reminderAt == null ? null : String(raw.reminderAt),
    source: String(raw.source),
    leadStatus: String(raw.leadStatus) as LeadStageCode,
  };
}

function mapAttentionRow(raw: Record<string, unknown>): MyDayAttentionRow {
  return {
    leadId: String(raw.leadId),
    leadDisplayLabel: String(raw.leadDisplayLabel),
    assigneeId: raw.assigneeId == null ? null : String(raw.assigneeId),
    assigneeLabel: raw.assigneeLabel == null ? null : String(raw.assigneeLabel),
    leadStatus: String(raw.leadStatus) as LeadStageCode,
    receivedAt: String(raw.receivedAt),
    slaDueAt: raw.slaDueAt == null ? null : String(raw.slaDueAt),
    attentionReason: String(raw.attentionReason) as MyDayAttentionReason,
  };
}

export function mapMyDayRpcPayload(raw: RawMyDayRpcPayload): MyDaySnapshot {
  return {
    capturedAt: raw.capturedAt,
    localDate: raw.localDate,
    scopeOwnerId: raw.scopeOwnerId,
    isTeamScope: raw.isTeamScope,
    canViewManagerSections: raw.canViewManagerSections,
    summary: raw.summary,
    tasks: {
      overdue: (raw.tasks.overdue ?? []).map(mapTaskRow),
      dueToday: (raw.tasks.dueToday ?? []).map(mapTaskRow),
      upcoming: (raw.tasks.upcoming ?? []).map(mapTaskRow),
    },
    attention: {
      noNextAction: (raw.attention.noNextAction ?? []).map(mapAttentionRow),
      newUncontacted: (raw.attention.newUncontacted ?? []).map(mapAttentionRow),
      unassigned: (raw.attention.unassigned ?? []).map(mapAttentionRow),
      slaBreaches: (raw.attention.slaBreaches ?? []).map(mapAttentionRow),
    },
  };
}

export function parseMyDayOwnerFilter(
  raw: string | string[] | undefined
): string | null {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value || value.trim() === "" || value === "team") {
    return null;
  }
  return value.trim();
}
