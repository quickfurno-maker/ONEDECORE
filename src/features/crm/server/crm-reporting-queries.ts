import "server-only";

import { createClient } from "@/lib/supabase/server";
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type {
  CrmReportingSnapshot,
  ReportAgingBucket,
  ReportAssigneeWorkloadItem,
  ReportClosedLostReasonItem,
  ReportFilters,
  ReportFollowUpMetrics,
  ReportSourceMixItem,
  ReportSummaryMetrics,
  ReportTrendPoint,
} from "../contracts/reporting-contracts.ts";
import { REPORT_AGING_BUCKET_DEFS } from "../contracts/reporting-contracts.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

interface LeadRow {
  readonly id: string;
  readonly status: string;
  readonly assigned_to: string | null;
  readonly primary_source_id: string | null;
  readonly created_at: string;
  readonly closed_lost_reason_id: string | null;
  readonly lead_sources?: { display_name: string | null } | null;
  readonly profiles?: { display_name: string | null } | null;
  readonly lead_closure_reasons?: { code: string; display_name: string } | null;
}

interface FollowUpRow {
  readonly id: string;
  readonly status: string;
  readonly due_at: string;
  readonly owner_id: string;
}

function assertReportingPermission(context: CrmAccessContext): void {
  if (!context.canReadCrmReporting) {
    throw new CrmError({
      code: "CRM_REPORTING_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

function applyLeadFilters(
  query: ReturnType<Awaited<ReturnType<typeof createClient>>["from"]>,
  filters: ReportFilters,
  context: CrmAccessContext
) {
  let builder = query
    .gte("created_at", filters.dateRange.startIso)
    .lte("created_at", filters.dateRange.endIso);

  if (filters.sourceId) {
    builder = builder.eq("primary_source_id", filters.sourceId);
  }
  if (filters.status) {
    builder = builder.eq("status", filters.status);
  }
  if (filters.assigneeId) {
    builder = builder.eq("assigned_to", filters.assigneeId);
  } else if (!context.canReadBroad) {
    builder = builder.eq("assigned_to", context.userId);
  }

  return builder;
}

function buildTrend(leads: readonly LeadRow[]): readonly ReportTrendPoint[] {
  const buckets = new Map<string, number>();
  for (const lead of leads) {
    const day = lead.created_at.slice(0, 10);
    buckets.set(day, (buckets.get(day) ?? 0) + 1);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([bucket, count]) => ({ bucket, count }));
}

function buildSourceMix(leads: readonly LeadRow[]): readonly ReportSourceMixItem[] {
  const map = new Map<string, ReportSourceMixItem>();
  for (const lead of leads) {
    const sourceId = lead.primary_source_id ?? "unknown";
    const existing = map.get(sourceId);
    if (existing) {
      map.set(sourceId, { ...existing, count: existing.count + 1 });
    } else {
      map.set(sourceId, {
        sourceId,
        sourceName: lead.lead_sources?.display_name ?? "Unknown",
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function buildAssigneeWorkload(
  leads: readonly LeadRow[]
): readonly ReportAssigneeWorkloadItem[] {
  const map = new Map<string, ReportAssigneeWorkloadItem>();
  for (const lead of leads) {
    const assigneeId = lead.assigned_to;
    const key = assigneeId ?? "unassigned";
    const existing = map.get(key);
    if (existing) {
      map.set(key, { ...existing, leadCount: existing.leadCount + 1 });
    } else {
      map.set(key, {
        assigneeId,
        assigneeName: assigneeId
          ? (lead.profiles?.display_name ?? "Assigned")
          : "Unassigned",
        leadCount: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.leadCount - a.leadCount);
}

function buildClosedLostReasons(
  leads: readonly LeadRow[]
): readonly ReportClosedLostReasonItem[] {
  const map = new Map<string, ReportClosedLostReasonItem>();
  for (const lead of leads) {
    if (lead.status !== "closed_lost" || !lead.lead_closure_reasons) {
      continue;
    }
    const code = lead.lead_closure_reasons.code;
    const existing = map.get(code);
    if (existing) {
      map.set(code, { ...existing, count: existing.count + 1 });
    } else {
      map.set(code, {
        reasonCode: code,
        reasonName: lead.lead_closure_reasons.display_name,
        count: 1,
      });
    }
  }
  return [...map.values()].sort((a, b) => b.count - a.count);
}

function buildAgingBuckets(leads: readonly LeadRow[], now: Date): readonly ReportAgingBucket[] {
  const nowMs = now.getTime();
  return REPORT_AGING_BUCKET_DEFS.map((def) => {
    const count = leads.filter((lead) => {
      if (lead.status === "closed_won" || lead.status === "closed_lost") {
        return false;
      }
      const ageDays = Math.floor(
        (nowMs - Date.parse(lead.created_at)) / 86_400_000
      );
      if (def.maxDays === null) {
        return ageDays >= def.minDays;
      }
      return ageDays >= def.minDays && ageDays <= def.maxDays;
    }).length;
    return {
      label: def.label,
      minDays: def.minDays,
      maxDays: def.maxDays,
      count,
    };
  });
}

function buildSummary(leads: readonly LeadRow[]): ReportSummaryMetrics {
  const statusCounts: Record<string, number> = {};
  let closedLostCount = 0;
  let closedWonCount = 0;
  for (const lead of leads) {
    statusCounts[lead.status] = (statusCounts[lead.status] ?? 0) + 1;
    if (lead.status === "closed_lost") {
      closedLostCount += 1;
    }
    if (lead.status === "closed_won") {
      closedWonCount += 1;
    }
  }
  return {
    totalLeads: leads.length,
    statusCounts,
    closedLostCount,
    closedWonCount,
  };
}

async function fetchFollowUpMetrics(
  filters: ReportFilters,
  context: CrmAccessContext,
  db?: CrmDb
): Promise<ReportFollowUpMetrics> {
  const supabase = await resolveCrmDb(db);
  const { data: followUps, error } = await supabase
    .from("lead_follow_ups")
    .select("id, status, due_at, owner_id, leads!inner(id, assigned_to, created_at)")
    .gte("leads.created_at", filters.dateRange.startIso)
    .lte("leads.created_at", filters.dateRange.endIso);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  const now = Date.now();
  const soonThreshold = now + 2 * 86_400_000;
  const rows = (followUps ?? []) as Array<
    FollowUpRow & { leads: { assigned_to: string | null } }
  >;

  const scoped = rows.filter((row) => {
    if (context.canReadBroad) {
      return true;
    }
    return row.leads.assigned_to === context.userId;
  });

  let open = 0;
  let overdue = 0;
  let completed = 0;
  let cancelled = 0;
  let dueSoon = 0;

  for (const row of scoped) {
    if (row.status === "open") {
      open += 1;
      const dueMs = Date.parse(row.due_at);
      if (dueMs < now) {
        overdue += 1;
      } else if (dueMs <= soonThreshold) {
        dueSoon += 1;
      }
    } else if (row.status === "completed") {
      completed += 1;
    } else if (row.status === "cancelled") {
      cancelled += 1;
    }
  }

  return { open, overdue, completed, cancelled, dueSoon };
}

/**
 * The reporting snapshot, for a caller whose access context is already known.
 *
 * The seven aggregations below `buildSummary`, `buildTrend`, `buildSourceMix`,
 * `buildAssigneeWorkload`, `fetchFollowUpMetrics`, `buildClosedLostReasons` and
 * `buildAgingBuckets` are the canonical definitions of trends, source mix,
 * workload, follow-up performance, lost reasons and the aging bands. They stay
 * here, in server TypeScript, and are never handed to a client to recompute.
 *
 * This function exists so the mobile read endpoint can run them for a bearer
 * caller: the context is passed in rather than resolved from cookies, and the
 * caller-scoped client is threaded into BOTH reads. `crm.reporting.read` is
 * still asserted here — the assertion is the gate, not the caller.
 */
export async function fetchCrmReportingSnapshotForContext(
  context: CrmAccessContext,
  filters: ReportFilters,
  db?: CrmDb
): Promise<CrmReportingSnapshot> {
  assertReportingPermission(context);

  const supabase = await resolveCrmDb(db);
  let query = supabase
    .from("leads")
    .select(
      "id, status, assigned_to, primary_source_id, created_at, closed_lost_reason_id, lead_sources!leads_primary_source_id_fkey(display_name), profiles!leads_assigned_to_fkey(display_name), lead_closure_reasons!fk_leads_closed_lost_reason(code, display_name)"
    );

  query = applyLeadFilters(query, filters, context) as typeof query;

  const { data, error } = await query;
  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  const leads = (data ?? []) as unknown as LeadRow[];
  const now = new Date();

  const [followUps] = await Promise.all([
    fetchFollowUpMetrics(filters, context, db),
  ]);

  return {
    summary: buildSummary(leads),
    trend: buildTrend(leads),
    sourceMix: buildSourceMix(leads),
    assigneeWorkload: buildAssigneeWorkload(leads),
    followUps,
    closedLostReasons: buildClosedLostReasons(leads),
    agingBuckets: buildAgingBuckets(leads, now),
  };
}

/**
 * The browser workspace's entry point, unchanged in behaviour.
 *
 * It resolves the cookie-scoped context, passes no client, and therefore keeps
 * the cookie-scoped default exactly as before.
 */
export async function fetchCrmReportingSnapshot(
  filters: ReportFilters
): Promise<CrmReportingSnapshot> {
  const context = await getCrmAccessContext();

  if (!context) {
    throw new CrmError({
      code: "CRM_REPORTING_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  return fetchCrmReportingSnapshotForContext(context, filters);
}
