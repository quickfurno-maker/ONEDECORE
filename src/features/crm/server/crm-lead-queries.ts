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
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

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

export async function queryLeadListPage(
  context: CrmAccessContext,
  query: LeadListQuery
): Promise<LeadListPageResult<CrmLeadListItem>> {
  const supabase = await createClient();
  const assigneeDirectory = await fetchCrmAssigneeDirectory(context);
  const assigneeLabels = buildAssigneeLabelMap(assigneeDirectory);

  const constrained = await constrainLeadListRequest(
    supabase
      .from("leads")
      .select(CRM_LEAD_LIST_SELECT)
      .order("updated_at", { ascending: false })
      .order("id", { ascending: false }),
    context,
    query
  );

  if (!constrained) {
    return {
      items: [],
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        hasNextPage: false,
        hasPreviousPage: query.page > 1,
      },
      hasActiveFilters: hasLeadListActiveFilters(query),
    };
  }

  const from = (query.page - 1) * query.pageSize;
  const to = from + query.pageSize;
  const { data, error } = await (
    constrained.request as unknown as {
      range: (
        from: number,
        to: number
      ) => Promise<{ data: unknown; error: { message: string } | null }>;
    }
  ).range(from, to);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rows = (data ?? []) as CrmLeadListRow[];
  const hasNextPage = rows.length > query.pageSize;
  const pageRows = hasNextPage ? rows.slice(0, query.pageSize) : rows;
  const followUpDueMap = await fetchNextOpenFollowUpDueByLeadIds(
    pageRows.map((row) => row.id)
  );

  const items = pageRows.map((row) =>
    mapLeadRowToListItem(row, {
      assigneeLabel: row.assigned_to
        ? assigneeLabels[row.assigned_to] ?? "Assigned staff"
        : "Unassigned",
      nextFollowUpDue: followUpDueMap[row.id] ?? null,
    })
  );

  return {
    items,
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      hasNextPage,
      hasPreviousPage: query.page > 1,
    },
    hasActiveFilters: hasLeadListActiveFilters(query),
  };
}
