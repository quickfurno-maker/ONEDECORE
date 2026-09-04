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
import { chunkLeadIds } from "../contracts/lead-batch-chunking.ts";
import {
  CRM_LEAD_COHORT_CHUNK_SIZE,
  CRM_LEAD_COHORT_MAX_ROWS,
  cohortScanVerdict,
  trimCohortRows,
} from "../contracts/lead-cohort-limits.ts";
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

/**
 * The expensive filter prerequisites, resolved ONCE per request.
 *
 * `q` and `followUpDue` are answered by separate lookups that return matching
 * lead ids. Resolving them inside the constraint builder meant the cohort scan
 * re-ran BOTH on every 500-row chunk. This type carries the already-resolved
 * result so the per-chunk work is pure.
 *
 * `matchedIds === null` means no id-restricting filter is active. An EMPTY array
 * means a filter matched nothing, which is a legitimate empty result, not an
 * absent filter — the two must never be conflated.
 */
export interface LeadListPreparedFilters {
  readonly matchedIds: readonly string[] | null;
}

function intersectIds(
  left: readonly string[] | null,
  right: readonly string[]
): readonly string[] {
  if (left === null) {
    return right;
  }
  const rightSet = new Set(right);
  return left.filter((id) => rightSet.has(id));
}

export async function prepareLeadListFilters(
  query: LeadListQuery
): Promise<LeadListPreparedFilters> {
  let matchedIds: readonly string[] | null = null;

  if (query.q) {
    matchedIds = intersectIds(matchedIds, await fetchLeadIdsForTextSearch(query.q));
  }

  if (query.followUpDue) {
    matchedIds = intersectIds(
      matchedIds,
      await fetchLeadIdsForFollowUpDueFilter(query.followUpDue)
    );
  }

  // Intersected in memory, so at most ONE id set is ever sent to Postgres and
  // it is the smaller of the two rather than both in full.
  return { matchedIds };
}

/**
 * Applies the prepared filters. PURE — no awaits, so it is safe to call once
 * per chunk inside the cohort scan.
 */
function constrainLeadListRequest(
  request: LeadListFilterBuilder,
  context: CrmAccessContext,
  query: LeadListQuery,
  prepared: LeadListPreparedFilters
): LeadListConstraintResult | null {
  let next = request;

  if (prepared.matchedIds !== null) {
    if (prepared.matchedIds.length === 0) {
      return null;
    }
    next = next.in("id", [...prepared.matchedIds]);
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

/* -------------------------------------------------------------------------- */
/* Dashboard "Recent Leads" — genuinely recent, deliberately NOT the queue      */
/* -------------------------------------------------------------------------- */

export const CRM_RECENT_LEADS_LIMIT = 8;

export interface CrmRecentLead {
  readonly id: string;
  readonly submittedName: string;
  readonly serviceCode: string;
  readonly locality: string | null;
  readonly status: LeadStageCode;
  readonly primarySourceLabel: string;
  readonly assigneeLabel: string;
  readonly createdAt: string;
}

/**
 * The newest leads by RECEIPT, for the operations dashboard.
 *
 * This exists because the Leads workspace read model became a conversion queue:
 * whole cohort -> score -> bucket -> HOT/WARM/COLD ranking -> page slice. Reusing
 * it for a panel titled "Recent Leads" showed the highest-PRIORITY leads instead
 * of the newest ones, and the activity feed built from it labelled a months-old
 * HOT lead "Lead created".
 *
 * So this is a deliberately small, separate read: one query, ordered by
 * `created_at` descending with a stable id tie-break, limited, and selecting only
 * the fields the dashboard renders. It runs NO scoring and no site-visit or
 * quotation fan-out — none of that is needed to answer "what came in last".
 *
 * Caller RLS applies exactly as everywhere else; there is no service-role path.
 */
export async function queryRecentLeads(
  context: CrmAccessContext,
  limit: number = CRM_RECENT_LEADS_LIMIT
): Promise<readonly CrmRecentLead[]> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("leads")
    .select(CRM_LEAD_LIST_SELECT)
    // Newest RECEIVED first. The id tie-break keeps the order total when two
    // leads share a created_at, so the panel does not reshuffle between loads.
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rows = (data ?? []) as CrmLeadListRow[];
  if (rows.length === 0) {
    return [];
  }

  const assigneeLabels = buildAssigneeLabelMap(
    await fetchCrmAssigneeDirectory(context)
  );

  return rows.map((row) => ({
    id: row.id,
    submittedName: row.submitted_name,
    serviceCode: row.service_code,
    locality: row.locality,
    status: row.status as LeadStageCode,
    primarySourceLabel: row.lead_sources?.display_name ?? "Unknown source",
    assigneeLabel: row.assigned_to
      ? assigneeLabels[row.assigned_to] ?? "Assigned staff"
      : "Unassigned",
    createdAt: row.created_at,
  }));
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
export { CRM_LEAD_COHORT_CHUNK_SIZE, CRM_LEAD_COHORT_MAX_ROWS };

export interface LeadSegmentationPageResult
  extends LeadListPageResult<CrmLeadListItem> {
  /**
   * Counts over the WHOLE received-month cohort, before bucket filtering.
   *
   * Only meaningful when `countsExact` is true. When the cohort exceeded the
   * read ceiling these are counts of what was READ, not of the month, and the
   * workspace must not render them as ordinary numbers.
   */
  readonly bucketCounts: CrmLeadSalesBucketCounts;
  /**
   * FALSE means the cohort was larger than one read pass could cover, so the
   * counts above are partial.
   *
   * Bucket counts are core sales numbers. Showing a partial figure that looks
   * exact is worse than showing none, so the strip suppresses the numbers rather
   * than quietly under-reporting a month.
   */
  readonly countsExact: boolean;
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
/**
 * Overflow result.
 *
 * The ceiling is compared with a STRICT `>` against a set that has read at least
 * one row beyond it, so a cohort of exactly `CRM_LEAD_COHORT_MAX_ROWS` is
 * complete and reports `truncated: false`. The previous `>=` marked an exactly
 * -full cohort as partial and needlessly suppressed correct counts.
 *
 * The surplus row is trimmed so callers never see more than the ceiling.
 */
function overflowed(rows: CrmLeadListRow[]): {
  rows: CrmLeadListRow[];
  truncated: boolean;
} {
  return {
    rows: [...trimCohortRows(rows, CRM_LEAD_COHORT_MAX_ROWS)],
    truncated: true,
  };
}

async function readCohortRows(
  context: CrmAccessContext,
  query: LeadListQuery,
  prepared: LeadListPreparedFilters
): Promise<{ rows: CrmLeadListRow[]; truncated: boolean } | null> {
  const supabase = await createClient();

  const baseRequest = () =>
    supabase
      .from("leads")
      .select(CRM_LEAD_LIST_SELECT)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true }) as unknown as LeadListFilterBuilder;

  // When an id-restricting filter is active the candidate set is ALREADY known,
  // so the scan walks it in bounded id chunks. That avoids sending one enormous
  // `.in(...)` list, and avoids re-sending the same list once per range page.
  //
  // The SAME ceiling applies here. It used to be enforced only on the
  // unfiltered path, so a broad `q` or `followUpDue` filter could pull an
  // unbounded cohort into memory and still report `truncated: false`.
  if (prepared.matchedIds !== null) {
    if (prepared.matchedIds.length === 0) {
      return null;
    }

    const rows: CrmLeadListRow[] = [];
    for (const idChunk of chunkLeadIds(prepared.matchedIds)) {
      const constrained = constrainLeadListRequest(
        baseRequest(),
        context,
        query,
        { matchedIds: idChunk }
      );
      if (!constrained) {
        continue;
      }

      const { data, error } = await (
        constrained.request as unknown as Promise<{
          data: unknown;
          error: { message: string } | null;
        }>
      );

      if (error) {
        throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
      }
      const idRows = (data ?? []) as CrmLeadListRow[];
      rows.push(...idRows);

      // Same ceiling as the unfiltered scan. `expectFullChunkOf: null` because
      // chunk sizes here follow the id list, not the number of matching rows.
      if (
        cohortScanVerdict(rows.length, idRows.length, {
          expectFullChunkOf: null,
          maxRows: CRM_LEAD_COHORT_MAX_ROWS,
        }) === "truncated"
      ) {
        return overflowed(rows);
      }
    }
    return { rows, truncated: false };
  }

  const rows: CrmLeadListRow[] = [];
  let offset = 0;

  for (;;) {
    const constrained = constrainLeadListRequest(
      baseRequest(),
      context,
      query,
      prepared
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

    const verdict = cohortScanVerdict(rows.length, chunk.length, {
      expectFullChunkOf: CRM_LEAD_COHORT_CHUNK_SIZE,
      maxRows: CRM_LEAD_COHORT_MAX_ROWS,
    });
    if (verdict === "truncated") {
      return overflowed(rows);
    }
    if (verdict === "complete") {
      return { rows, truncated: false };
    }
    offset += CRM_LEAD_COHORT_CHUNK_SIZE;
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
    countsExact: true,
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

  // Resolved ONCE per request. Doing this inside the scan re-ran the text and
  // follow-up lookups for every chunk of the cohort.
  const prepared = await prepareLeadListFilters(query);

  const cohort = await readCohortRows(context, query, prepared);
  if (!cohort || cohort.rows.length === 0) {
    return emptySegmentationPage(query, capturedAt);
  }

  const leadIds = cohort.rows.map((row) => row.id);

  // A fixed number of batched query GROUPS, each chunking its own lead-id list.
  // Bounded and free of per-lead reads — not a constant number of requests.
  const batch = await fetchLeadScoreBatch(leadIds);

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
      // The CANONICAL primary next action, not any open follow-up. The generic
      // one let a lead with no primary action dodge the `no_next_action` rank.
      primaryNextActionDueAt: primary?.dueAt ?? null,
      primaryNextActionTitle: primary?.title ?? null,
      // Milestones, kept separate from bucket and stage.
      siteVisitState: batch.siteVisits[row.id] ?? "none",
      quotationState: deal?.state ?? "unknown",
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
  // of the month's leads are even while one bucket is selected. They are only
  // EXACT when the whole cohort was read.
  const bucketCounts = countSalesBuckets(scored.map((item) => item.salesBucket));
  const countsExact = !cohort.truncated;

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
    countsExact,
    filteredTotal: ordered.length,
    capturedAt,
    cohortTruncated: cohort.truncated,
  };
}
