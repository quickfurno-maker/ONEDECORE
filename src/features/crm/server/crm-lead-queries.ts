import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type {
  CrmAssigneeDirectoryEntry,
  CrmLeadClosureReasonOption,
  CrmLeadSourceOption,
} from "../contracts/lead-detail-dtos.ts";
import {
  escapeIlikePattern,
  hasLeadListActiveFilters,
  type LeadListPageResult,
  type LeadListQuery,
} from "../contracts/lead-list-query.ts";
import {
  mapLeadRowToListItem,
  type CrmLeadListItem,
  type CrmLeadListRow,
} from "../contracts/lead-dtos.ts";
import { deriveLeadScore } from "../contracts/lead-score-contracts.ts";
import {
  countSalesBuckets,
  emptySalesBucketCounts,
  resolveLeadSalesBucket,
  type CrmLeadSalesBucketCounts,
} from "../contracts/lead-sales-bucket.ts";
import { sortSegmentedLeads } from "../contracts/lead-segmentation-order.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  CRM_EMPTY_ENGAGEMENT,
  fetchLeadScoreBatch,
} from "./crm-lead-score-batch.ts";
import { latestIso } from "./crm-lead-score-signals.ts";

const CRM_LEAD_LIST_SELECT =
  "id, status, submitted_name, service_code, locality, assigned_to, entry_method, primary_source_id, created_at, updated_at, lead_sources!leads_primary_source_id_fkey(display_name)";

function startOfTodayIso(): string {
  const now = new Date();
  const start = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  return start.toISOString();
}

function endOfTodayIso(): string {
  const now = new Date();
  const end = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999)
  );
  return end.toISOString();
}

async function fetchLeadIdsForTextSearch(
  rawQuery: string
): Promise<readonly string[]> {
  const supabase = await createClient();
  const pattern = `%${escapeIlikePattern(rawQuery)}%`;

  const [nameResult, localityResult] = await Promise.all([
    supabase.from("leads").select("id").ilike("submitted_name", pattern),
    supabase.from("leads").select("id").ilike("locality", pattern),
  ]);

  if (nameResult.error) {
    throw crmErrorFromPostgresMessage(nameResult.error.message, "RPC_FAILED");
  }
  if (localityResult.error) {
    throw crmErrorFromPostgresMessage(localityResult.error.message, "RPC_FAILED");
  }

  return [
    ...new Set(
      [...(nameResult.data ?? []), ...(localityResult.data ?? [])].map((row) => row.id)
    ),
  ];
}

export async function fetchCrmAssigneeDirectory(
  context: CrmAccessContext
): Promise<readonly CrmAssigneeDirectoryEntry[]> {
  if (!context.canReadBroad) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_crm_assignable_executives");

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data ?? []).map((row) => ({
    userId: row.user_id,
    displayName: row.display_name,
    roleCode: row.role_code,
  }));
}

export async function fetchActiveLeadSources(): Promise<
  readonly CrmLeadSourceOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_sources")
    .select("id, code, display_name")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    displayName: row.display_name,
  }));
}

export async function fetchActiveLeadClosureReasons(): Promise<
  readonly CrmLeadClosureReasonOption[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_closure_reasons")
    .select("code, display_name")
    .eq("is_active", true)
    .order("display_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data ?? []).map((row) => ({
    code: row.code,
    displayName: row.display_name,
  }));
}

async function fetchLeadIdsForFollowUpDueFilter(
  filter: NonNullable<LeadListQuery["followUpDue"]>
): Promise<readonly string[]> {
  const supabase = await createClient();
  const startToday = startOfTodayIso();
  const endToday = endOfTodayIso();

  let query = supabase
    .from("lead_follow_ups")
    .select("lead_id")
    .eq("status", "open");

  if (filter === "overdue") {
    query = query.lt("due_at", startToday);
  } else if (filter === "today") {
    query = query.gte("due_at", startToday).lte("due_at", endToday);
  } else {
    query = query.gt("due_at", endToday);
  }

  const { data, error } = await query;
  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return [...new Set((data ?? []).map((row) => row.lead_id))];
}

async function fetchNextOpenFollowUpDueByLeadIds(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, string>>> {
  if (leadIds.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_follow_ups")
    .select("lead_id, due_at")
    .in("lead_id", [...leadIds])
    .eq("status", "open")
    .order("due_at", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!map[row.lead_id]) {
      map[row.lead_id] = row.due_at;
    }
  }

  return map;
}

function buildAssigneeLabelMap(
  directory: readonly CrmAssigneeDirectoryEntry[]
): Readonly<Record<string, string>> {
  return Object.fromEntries(directory.map((entry) => [entry.userId, entry.displayName]));
}

type LeadListFilterBuilder = {
  in: (column: string, values: readonly string[]) => LeadListFilterBuilder;
  eq: (column: string, value: string) => LeadListFilterBuilder;
  not: (column: string, operator: string, value: null) => LeadListFilterBuilder;
  is: (column: string, value: null) => LeadListFilterBuilder;
  gte: (column: string, value: string) => LeadListFilterBuilder;
  lt: (column: string, value: string) => LeadListFilterBuilder;
};

/**
 * PostgREST builders are PromiseLike. Returning one directly from an async
 * function assimilates/executes it before the caller can chain `.range()`.
 * Always wrap the builder in a plain object.
 */
type LeadListConstraintResult = {
  request: LeadListFilterBuilder;
};

async function constrainLeadListRequest(
  request: LeadListFilterBuilder,
  context: CrmAccessContext,
  query: LeadListQuery
): Promise<LeadListConstraintResult | null> {
  let next = request;
  if (query.q) {
    const leadIds = await fetchLeadIdsForTextSearch(query.q);
    if (leadIds.length === 0) {
      return null;
    }
    next = next.in("id", [...leadIds]);
  }

  if (query.status) {
    next = next.eq("status", query.status);
  }

  if (query.sourceId) {
    next = next.eq("primary_source_id", query.sourceId);
  }

  if (context.canReadBroad) {
    if (query.assignment === "assigned") {
      next = next.not("assigned_to", "is", null);
    } else if (query.assignment === "unassigned") {
      next = next.is("assigned_to", null);
    }

    if (query.assigneeId) {
      next = next.eq("assigned_to", query.assigneeId);
    }
  }

  if (query.followUpDue) {
    const leadIds = await fetchLeadIdsForFollowUpDueFilter(query.followUpDue);
    if (leadIds.length === 0) {
      return null;
    }
    next = next.in("id", [...leadIds]);
  }

  // RECEIVED-month cohort, on created_at. Never updated_at: a lead must not
  // move from August to September because someone edited it in September.
  // Half-open [start, next month start) so a lead at a boundary instant belongs
  // to exactly one month.
  if (!query.month.isAllTime && query.month.startIso && query.month.endIso) {
    next = next
      .gte("created_at", query.month.startIso)
      .lt("created_at", query.month.endIso);
  }

  return { request: next };
}

export async function countLeadListForQuery(
  context: CrmAccessContext,
  query: LeadListQuery
): Promise<number> {
  const supabase = await createClient();
  const constrained = await constrainLeadListRequest(
    supabase.from("leads").select("id", { count: "exact", head: true }),
    context,
    query
  );
  if (!constrained) {
    return 0;
  }
  const { count, error } = await (constrained.request as unknown as Promise<{
    count: number | null;
    error: { message: string } | null;
  }>);
  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }
  return count ?? 0;
}

/**
 * How many candidate rows one cohort scan will read, and the chunk it reads in.
 *
 * The cohort is read COMPLETELY in chunks rather than truncated: bucket counts
 * and bucket filtering are only correct over the whole cohort. The ceiling exists
 * so a pathological month cannot exhaust memory; reaching it sets
 * `cohortTruncated`, which the UI reports honestly instead of quietly showing
 * counts that are too low.
 */
export const CRM_LEAD_COHORT_CHUNK_SIZE = 500;
export const CRM_LEAD_COHORT_MAX_ROWS = 5_000;

export interface LeadSegmentationPageResult
  extends LeadListPageResult<CrmLeadListItem> {
  /** Exact counts over the WHOLE received-month cohort, before bucket filtering. */
  readonly bucketCounts: CrmLeadSalesBucketCounts;
  /** Rows in the cohort after bucket filtering, before the page slice. */
  readonly filteredTotal: number;
  readonly capturedAt: string;
  /** True only if the cohort exceeded `CRM_LEAD_COHORT_MAX_ROWS`. */
  readonly cohortTruncated: boolean;
}

/**
 * Reads the whole RLS-visible candidate cohort in bounded chunks.
 *
 * `.range()` is applied per chunk, so no single request has to return the entire
 * month. Rows arrive already ordered by (created_at, id) which makes the scan
 * deterministic and the truncation boundary reproducible.
 */
async function readCohortRows(
  context: CrmAccessContext,
  query: LeadListQuery
): Promise<{ rows: CrmLeadListRow[]; truncated: boolean } | null> {
  const supabase = await createClient();
  const rows: CrmLeadListRow[] = [];
  let offset = 0;

  for (;;) {
    const constrained = await constrainLeadListRequest(
      supabase
        .from("leads")
        .select(CRM_LEAD_LIST_SELECT)
        .order("created_at", { ascending: true })
        .order("id", { ascending: true }) as unknown as LeadListFilterBuilder,
      context,
      query
    );

    if (!constrained) {
      return null;
    }

    const { data, error } = await (
      constrained.request as unknown as {
        range: (
          from: number,
          to: number
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).range(offset, offset + CRM_LEAD_COHORT_CHUNK_SIZE - 1);

    if (error) {
      throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }

    const chunk = (data ?? []) as CrmLeadListRow[];
    rows.push(...chunk);

    if (chunk.length < CRM_LEAD_COHORT_CHUNK_SIZE) {
      return { rows, truncated: false };
    }
    offset += CRM_LEAD_COHORT_CHUNK_SIZE;

    if (rows.length >= CRM_LEAD_COHORT_MAX_ROWS) {
      // Reported, never silent.
      return { rows, truncated: true };
    }
  }
}

function emptySegmentationPage(
  query: LeadListQuery,
  capturedAt: string
): LeadSegmentationPageResult {
  return {
    items: [],
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: false,
      hasPreviousPage: query.page > 1,
    },
    hasActiveFilters: hasLeadListActiveFilters(query),
    bucketCounts: emptySalesBucketCounts(),
    filteredTotal: 0,
    capturedAt,
    cohortTruncated: false,
  };
}

/**
 * The segmented Leads read model.
 *
 * ORDER OF OPERATIONS MATTERS. The bucket is resolved for the WHOLE cohort
 * before anything is counted, filtered or sliced:
 *
 *   cohort scan -> batched signals -> score -> bucket -> counts -> bucket filter
 *   -> deterministic sales order -> page slice
 *
 * Scoring only the current database page would have made every bucket count a
 * count of that page, the bucket filter would have dropped matching leads that
 * happened to sit on other pages, and pagination would have been wrong. That is
 * why the score is not pushed into SQL either: duplicating the formula in a
 * second language is the other way this drifts.
 */
export async function queryLeadListPage(
  context: CrmAccessContext,
  query: LeadListQuery
): Promise<LeadSegmentationPageResult> {
  const capturedAt = new Date().toISOString();
  const now = Date.parse(capturedAt);

  const assigneeDirectory = await fetchCrmAssigneeDirectory(context);
  const assigneeLabels = buildAssigneeLabelMap(assigneeDirectory);

  const cohort = await readCohortRows(context, query);
  if (!cohort || cohort.rows.length === 0) {
    return emptySegmentationPage(query, capturedAt);
  }

  const leadIds = cohort.rows.map((row) => row.id);

  // Fixed number of batched round trips, independent of cohort size.
  const [batch, followUpDueMap] = await Promise.all([
    fetchLeadScoreBatch(leadIds),
    fetchNextOpenFollowUpDueByLeadIds(leadIds),
  ]);

  const scored = cohort.rows.map((row) => {
    const primary = batch.primaryActions[row.id] ?? null;
    const sla = batch.slaClocks.signals[row.id] ?? null;
    const engagement = batch.engagement[row.id] ?? CRM_EMPTY_ENGAGEMENT;
    const deal = batch.dealValues[row.id] ?? null;
    const touch = batch.salesTouches[row.id] ?? null;
    const status = row.status as LeadStageCode;

    // The SAME pure derivation the pipeline board and the lead detail use, from
    // the same signal shape. A lead cannot score differently on two surfaces.
    const score = deriveLeadScore(
      {
        status,
        isAssigned: row.assigned_to !== null,
        hasFirstContactAttempt: (sla?.firstContactAttemptAt ?? null) !== null,
        hasMeaningfulOutcome: engagement.hasMeaningfulOutcome,
        hasConsultationOrSiteVisit: engagement.hasConsultationOrSiteVisit,
        commercialState: deal?.state ?? "unknown",
        lastMeaningfulActivityAt: engagement.lastMeaningfulActivityAt,
        latestMeaningfulSalesTouchAt: latestIso([
          engagement.lastMeaningfulActivityAt,
          touch?.latestNoteAt ?? null,
          touch?.latestQuotationEventAt ?? null,
        ]),
        receivedAt: row.created_at,
        hasOpenPrimaryNextAction: primary !== null,
        primaryNextActionDueAt: primary?.dueAt ?? null,
        slaDueAt: sla?.slaDueAt ?? null,
      },
      now
    );

    return mapLeadRowToListItem(row, {
      assigneeLabel: row.assigned_to
        ? assigneeLabels[row.assigned_to] ?? "Assigned staff"
        : "Unassigned",
      nextFollowUpDue: followUpDueMap[row.id] ?? null,
      salesBucket: resolveLeadSalesBucket(status, score.band),
      priorityScore: score.priorityScore,
      scoreBand: score.band,
      riskFlags: score.riskFlags,
      stageEnteredAt: batch.stageEntries[row.id] ?? row.created_at,
      slaBreached:
        sla?.slaDueAt != null &&
        sla.firstContactAttemptAt == null &&
        Date.parse(sla.slaDueAt) < now,
      newUncontacted:
        row.assigned_to != null && (sla?.firstContactAttemptAt ?? null) == null,
    });
  });

  // Counts describe the whole cohort, so the strip keeps showing where the rest
  // of the month's leads are even while one bucket is selected.
  const bucketCounts = countSalesBuckets(scored.map((item) => item.salesBucket));

  const filtered = query.bucket
    ? scored.filter((item) => item.salesBucket === query.bucket)
    : scored;

  const ordered = sortSegmentedLeads(filtered, now);

  const from = (query.page - 1) * query.pageSize;
  const items = ordered.slice(from, from + query.pageSize);

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage: from + query.pageSize < ordered.length,
      hasPreviousPage: query.page > 1,
    },
    hasActiveFilters: hasLeadListActiveFilters(query),
    bucketCounts,
    filteredTotal: ordered.length,
    capturedAt,
    cohortTruncated: cohort.truncated,
  };
}
