/**
 * The Sales Manager dashboard — its contract, and the pure derivations the
 * page renders.
 *
 * WHY THIS IS A DEDICATED CONTRACT
 *
 * The Super Admin dashboard is the owner's view of the whole business:
 * campaigns, commerce, payroll, portfolio, the lot. The manager's dashboard is
 * not that view with cards hidden — hiding is a rendering decision, and a
 * rendering decision is not a boundary. This module describes a SEPARATE
 * dashboard whose every field is something a Sales Manager is already
 * authorised to read through an existing canonical read model.
 *
 * THE THREE ABSENCES THIS FILE EXISTS TO KEEP APART
 *
 *   `0`               the source answered, and the answer is none.
 *   `No data`         the source answered, but the ratio has no denominator.
 *                     A won-rate over zero enquiries is NOT 0%.
 *   `Unavailable`     the read failed. We do not know the number.
 *   `Not configured`  nobody has set a target for this period.
 *
 * Collapsing any of those into another is how a dashboard starts lying. Every
 * value on this page therefore carries its own state alongside its number, and
 * the display string is derived from the state — never from `value ?? 0`.
 */

import { formatCrmCodeLabel } from "../../crm/contracts/crm-labels.ts";
import { formatBasisPointsPercent } from "../../crm/contracts/management-analytics-contracts.ts";
import { formatInrFromPaise } from "../../crm/contracts/sales-target-contracts.ts";
import type { MyDaySnapshot } from "../../crm/contracts/my-day-contracts.ts";
import type { ReportAssigneeWorkloadItem } from "../../crm/contracts/reporting-contracts.ts";
import type { ProjectHighLevelStatus } from "../../projects/server/project-high-level-queries.ts";

/* -------------------------------------------------------------------------- */
/* Value states                                                                */
/* -------------------------------------------------------------------------- */

export const MANAGER_UNAVAILABLE_LABEL = "Unavailable";
export const MANAGER_NO_DATA_LABEL = "No data";
export const MANAGER_NOT_CONFIGURED_LABEL = "Not configured";

export type ManagerValueState =
  | "known"
  | "no_data"
  | "unavailable"
  | "not_configured";

/**
 * A panel either rendered from data, or explicitly declared unreadable.
 *
 * There is no third case where a panel renders zeros because its read threw:
 * the union has no shape for it, so the page cannot accidentally do it.
 */
export type ManagerPanelState<T> =
  | { readonly status: "ready"; readonly data: T }
  | { readonly status: "unavailable"; readonly note: string };

export function managerPanelReady<T>(data: T): ManagerPanelState<T> {
  return { status: "ready", data };
}

export function managerPanelUnavailable<T>(note: string): ManagerPanelState<T> {
  return { status: "unavailable", note };
}

/* -------------------------------------------------------------------------- */
/* Identity                                                                    */
/* -------------------------------------------------------------------------- */

export interface ManagerDashboardIdentity {
  readonly userId: string;
  readonly displayName: string;
  readonly firstName: string;
  readonly roleLabel: string;
}

/* -------------------------------------------------------------------------- */
/* Execution — the manager's own day, from `get_crm_my_day`                    */
/* -------------------------------------------------------------------------- */

export const MANAGER_ATTENTION_REASONS = [
  "sla_breach",
  "overdue_follow_up",
  "unassigned",
  "no_next_action",
  "new_uncontacted",
] as const;

export type ManagerAttentionReason = (typeof MANAGER_ATTENTION_REASONS)[number];

/**
 * Worst first. An SLA breach is a promise already broken; an uncontacted new
 * enquiry is a promise not yet broken. A manager reading top-to-bottom should
 * be reading in the order the work actually has to be done.
 */
export const MANAGER_ATTENTION_PRIORITY: readonly ManagerAttentionReason[] =
  MANAGER_ATTENTION_REASONS;

const ATTENTION_REASON_LABELS: Readonly<Record<ManagerAttentionReason, string>> =
  {
    sla_breach: "SLA breached",
    overdue_follow_up: "Follow-up overdue",
    unassigned: "Unassigned",
    no_next_action: "No next action",
    new_uncontacted: "New, not contacted",
  };

export function managerAttentionReasonLabel(
  reason: ManagerAttentionReason
): string {
  return ATTENTION_REASON_LABELS[reason];
}

/**
 * One row of the Needs Attention queue.
 *
 * Deliberately no email address, no phone number and no message body. The
 * manager needs to know WHICH enquiry is slipping and WHO holds it; the
 * customer's contact details belong on the lead itself, behind the lead's own
 * permission check, and a dashboard is a bad place to leak them from.
 */
export interface ManagerAttentionItem {
  readonly key: string;
  readonly leadId: string;
  readonly leadLabel: string;
  readonly stageLabel: string;
  /** `null` means genuinely unassigned — rendered as such, never as blank. */
  readonly assigneeLabel: string | null;
  readonly reason: ManagerAttentionReason;
  readonly reasonLabel: string;
  readonly occurredAt: string;
  readonly occurredLabel: string;
  readonly href: string;
}

export interface ManagerExecutionSummary {
  readonly overdue: number;
  readonly dueToday: number;
  readonly upcoming: number;
  readonly noNextAction: number;
  readonly newUncontacted: number;
  readonly unassigned: number;
  readonly slaBreaches: number;
}

export interface ManagerExecutionSection {
  readonly localDate: string;
  readonly isTeamScope: boolean;
  readonly summary: ManagerExecutionSummary;
  readonly attention: readonly ManagerAttentionItem[];
  /** Every row that qualifies, not only the bounded ones rendered. */
  readonly attentionTotal: number;
}

/** How many attention rows the panel renders. Bounded on purpose. */
export const MANAGER_ATTENTION_LIMIT = 8;

function stageLabel(code: string): string {
  return formatCrmCodeLabel(code.replaceAll("_", "-"));
}

function leadHref(leadId: string): string {
  return `/admin/crm/leads/${leadId}`;
}

/**
 * Flattens My Day into one priority-ordered queue.
 *
 * A lead can qualify twice — unassigned AND uncontacted is common — so rows are
 * de-duplicated by lead, keeping the most urgent reason. Showing the same
 * enquiry three times would make the queue look longer than the problem is.
 *
 * `total` comes from the RPC's summary counters rather than from the returned
 * rows, because the rows are themselves capped upstream: counting them would
 * quietly under-report the backlog.
 */
export function buildManagerAttentionQueue(
  myDay: MyDaySnapshot,
  limit: number = MANAGER_ATTENTION_LIMIT
): { readonly items: readonly ManagerAttentionItem[]; readonly total: number } {
  const candidates: ManagerAttentionItem[] = [];

  for (const row of myDay.attention.slaBreaches) {
    candidates.push({
      key: `sla_breach:${row.leadId}`,
      leadId: row.leadId,
      leadLabel: row.leadDisplayLabel,
      stageLabel: stageLabel(row.leadStatus),
      assigneeLabel: row.assigneeLabel,
      reason: "sla_breach",
      reasonLabel: ATTENTION_REASON_LABELS.sla_breach,
      occurredAt: row.slaDueAt ?? row.receivedAt,
      occurredLabel: row.slaDueAt ? "SLA due" : "Received",
      href: leadHref(row.leadId),
    });
  }

  for (const row of myDay.tasks.overdue) {
    candidates.push({
      key: `overdue_follow_up:${row.activityId}`,
      leadId: row.leadId,
      leadLabel: row.leadDisplayLabel,
      stageLabel: stageLabel(row.leadStatus),
      assigneeLabel: row.ownerLabel,
      reason: "overdue_follow_up",
      reasonLabel: ATTENTION_REASON_LABELS.overdue_follow_up,
      occurredAt: row.dueAt,
      occurredLabel: "Due",
      href: leadHref(row.leadId),
    });
  }

  for (const row of myDay.attention.unassigned) {
    candidates.push({
      key: `unassigned:${row.leadId}`,
      leadId: row.leadId,
      leadLabel: row.leadDisplayLabel,
      stageLabel: stageLabel(row.leadStatus),
      assigneeLabel: null,
      reason: "unassigned",
      reasonLabel: ATTENTION_REASON_LABELS.unassigned,
      occurredAt: row.receivedAt,
      occurredLabel: "Received",
      href: leadHref(row.leadId),
    });
  }

  for (const row of myDay.attention.noNextAction) {
    candidates.push({
      key: `no_next_action:${row.leadId}`,
      leadId: row.leadId,
      leadLabel: row.leadDisplayLabel,
      stageLabel: stageLabel(row.leadStatus),
      assigneeLabel: row.assigneeLabel,
      reason: "no_next_action",
      reasonLabel: ATTENTION_REASON_LABELS.no_next_action,
      occurredAt: row.receivedAt,
      occurredLabel: "Received",
      href: leadHref(row.leadId),
    });
  }

  for (const row of myDay.attention.newUncontacted) {
    candidates.push({
      key: `new_uncontacted:${row.leadId}`,
      leadId: row.leadId,
      leadLabel: row.leadDisplayLabel,
      stageLabel: stageLabel(row.leadStatus),
      assigneeLabel: row.assigneeLabel,
      reason: "new_uncontacted",
      reasonLabel: ATTENTION_REASON_LABELS.new_uncontacted,
      occurredAt: row.receivedAt,
      occurredLabel: "Received",
      href: leadHref(row.leadId),
    });
  }

  const rank = (reason: ManagerAttentionReason) =>
    MANAGER_ATTENTION_PRIORITY.indexOf(reason);

  candidates.sort((a, b) => {
    const byReason = rank(a.reason) - rank(b.reason);
    if (byReason !== 0) {
      return byReason;
    }
    // Within a reason, the oldest problem is the most urgent one.
    return a.occurredAt.localeCompare(b.occurredAt);
  });

  const seen = new Set<string>();
  const items: ManagerAttentionItem[] = [];
  for (const candidate of candidates) {
    if (seen.has(candidate.leadId)) {
      continue;
    }
    seen.add(candidate.leadId);
    items.push(candidate);
    if (items.length >= limit) {
      break;
    }
  }

  const summary = myDay.summary;
  const total =
    summary.slaBreaches +
    summary.overdue +
    summary.unassigned +
    summary.noNextAction +
    summary.newUncontacted;

  return { items, total };
}

/* -------------------------------------------------------------------------- */
/* CRM — this month, from the canonical reporting snapshot                     */
/* -------------------------------------------------------------------------- */

/**
 * One row of Team Workload.
 *
 * WHAT THIS IS NOT: a scoreboard. There is no conversion rate per person, no
 * response-time-per-person, no ranking and no ordering by volume — a dashboard
 * that sorts people by a number invents a performance metric whether or not it
 * calls it one. Rows are ordered by name, and Unassigned is lifted out
 * entirely because it is a queue, not a person.
 */
export interface ManagerWorkloadRow {
  readonly assigneeId: string | null;
  readonly label: string;
  readonly leadCount: number;
}

export interface ManagerWorkload {
  readonly members: readonly ManagerWorkloadRow[];
  /** `null` when nothing in the period is unassigned. `0` never appears. */
  readonly unassigned: ManagerWorkloadRow | null;
  readonly assignedTotal: number;
}

export function buildManagerWorkload(
  items: readonly ReportAssigneeWorkloadItem[]
): ManagerWorkload {
  const members: ManagerWorkloadRow[] = [];
  let unassigned: ManagerWorkloadRow | null = null;

  for (const item of items) {
    if (item.assigneeId === null) {
      unassigned = {
        assigneeId: null,
        label: "Unassigned",
        leadCount: item.leadCount,
      };
      continue;
    }
    members.push({
      assigneeId: item.assigneeId,
      label: item.assigneeName,
      leadCount: item.leadCount,
    });
  }

  members.sort((a, b) => a.label.localeCompare(b.label));

  return {
    members,
    unassigned,
    assignedTotal: members.reduce((sum, row) => sum + row.leadCount, 0),
  };
}

export interface ManagerCrmSection {
  readonly rangeLabel: string;
  readonly totalLeads: number;
  readonly closedWonCount: number;
  readonly closedLostCount: number;
  readonly openFollowUps: number;
  readonly overdueFollowUps: number;
  readonly workload: ManagerWorkload;
}

/* -------------------------------------------------------------------------- */
/* Management — SLA, conversion and target attainment                          */
/* -------------------------------------------------------------------------- */

/**
 * The single target the card shows.
 *
 * `achievedPaise === null` means accepted-quotation truth is not readable by
 * this caller, which is a different statement from "achieved nothing". The card
 * says so rather than printing ₹0.
 */
export interface ManagerTargetAttainment {
  readonly label: string;
  readonly revenueTargetPaise: number;
  readonly achievedPaise: number | null;
  readonly attainmentBasisPoints: number | null;
  readonly closedWonCountTarget: number;
  readonly acceptedCount: number | null;
}

export interface ManagerManagementSection {
  readonly period: string;
  readonly slaComplianceBasisPoints: number | null;
  readonly slaDecidedCount: number;
  readonly slaBreachedCount: number;
  readonly wonRateBasisPoints: number | null;
  readonly receivedCount: number;
  readonly medianFirstContactSeconds: number | null;
  /** `null` = no target configured for the period. Never a zero target. */
  readonly target: ManagerTargetAttainment | null;
}

/* -------------------------------------------------------------------------- */
/* Projects — high-level status only                                           */
/* -------------------------------------------------------------------------- */

export const MANAGER_PROJECT_ROW_LIMIT = 8;

export interface ManagerProjectRow {
  readonly projectId: string;
  readonly projectNumber: string;
  readonly clientLabel: string;
  readonly statusLabel: string;
  readonly stageLabel: string;
  readonly ownerLabel: string | null;
  readonly updatedAt: string;
  readonly href: string;
}

export interface ManagerProjectsSection {
  readonly rows: readonly ManagerProjectRow[];
  readonly totalCount: number;
}

/**
 * Where a project has reached, said in one phrase.
 *
 * The manager is not running these — a Project Manager is. This is a status
 * line, so it reads the furthest-along fact that is true and stops there.
 */
export function managerProjectStageLabel(
  project: ProjectHighLevelStatus
): string {
  if (project.executionCompletedAt) {
    return "Execution complete";
  }
  if (project.executionState) {
    return `Execution — ${stageLabel(project.executionState)}`;
  }
  if (project.designCompletedAt) {
    return "Design complete";
  }
  if (project.designState) {
    return `Design — ${stageLabel(project.designState)}`;
  }
  if (project.handoverAcceptedAt) {
    return "Handover accepted";
  }
  return "Handover pending";
}

function projectUpdatedAt(project: ProjectHighLevelStatus): string {
  return (
    project.executionUpdatedAt ??
    project.designCompletedAt ??
    project.designStartedAt ??
    project.handoverAcceptedAt ??
    project.createdAt
  );
}

export function buildManagerProjectRows(
  projects: readonly ProjectHighLevelStatus[],
  limit: number = MANAGER_PROJECT_ROW_LIMIT
): ManagerProjectsSection {
  const rows = [...projects]
    .map((project) => ({
      projectId: project.projectId,
      projectNumber: project.projectNumber,
      clientLabel: project.clientDisplayName ?? "—",
      statusLabel: stageLabel(project.status),
      stageLabel: managerProjectStageLabel(project),
      ownerLabel: project.currentProjectManager,
      updatedAt: projectUpdatedAt(project),
      href: "/admin/projects",
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);

  return { rows, totalCount: projects.length };
}

/* -------------------------------------------------------------------------- */
/* The snapshot                                                                */
/* -------------------------------------------------------------------------- */

export interface ManagerDashboardSnapshot {
  readonly capturedAt: string;
  readonly localDate: string;
  readonly identity: ManagerDashboardIdentity;
  /**
   * Not a panel state. My Day is the primary CRM read: if it fails the
   * dashboard fails closed rather than rendering a shell of empty numbers.
   */
  readonly execution: ManagerExecutionSection;
  readonly crm: ManagerPanelState<ManagerCrmSection>;
  readonly management: ManagerPanelState<ManagerManagementSection>;
  readonly projects: ManagerPanelState<ManagerProjectsSection>;
}

/* -------------------------------------------------------------------------- */
/* The KPI strip                                                               */
/* -------------------------------------------------------------------------- */

export type ManagerKpiKey =
  | "sla_breaches"
  | "overdue"
  | "due_today"
  | "unassigned"
  | "new_this_month"
  | "won_rate";

export interface ManagerKpi {
  readonly key: ManagerKpiKey;
  readonly label: string;
  readonly state: ManagerValueState;
  /** `null` whenever `state !== "known"`. Never a stand-in for zero. */
  readonly value: number | null;
  readonly display: string;
  readonly hint: string;
  readonly href: string | null;
}

function knownCount(value: number): Pick<ManagerKpi, "state" | "value" | "display"> {
  return { state: "known", value, display: String(value) };
}

function unavailable(): Pick<ManagerKpi, "state" | "value" | "display"> {
  return {
    state: "unavailable",
    value: null,
    display: MANAGER_UNAVAILABLE_LABEL,
  };
}

/**
 * A rate whose denominator may not exist.
 *
 * `formatBasisPointsPercent` already refuses to print `0%` for `null`; the
 * state carried alongside it is what stops a caller reaching for `?? 0`.
 */
function knownRate(
  basisPoints: number | null
): Pick<ManagerKpi, "state" | "value" | "display"> {
  if (basisPoints === null) {
    return {
      state: "no_data",
      value: null,
      display: MANAGER_NO_DATA_LABEL,
    };
  }
  return {
    state: "known",
    value: basisPoints,
    display: formatBasisPointsPercent(basisPoints),
  };
}

/**
 * Six cards, in the order a sales manager actually triages.
 *
 * The first four come from the primary My Day read and are therefore always
 * known. The last two come from optional panels and say `Unavailable` when
 * those panels could not be read — which is the whole reason each card carries
 * its own state instead of the strip carrying one.
 */
export function buildManagerKpiStrip(
  snapshot: ManagerDashboardSnapshot
): readonly ManagerKpi[] {
  const summary = snapshot.execution.summary;

  return [
    {
      key: "sla_breaches",
      label: "SLA breaches",
      hint: "First-response promises already missed.",
      href: "/admin/crm/leads",
      ...knownCount(summary.slaBreaches),
    },
    {
      key: "overdue",
      label: "Overdue follow-ups",
      hint: "Scheduled follow-ups past their due time.",
      href: "/admin/crm/leads",
      ...knownCount(summary.overdue),
    },
    {
      key: "due_today",
      label: "Due today",
      hint: "Follow-ups scheduled for today (IST).",
      href: "/admin/crm/leads",
      ...knownCount(summary.dueToday),
    },
    {
      key: "unassigned",
      label: "Unassigned enquiries",
      hint: "Waiting for an owner.",
      href: "/admin/crm/leads",
      ...knownCount(summary.unassigned),
    },
    {
      key: "new_this_month",
      label: "New this month",
      hint: "Enquiries received this month (IST).",
      href: "/admin/crm/reports",
      ...(snapshot.crm.status === "ready"
        ? knownCount(snapshot.crm.data.totalLeads)
        : unavailable()),
    },
    {
      key: "won_rate",
      label: "Won rate",
      hint: "Closed-Won share of this month's enquiries.",
      href: "/admin/crm/reports",
      ...(snapshot.management.status === "ready"
        ? knownRate(snapshot.management.data.wonRateBasisPoints)
        : unavailable()),
    },
  ];
}

/* -------------------------------------------------------------------------- */
/* Display helpers                                                             */
/* -------------------------------------------------------------------------- */

/** Money that may be unreadable rather than zero. */
export function formatManagerPaise(paise: number | null): string {
  return paise === null ? MANAGER_UNAVAILABLE_LABEL : formatInrFromPaise(paise);
}

/** A count that may be unreadable rather than zero. */
export function formatManagerCount(value: number | null): string {
  return value === null ? MANAGER_UNAVAILABLE_LABEL : String(value);
}

export function formatManagerAttainment(
  basisPoints: number | null
): string {
  return formatBasisPointsPercent(basisPoints, MANAGER_NO_DATA_LABEL);
}
