import {
  LEAD_MONTH_ALL,
  parseLeadMonthParam,
  type LeadMonthCohort,
} from "./lead-month-cohort.ts";
import {
  leadSalesBucketParam,
  parseLeadSalesBucketParam,
  type CrmLeadSalesBucket,
} from "./lead-sales-bucket.ts";
import { LEAD_STAGE_CODES, type LeadStageCode } from "./lead-stages.ts";

export const LEAD_LIST_DEFAULT_PAGE = 1;
export const LEAD_LIST_DEFAULT_PAGE_SIZE = 25;
export const LEAD_LIST_MAX_PAGE_SIZE = 50;
export const LEAD_LIST_MAX_SEARCH_LENGTH = 100;

export const LEAD_LIST_ASSIGNMENT_FILTERS = ["assigned", "unassigned"] as const;
export type LeadListAssignmentFilter =
  (typeof LEAD_LIST_ASSIGNMENT_FILTERS)[number];

export const LEAD_LIST_FOLLOW_UP_DUE_FILTERS = [
  "overdue",
  "today",
  "upcoming",
] as const;
export type LeadListFollowUpDueFilter =
  (typeof LEAD_LIST_FOLLOW_UP_DUE_FILTERS)[number];

export interface LeadListQuery {
  readonly q: string | null;
  readonly status: LeadStageCode | null;
  readonly sourceId: string | null;
  readonly assignment: LeadListAssignmentFilter | null;
  readonly assigneeId: string | null;
  readonly followUpDue: LeadListFollowUpDueFilter | null;
  /**
   * Owner-facing sales bucket filter. Coexists with `status`: they are different
   * questions (how hot is this? vs. how far has it got?) and neither silently
   * mutates the other.
   */
  readonly bucket: CrmLeadSalesBucket | null;
  /** Received-month cohort, Asia/Kolkata. Defaults to the current IST month. */
  readonly month: LeadMonthCohort;
  readonly page: number;
  readonly pageSize: number;
}

export interface LeadListPaginationMeta {
  readonly page: number;
  readonly pageSize: number;
  readonly hasNextPage: boolean;
  readonly hasPreviousPage: boolean;
}

export interface LeadListPageResult<TItem> {
  readonly items: readonly TItem[];
  readonly pagination: LeadListPaginationMeta;
  readonly hasActiveFilters: boolean;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function firstParam(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function parsePositiveInt(
  raw: string | undefined,
  fallback: number,
  max?: number
): number {
  if (!raw) {
    return fallback;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  if (max !== undefined && parsed > max) {
    return max;
  }

  return parsed;
}

function parseUuid(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }
  const trimmed = raw.trim();
  return UUID_RE.test(trimmed) ? trimmed : null;
}

function normalizeSearch(raw: string | undefined): string | null {
  if (!raw) {
    return null;
  }

  const collapsed = raw.trim().replace(/\s+/g, " ");
  if (!collapsed) {
    return null;
  }

  return collapsed.slice(0, LEAD_LIST_MAX_SEARCH_LENGTH);
}

export function escapeIlikePattern(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/**
 * Quotes a PostgREST filter operand so commas, dots, and parentheses in user
 * search text cannot break `.or()` filter expressions.
 */
export function quotePostgrestFilterValue(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function buildLeadTextSearchOrFilter(rawQuery: string): string {
  const pattern = `%${escapeIlikePattern(rawQuery)}%`;
  const quoted = quotePostgrestFilterValue(pattern);
  return `submitted_name.ilike.${quoted},locality.ilike.${quoted}`;
}

export function parseLeadListQuery(
  searchParams: Record<string, string | string[] | undefined>,
  nowMs: number = Date.now()
): LeadListQuery {
  const statusRaw = firstParam(searchParams.status);
  const status =
    statusRaw &&
    (LEAD_STAGE_CODES as readonly string[]).includes(statusRaw)
      ? (statusRaw as LeadStageCode)
      : null;

  const assignmentRaw = firstParam(searchParams.assignment);
  const assignment = LEAD_LIST_ASSIGNMENT_FILTERS.includes(
    assignmentRaw as LeadListAssignmentFilter
  )
    ? (assignmentRaw as LeadListAssignmentFilter)
    : null;

  const followUpDueRaw = firstParam(searchParams.followUpDue);
  const followUpDue = LEAD_LIST_FOLLOW_UP_DUE_FILTERS.includes(
    followUpDueRaw as LeadListFollowUpDueFilter
  )
    ? (followUpDueRaw as LeadListFollowUpDueFilter)
    : null;

  const bucket = parseLeadSalesBucketParam(firstParam(searchParams.bucket));
  // An unrecognised month falls back to the CURRENT IST month, never to
  // all-time: a typo must not quietly widen a scoped view into a full scan.
  const month = parseLeadMonthParam(firstParam(searchParams.month), nowMs);

  const page = parsePositiveInt(firstParam(searchParams.page), LEAD_LIST_DEFAULT_PAGE);
  const pageSize = parsePositiveInt(
    firstParam(searchParams.pageSize),
    LEAD_LIST_DEFAULT_PAGE_SIZE,
    LEAD_LIST_MAX_PAGE_SIZE
  );

  return {
    q: normalizeSearch(firstParam(searchParams.q)),
    status,
    sourceId: parseUuid(firstParam(searchParams.sourceId)),
    assignment,
    assigneeId: parseUuid(firstParam(searchParams.assigneeId)),
    followUpDue,
    bucket,
    month,
    page,
    pageSize,
  };
}

export function hasLeadListActiveFilters(query: LeadListQuery): boolean {
  return Boolean(
    query.q ||
      query.status ||
      query.sourceId ||
      query.assignment ||
      query.assigneeId ||
      query.followUpDue ||
      query.bucket
  );
}

/**
 * Builds a Leads list URL with one filter optionally cleared.
 *
 * CRM 2B removed the `view=pipeline` preview from this page: the board is now
 * the dedicated `/admin/crm/pipeline` workspace, so there is no view parameter.
 */
export type LeadListClearableFilter =
  | "q"
  | "status"
  | "sourceId"
  | "assignment"
  | "assigneeId"
  | "followUpDue"
  | "bucket";

export interface LeadListHrefOverrides {
  readonly bucket?: CrmLeadSalesBucket | null;
  readonly month?: string;
  readonly page?: number;
}

/**
 * Builds a Leads list URL with one filter optionally cleared, or with the
 * bucket/month/page explicitly overridden.
 *
 * Month and bucket SURVIVE every other filter change and every page link. A
 * segmentation strip that silently dropped the selected month would show counts
 * for one cohort and rows for another.
 *
 * CRM 2B removed the `view=pipeline` preview from this page: the board is now
 * the dedicated `/admin/crm/pipeline` workspace, so there is no view parameter.
 */
export function buildLeadListHref(
  query: LeadListQuery,
  clear?: LeadListClearableFilter,
  overrides: LeadListHrefOverrides = {}
): string {
  const params = new URLSearchParams();
  const q = clear === "q" ? null : query.q;
  const status = clear === "status" ? null : query.status;
  const sourceId = clear === "sourceId" ? null : query.sourceId;
  const assignment = clear === "assignment" ? null : query.assignment;
  const assigneeId = clear === "assigneeId" ? null : query.assigneeId;
  const followUpDue = clear === "followUpDue" ? null : query.followUpDue;
  const bucket =
    overrides.bucket !== undefined
      ? overrides.bucket
      : clear === "bucket"
        ? null
        : query.bucket;
  const month = overrides.month ?? query.month.param;

  if (q) params.set("q", q);
  if (status) params.set("status", status);
  if (sourceId) params.set("sourceId", sourceId);
  if (assignment) params.set("assignment", assignment);
  if (assigneeId) params.set("assigneeId", assigneeId);
  if (followUpDue) params.set("followUpDue", followUpDue);
  if (bucket) params.set("bucket", leadSalesBucketParam(bucket));
  // All-time is a deliberate, shareable choice, so it stays in the URL; the
  // default current month is implicit and left out to keep links clean.
  if (month === LEAD_MONTH_ALL) {
    params.set("month", LEAD_MONTH_ALL);
  } else if (month) {
    params.set("month", month);
  }
  if (query.pageSize !== LEAD_LIST_DEFAULT_PAGE_SIZE) {
    params.set("pageSize", String(query.pageSize));
  }
  if (overrides.page !== undefined && overrides.page > 1) {
    params.set("page", String(overrides.page));
  }

  const value = params.toString();
  return value ? `/admin/crm/leads?${value}` : "/admin/crm/leads";
}
