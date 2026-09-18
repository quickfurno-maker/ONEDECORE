import { createBearerClient, readBearerToken } from "@/lib/supabase/bearer";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 128 * 1024;
const MAX_SELECT_LENGTH = 8_000;
const MAX_FILTERS = 32;
const MAX_ORDERS = 8;
const MAX_IN_VALUES = 500;
const MAX_LIMIT = 1_000;
const MAX_RANGE_ROWS = 1_000;
const COLUMN = /^[a-z_][a-z0-9_.]*$/;

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
  "approve_leave_request",
  "assign_lead",
  "cancel_lead_follow_up",
  "complete_lead_activity",
  "complete_lead_follow_up",
  "correct_attendance_day",
  "create_lead_activity",
  "create_lead_follow_up",
  "designate_primary_next_action",
  "get_attendance_approval_inbox",
  "get_attendance_monthly_summary",
  "get_crm_lead_commercial_state",
  "get_crm_my_day",
  "get_project_execution_high_level_status",
  "list_crm_assignable_executives",
  "list_salary_statements",
  "reject_attendance_day",
  "reject_leave_request",
  "reschedule_lead_activity",
  "return_attendance_for_correction",
  "set_lead_sales_temperature",
  "transfer_activity_ownership",
  "transition_lead_status",
] as const);

type ScalarFilterOp =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "ilike"
  | "like";

type Filter =
  | {
      op: ScalarFilterOp;
      column: string;
      value: unknown;
    }
  | {
      op: "in";
      column: string;
      value: unknown[];
    }
  | {
      op: "is";
      column: string;
      value: null | boolean;
    };

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
  filters: Filter[];
  orders: Order[];
  limit?: number;
  range?: {
    from: number;
    to: number;
  };
  single?: "single" | "maybeSingle";
};

type RpcRequest = {
  kind: "rpc";
  name: string;
  args?: Record<string, unknown>;
};

type BridgeRequest = TableRequest | RpcRequest;

function isObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function canonicalErrorCode(
  status: number
):
  | "unauthenticated"
  | "forbidden"
  | "invalid_request"
  | "unavailable" {
  if (status === 401) return "unauthenticated";
  if (status === 403) return "forbidden";
  if (status >= 500) return "unavailable";
  return "invalid_request";
}

function errorResponse(status: number, message: string) {
  return Response.json(
    {
      error: canonicalErrorCode(status),
      message,
    },
    { status }
  );
}

function validColumn(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 120 &&
    COLUMN.test(value)
  );
}

function readSelectOptions(
  value: unknown
): TableRequest["selectOptions"] | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value)) return null;

  const count = value.count;
  const head = value.head;

  if (
    count !== undefined &&
    count !== "exact" &&
    count !== "planned" &&
    count !== "estimated"
  ) {
    return null;
  }

  if (head !== undefined && typeof head !== "boolean") {
    return null;
  }

  return {
    ...(count === undefined ? {} : { count }),
    ...(head === undefined ? {} : { head }),
  };
}

function readFilters(value: unknown): Filter[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_FILTERS) return null;

  const filters: Filter[] = [];

  for (const raw of value) {
    if (!isObject(raw) || typeof raw.op !== "string") return null;
    if (!validColumn(raw.column)) return null;

    if (
      raw.op === "eq" ||
      raw.op === "neq" ||
      raw.op === "gt" ||
      raw.op === "gte" ||
      raw.op === "lt" ||
      raw.op === "lte" ||
      raw.op === "ilike" ||
      raw.op === "like"
    ) {
      filters.push({
        op: raw.op,
        column: raw.column,
        value: raw.value,
      });
      continue;
    }

    if (raw.op === "in") {
      if (
        !Array.isArray(raw.value) ||
        raw.value.length > MAX_IN_VALUES
      ) {
        return null;
      }

      filters.push({
        op: "in",
        column: raw.column,
        value: raw.value,
      });
      continue;
    }

    if (raw.op === "is") {
      if (
        raw.value !== null &&
        typeof raw.value !== "boolean"
      ) {
        return null;
      }

      filters.push({
        op: "is",
        column: raw.column,
        value: raw.value,
      });
      continue;
    }

    return null;
  }

  return filters;
}

function readOrders(value: unknown): Order[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > MAX_ORDERS) return null;

  const orders: Order[] = [];

  for (const raw of value) {
    if (!isObject(raw) || !validColumn(raw.column)) return null;

    let options: Order["options"];

    if (raw.options !== undefined) {
      if (!isObject(raw.options)) return null;

      const {
        ascending,
        nullsFirst,
        foreignTable,
        referencedTable,
      } = raw.options;

      if (
        ascending !== undefined &&
        typeof ascending !== "boolean"
      ) {
        return null;
      }

      if (
        nullsFirst !== undefined &&
        typeof nullsFirst !== "boolean"
      ) {
        return null;
      }

      if (
        foreignTable !== undefined &&
        !validColumn(foreignTable)
      ) {
        return null;
      }

      if (
        referencedTable !== undefined &&
        !validColumn(referencedTable)
      ) {
        return null;
      }

      options = {
        ...(ascending === undefined ? {} : { ascending }),
        ...(nullsFirst === undefined ? {} : { nullsFirst }),
        ...(foreignTable === undefined ? {} : { foreignTable }),
        ...(referencedTable === undefined ? {} : { referencedTable }),
      };
    }

    orders.push({
      column: raw.column,
      ...(options === undefined ? {} : { options }),
    });
  }

  return orders;
}

function readLimit(value: unknown): number | undefined | null {
  if (value === undefined) return undefined;

  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > MAX_LIMIT
  ) {
    return null;
  }

  return value;
}

function readRange(
  value: unknown
): TableRequest["range"] | undefined | null {
  if (value === undefined) return undefined;
  if (!isObject(value)) return null;

  const { from, to } = value;

  if (
    typeof from !== "number" ||
    typeof to !== "number" ||
    !Number.isInteger(from) ||
    !Number.isInteger(to) ||
    from < 0 ||
    to < from ||
    to - from + 1 > MAX_RANGE_ROWS
  ) {
    return null;
  }

  return { from, to };
}

function readSingle(
  value: unknown
): TableRequest["single"] | undefined | null {
  if (value === undefined) return undefined;
  if (value === "single" || value === "maybeSingle") return value;
  return null;
}

function readRpcRequest(
  value: Record<string, unknown>
): RpcRequest | null {
  if (typeof value.name !== "string") return null;
  if (value.args !== undefined && !isObject(value.args)) return null;

  return {
    kind: "rpc",
    name: value.name,
    ...(value.args === undefined
      ? {}
      : {
          args: value.args as Record<string, unknown>,
        }),
  };
}

function readTableRequest(
  value: Record<string, unknown>
): TableRequest | null {
  if (typeof value.table !== "string") return null;
  if (value.action !== "select" && value.action !== "insert") return null;

  if (
    value.columns !== undefined &&
    (
      typeof value.columns !== "string" ||
      value.columns.length === 0 ||
      value.columns.length > MAX_SELECT_LENGTH
    )
  ) {
    return null;
  }

  const selectOptions = readSelectOptions(value.selectOptions);
  const filters = readFilters(value.filters);
  const orders = readOrders(value.orders);
  const limit = readLimit(value.limit);
  const range = readRange(value.range);
  const single = readSingle(value.single);

  if (
    selectOptions === null ||
    filters === null ||
    orders === null ||
    limit === null ||
    range === null ||
    single === null
  ) {
    return null;
  }

  return {
    kind: "table",
    table: value.table,
    action: value.action,
    ...(value.columns === undefined
      ? {}
      : { columns: value.columns }),
    ...(selectOptions === undefined
      ? {}
      : { selectOptions }),
    ...(value.values === undefined
      ? {}
      : { values: value.values }),
    filters,
    orders,
    ...(limit === undefined ? {} : { limit }),
    ...(range === undefined ? {} : { range }),
    ...(single === undefined ? {} : { single }),
  };
}

function readRequest(value: unknown): BridgeRequest | null {
  if (!isObject(value)) return null;

  if (value.kind === "rpc") {
    return readRpcRequest(value);
  }

  if (value.kind === "table") {
    return readTableRequest(value);
  }

  return null;
}

function validLeadNoteInsert(values: unknown): boolean {
  if (!isObject(values)) return false;

  const keys = Object.keys(values).sort();

  return (
    keys.length === 2 &&
    keys[0] === "body" &&
    keys[1] === "lead_id" &&
    typeof values.lead_id === "string" &&
    values.lead_id.length > 0 &&
    typeof values.body === "string" &&
    values.body.trim().length > 0
  );
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
  const contentLength = Number(request.headers.get("content-length") ?? "0");

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_BODY_BYTES
  ) {
    return errorResponse(413, "The mobile data request is too large.");
  }

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

    const result = await db.rpc(
      payload.name as never,
      payload.args as never
    );

    return Response.json(serializeResult(result));
  }

  if (!READ_TABLES.has(payload.table as never)) {
    return errorResponse(403, "That mobile table is not allowed.");
  }

  if (payload.action === "insert") {
    if (!INSERT_TABLES.has(payload.table as never)) {
      return errorResponse(403, "Writes are not allowed for that mobile table.");
    }

    if (
      payload.table !== "lead_notes" ||
      !validLeadNoteInsert(payload.values)
    ) {
      return errorResponse(400, "That mobile write payload is not valid.");
    }
  }

  // The Supabase builder type changes after every dynamic operation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any;

  if (payload.action === "select") {
    query = db
      .from(payload.table as never)
      .select(
        payload.columns ?? "*",
        payload.selectOptions
      );
  } else {
    query = db
      .from(payload.table as never)
      .insert(payload.values as never);

    if (payload.columns) {
      query = query.select(
        payload.columns,
        payload.selectOptions
      );
    }
  }

  for (const filter of payload.filters) {
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

  for (const order of payload.orders) {
    query = query.order(order.column, order.options);
  }

  if (payload.limit !== undefined) {
    query = query.limit(payload.limit);
  }

  if (payload.range) {
    query = query.range(
      payload.range.from,
      payload.range.to
    );
  }

  if (payload.single === "single") {
    query = query.single();
  } else if (payload.single === "maybeSingle") {
    query = query.maybeSingle();
  }

  const result = await query;
  return Response.json(serializeResult(result));
}
