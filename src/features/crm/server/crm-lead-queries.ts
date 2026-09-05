import "server-only";

import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
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
  resolveEffectiveSalesBucket,
  type CrmLeadSalesBucketCounts,
} from "../contracts/lead-sales-bucket.ts";
import { parseManualSalesTemperature } from "../contracts/lead-sales-temperature.ts";
import { sortSegmentedLeads } from "../contracts/lead-segmentation-order.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { chunkLeadIds } from "../contracts/lead-batch-chunking.ts";
import { collectAllIds, unionIds } from "../contracts/lead-id-discovery.ts";
import {
  CRM_LEAD_COHORT_CHUNK_SIZE,
  CRM_LEAD_COHORT_MAX_ROWS,
  cohortScanVerdict,
  trimCohortRows,
} from "../contracts/lead-cohort-limits.ts";
import {
  CRM_EMPTY_ENGAGEMENT,
  fetchLeadScoreBatch,
  type CrmLeadScoreBatch,
} from "./crm-lead-score-batch.ts";
import { latestIso } from "./crm-lead-score-signals.ts";

const CRM_LEAD_LIST_SELECT =
  "id, status, submitted_name, service_code, locality, assigned_to, manual_sales_temperature, entry_method, primary_source_id, created_at, updated_at, lead_sources!leads_primary_source_id_fkey(display_name)";

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

/**
 * Every lead id whose name or locality matches, PAGED to exhaustion.
 *
 * These two selects used to be unpaginated, and `[api] max_rows = 1000` in
 * `supabase/config.toml` caps a Data API response at 1000 rows with no signal
 * that more existed. A search matching more than that silently lost leads before
 * the cohort scan, so they could never reach the bucket counts, the filter, the
 * ranking or the page — while the counts still claimed to be exact.
 *
 * Ordered by `id` ascending, which is unique, so ranging is stable and no row is
 * skipped or repeated between pages. Caller RLS still decides visibility.
 */
async function fetchLeadIdsForTextSearch(
  rawQuery: string,
  db?: CrmDb
): Promise<readonly string[]> {
  const supabase = await resolveCrmDb(db);
  const pattern = `%${escapeIlikePattern(rawQuery)}%`;

  const pageFetcher =
    (column: "submitted_name" | "locality") =>
    async (from: number, to: number): Promise<readonly string[]> => {
      const { data, error } = await supabase
        .from("leads")
        .select("id")
        .ilike(column, pattern)
        .order("id", { ascending: true })
        .range(from, to);

      if (error) {
        throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
      }
      return (data ?? []).map((row) => row.id as string);
    };

  const [names, localities] = await Promise.all([
    collectAllIds(pageFetcher("submitted_name")),
    collectAllIds(pageFetcher("locality")),
  ]);

  // Full union of two COMPLETE sets — a lead matching both is counted once, and
  // a lead that only appears on a later page of either is still present.
  return unionIds(names, localities);
}

export async function fetchCrmAssigneeDirectory(
  context: CrmAccessContext,
  db?: CrmDb
): Promise<readonly CrmAssigneeDirectoryEntry[]> {
  if (!context.canReadBroad) {
    return [];
  }

  const supabase = await resolveCrmDb(db);
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

export async function fetchActiveLeadSources(db?: CrmDb): Promise<
  readonly CrmLeadSourceOption[]
> {
  const supabase = await resolveCrmDb(db);
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

export async function fetchActiveLeadClosureReasons(db?: CrmDb): Promise<
  readonly CrmLeadClosureReasonOption[]
> {
  const supabase = await resolveCrmDb(db);
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
  filter: NonNullable<LeadListQuery["followUpDue"]>,
  db?: CrmDb
): Promise<readonly string[]> {
  const supabase = await resolveCrmDb(db);
  const startToday = startOfTodayIso();
  const endToday = endOfTodayIso();

  // Paged to exhaustion for the same reason as the text search, and this one is
  // more exposed: it returns follow-up ROWS and de-duplicates `lead_id`
  // afterwards, so 1000 rows can describe a handful of leads while every other
  // matching lead sits unread on a later page.
  //
  // Ordered by (due_at, id) — id is unique, so the total order is stable and
  // ranging cannot skip or repeat a row.
  const pageFetcher = async (
    from: number,
    to: number
  ): Promise<readonly string[]> => {
    let query = supabase
      .from("lead_follow_ups")
      .select("lead_id, due_at")
      .eq("status", "open");

    if (filter === "overdue") {
      query = query.lt("due_at", startToday);
    } else if (filter === "today") {
      query = query.gte("due_at", startToday).lte("due_at", endToday);
    } else {
      query = query.gt("due_at", endToday);
    }

    const { data, error } = await query
      .order("due_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (error) {
      throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }
    // Raw per-ROW ids: `collectAllIds` de-duplicates, but decides whether to
    // request another page from the ROW count, so duplicates never end
    // discovery early.
    return (data ?? []).map((row) => row.lead_id as string);
  };

  return collectAllIds(pageFetcher);
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

/**
 * Resolved ONCE per request.
 *
 * Discovery is deliberately NOT capped at the 5,000-row cohort ceiling: the
 * month, status, source and assignment filters have not been applied yet, so an
 * id dropped here could be one that would have survived them. The ceiling
 * belongs to the SCORED cohort, which is where memory is actually at risk.
 */
export async function prepareLeadListFilters(
  query: LeadListQuery,
  db?: CrmDb
): Promise<LeadListPreparedFilters> {
  let matchedIds: readonly string[] | null = null;

  if (query.q) {
    matchedIds = intersectIds(matchedIds, await fetchLeadIdsForTextSearch(query.q, db));
  }

  if (query.followUpDue) {
    matchedIds = intersectIds(
      matchedIds,
      await fetchLeadIdsForFollowUpDueFilter(query.followUpDue, db)
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
  limit: number = CRM_RECENT_LEADS_LIMIT,
  db?: CrmDb
): Promise<readonly CrmRecentLead[]> {
  const supabase = await resolveCrmDb(db);

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
  prepared: LeadListPreparedFilters,
  db?: CrmDb
): Promise<{ rows: CrmLeadListRow[]; truncated: boolean } | null> {
  const supabase = await resolveCrmDb(db);

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
 * ONE lead row plus its batched signals, turned into the canonical list item.
 *
 * Extracted so the Leads cohort read and the single-lead mobile detail read run
 * the IDENTICAL derivation. Parity is structural rather than reviewed: a lead
 * cannot score one way in a list and another way when opened directly, because
 * there is only one function that can answer.
 *
 * Every derived value comes from a shared pure helper — `deriveLeadScore` for
 * the score, its band and the risk flags, `resolveEffectiveSalesBucket` for the
 * owner-facing bucket and its provenance. Nothing is recomputed inline, and the
 * milestones come from canonical evidence rather than from the stage.
 */
export function enrichLeadRow(
  row: CrmLeadListRow,
  batch: CrmLeadScoreBatch,
  assigneeLabels: Record<string, string>,
  now: number
): CrmLeadListItem {
  const primary = batch.primaryActions[row.id] ?? null;
  const sla = batch.slaClocks.signals[row.id] ?? null;
  const engagement = batch.engagement[row.id] ?? CRM_EMPTY_ENGAGEMENT;
  const deal = batch.dealValues[row.id] ?? null;
  const touch = batch.salesTouches[row.id] ?? null;
  const status = row.status as LeadStageCode;
  const manualSalesTemperature = parseManualSalesTemperature(
    row.manual_sales_temperature
  );

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
    ...(() => {
      // ONE canonical resolver: lifecycle > manual temperature > score band.
      const effective = resolveEffectiveSalesBucket(
        status,
        score.band,
        manualSalesTemperature
      );
      return {
        salesBucket: effective.bucket,
        salesBucketSource: effective.source,
      };
    })(),
    manualSalesTemperature,
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
  query: LeadListQuery,
  db?: CrmDb
): Promise<LeadSegmentationPageResult> {
  const capturedAt = new Date().toISOString();
  const now = Date.parse(capturedAt);

  const assigneeDirectory = await fetchCrmAssigneeDirectory(context, db);
  const assigneeLabels = buildAssigneeLabelMap(assigneeDirectory);

  // Resolved ONCE per request. Doing this inside the scan re-ran the text and
  // follow-up lookups for every chunk of the cohort.
  const prepared = await prepareLeadListFilters(query, db);

  const cohort = await readCohortRows(context, query, prepared, db);
  if (!cohort || cohort.rows.length === 0) {
    return emptySegmentationPage(query, capturedAt);
  }

  const leadIds = cohort.rows.map((row) => row.id);

  // A fixed number of batched query GROUPS, each chunking its own lead-id list.
  // Bounded and free of per-lead reads — not a constant number of requests.
  const batch = await fetchLeadScoreBatch(leadIds, db);

  const scored = cohort.rows.map((row) =>
    enrichLeadRow(row, batch, assigneeLabels, now)
  );

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


/**
 * ONE lead's canonical intelligence, for a direct Lead Detail open.
 *
 * WHY THIS EXISTS. The score, its band, the effective sales bucket, the risk
 * flags and the site-visit milestone are derived in server TypeScript over
 * batched signals. They are not columns, so PostgREST cannot return them, and
 * the two mobile list endpoints that carry them cannot be asked about a single
 * lead. A phone opening a lead from Today, from a notification or from a cold
 * deep link therefore had no way to obtain them at all.
 *
 * IT IS BOUNDED. One row read by primary key, then `fetchLeadScoreBatch` over a
 * ONE-ELEMENT id list — the same batch helper the cohort read uses, given one
 * id instead of thousands. No cohort is scanned, no month is inferred, no list
 * endpoint is called, and there is no per-signal loop.
 *
 * IT DUPLICATES NOTHING. The derivation is `enrichLeadRow`, the exact function
 * `queryLeadListPage` maps its cohort through. A lead cannot score one way in
 * the list and another way when opened, because one function answers both.
 *
 * RLS DOES THE SCOPING. `db` is the caller's own client, so a lead outside the
 * caller's visibility simply yields no row — indistinguishable from a lead that
 * does not exist, which is the intended behaviour. Returning `null` for both is
 * what stops this being an existence oracle.
 */
export async function queryLeadIntelligence(
  context: CrmAccessContext,
  leadId: string,
  db?: CrmDb
): Promise<CrmLeadListItem | null> {
  const supabase = await resolveCrmDb(db);

  const { data, error } = await supabase
    .from("leads")
    .select(CRM_LEAD_LIST_SELECT)
    .eq("id", leadId)
    .maybeSingle();

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  if (!data) {
    return null;
  }

  const row = data as unknown as CrmLeadListRow;

  const now = Date.now();

  // The assignee label needs the same directory the list uses, so an owner's
  // name reads identically on both surfaces.
  const assigneeLabels = buildAssigneeLabelMap(
    await fetchCrmAssigneeDirectory(context, db)
  );

  // One id in, one id's signals out. Same helper, same shape, same weights.
  const batch = await fetchLeadScoreBatch([row.id], db);

  return enrichLeadRow(row, batch, assigneeLabels, now);
}
