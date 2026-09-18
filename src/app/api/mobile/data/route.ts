import { createBearerClient, readBearerToken } from "@/lib/supabase/bearer";

export const dynamic = "force-dynamic";

const READ_TABLES = new Set([
  "attendance_corrections",
  "attendance_days",
  "attendance_policies",
  "attendance_submissions",
  "contact_channels",
  "contacts",
  "crm_lead_cadence_enrollments",
  "lead_activity_outcome_codes",
  "lead_follow_ups",
  "lead_notes",
  "lead_sources",
  "leads",
  "leave_requests",
  "leave_types",
  "profiles",
  "project_design_workflows",
  "project_designer_assignments",
  "project_execution_workflows",
  "project_manager_assignments",
  "projects",
  "quotations",
  "staff_employment_profiles",
  "user_roles",
] as const);

const INSERT_TABLES = new Set([
  "lead_notes",
] as const);

const RPCS = new Set([
  "approve_attendance_day",
  "assign_lead",
  "cancel_lead_follow_up",
  "complete_lead_follow_up",
  "correct_attendance_day",
  "create_lead_follow_up",
  "get_attendance_approval_inbox",
  "get_attendance_monthly_summary",
  "get_crm_lead_commercial_state",
  "get_project_execution_high_level_status",
  "has_active_role",
  "list_crm_assignable_executives",
  "list_salary_statements",
  "reject_attendance_day",
  "return_attendance_for_correction",
] as const);

type Filter =
  | { op: "eq" | "neq" | "gt" | "gte" | "lt" | "lte" | "ilike" | "like"; column: string; value: unknown }
  | { op: "in"; column: string; value: unknown[] }
  | { op: "is"; column: string; value: null | boolean }
  | { op: "or"; filters: string; options?: Record<string, unknown> };

type Order = {
  column: string;
  options?: {
    ascending?: boolean;
    nullsFirst?: boolean;
    foreignTable?: string;
    referencedTable?: string;
  };
};

type TableRequest = {
  kind: "table";
  table: string;
  action: "select" | "insert";
  columns?: string;
  selectOptions?: {
    count?: "exact" | "planned" | "estimated";
    head?: boolean;
  };
  values?: unknown;
  filters?: Filter[];
  orders?: Order[];
  limit?: number;
  range?: { from: number; to: number };
  single?: "single" | "maybeSingle";
};

type RpcRequest = {
  kind: "rpc";
  name: string;
  args?: Record<string, unknown>;
};

type BridgeRequest = TableRequest | RpcRequest;

function errorResponse(status: number, message: string) {
  return Response.json(
    {
      data: null,
      count: null,
      error: {
        code: String(status),
        message,
        details: null,
        hint: null,
      },
    },
    { status }
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readRequest(value: unknown): BridgeRequest | null {
  if (!isObject(value) || typeof value.kind !== "string") return null;

  if (value.kind === "rpc") {
    if (typeof value.name !== "string") return null;
    if (value.args !== undefined && !isObject(value.args)) return null;

    return {
      kind: "rpc",
      name: value.name,
      args: value.args as Record<string, unknown> | undefined,
    };
  }

  if (value.kind !== "table") return null;
  if (typeof value.table !== "string") return null;
  if (value.action !== "select" && value.action !== "insert") return null;

  return value as TableRequest;
}

function serializeResult(result: {
  data: unknown;
  error: null | {
    code?: string;
    message: string;
    details?: string | null;
    hint?: string | null;
  };
  count?: number | null;
  status?: number;
  statusText?: string;
}) {
  return {
    data: result.data ?? null,
    count: result.count ?? null,
    error: result.error
      ? {
          code: result.error.code ?? null,
          message: result.error.message,
          details: result.error.details ?? null,
          hint: result.error.hint ?? null,
        }
      : null,
    status: result.status ?? 200,
    statusText: result.statusText ?? "OK",
  };
}

export async function POST(request: Request) {
  const token = readBearerToken(request);

  if (!token) {
    return errorResponse(401, "Sign in again to continue.");
  }

  const db = createBearerClient(token);
  const userResult = await db.auth.getUser();

  if (userResult.error || !userResult.data.user) {
    return errorResponse(401, "Sign in again to continue.");
  }

  let payload: BridgeRequest | null = null;

  try {
    payload = readRequest(await request.json());
  } catch {
    return errorResponse(400, "The mobile data request is not valid JSON.");
  }

  if (!payload) {
    return errorResponse(400, "The mobile data request is not valid.");
  }

  if (payload.kind === "rpc") {
    if (!RPCS.has(payload.name as never)) {
      return errorResponse(403, "That mobile RPC is not allowed.");
    }

    const result = await db.rpc(payload.name as never, payload.args as never);
    return Response.json(serializeResult(result));
  }

  if (!READ_TABLES.has(payload.table as never)) {
    return errorResponse(403, "That mobile table is not allowed.");
  }

  if (
    payload.action === "insert" &&
    !INSERT_TABLES.has(payload.table as never)
  ) {
    return errorResponse(403, "Writes are not allowed for that mobile table.");
  }

  // The Supabase builder type changes after every dynamic operation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any;

  if (payload.action === "select") {
    query = db
      .from(payload.table as never)
      .select(payload.columns ?? "*", payload.selectOptions);
  } else {
    query = db
      .from(payload.table as never)
      .insert(payload.values as never);

    if (payload.columns) {
      query = query.select(payload.columns, payload.selectOptions);
    }
  }

  for (const filter of payload.filters ?? []) {
    if (filter.op === "or") {
      query = query.or(filter.filters, filter.options);
      continue;
    }

    if (filter.op === "in") {
      query = query.in(filter.column, filter.value);
      continue;
    }

    if (filter.op === "is") {
      query = query.is(filter.column, filter.value);
      continue;
    }

    query = query[filter.op](filter.column, filter.value);
  }

  for (const order of payload.orders ?? []) {
    query = query.order(order.column, order.options);
  }

  if (payload.limit !== undefined) {
    query = query.limit(payload.limit);
  }

  if (payload.range) {
    query = query.range(payload.range.from, payload.range.to);
  }

  if (payload.single === "single") {
    query = query.single();
  } else if (payload.single === "maybeSingle") {
    query = query.maybeSingle();
  }

  const result = await query;
  return Response.json(serializeResult(result));
}
