import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import type {
  StaffCredentialOperationSummary,
  StaffDetail,
  StaffListItem,
} from "../contracts/dto.ts";
import {
  isStaffAssignableRoleCode,
  isStaffAccessStateCode,
  isStaffProfileStatusCode,
  type StaffAccessStateCode,
  type StaffProfileStatusCode,
} from "../contracts/permissions.ts";
import { StaffError, staffErrorFromPostgresMessage } from "../contracts/errors.ts";
import {
  getStaffAdminAccessContext,
  requireStaffReadAccess,
} from "./staff-auth.ts";

export interface ReportingManagerOption {
  readonly staffId: string;
  readonly displayName: string;
  readonly employeeCode: string;
}

export interface AttendancePolicyOption {
  readonly policyId: string;
  readonly code: string;
  readonly name: string;
  readonly isCurrent: boolean;
}

type StaffServerClient = SupabaseClient<Database>;

type StaffQueryResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type StaffQueryBuilder = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select(columns: string): StaffQueryBuilder;
  eq(column: string, value: string | boolean): StaffQueryBuilder;
  in(column: string, values: readonly string[]): StaffQueryBuilder;
  order(column: string, options: { ascending: boolean }): StaffQueryBuilder;
  limit(count: number): StaffQueryBuilder;
  maybeSingle(): StaffQueryResult;
};

type StaffQueryClient = {
  from(
    table:
      | "staff_employment_profiles"
      | "staff_admin_events"
      | "attendance_policies"
      | "user_roles"
  ): StaffQueryBuilder;
};

type EmploymentRow = {
  readonly staff_id: string;
  readonly employee_code: string;
  readonly designation: string;
  readonly joining_date: string;
  readonly reporting_manager_id: string | null;
  readonly attendance_eligible: boolean;
  readonly attendance_policy_id: string | null;
  readonly access_state: string | null;
  readonly login_phone_e164: string | null;
  readonly credentials_issued_at: string | null;
  readonly access_revoked_at: string | null;
  readonly profiles: {
    readonly display_name: string | null;
    readonly status: string;
    readonly phone_e164: string | null;
  } | null;
  readonly manager: {
    readonly display_name: string | null;
  } | null;
  readonly attendance_policies: {
    readonly name: string;
  } | null;
};

function staffQueryClient(client: StaffServerClient): StaffQueryClient {
  return client as unknown as StaffQueryClient;
}

function resolveRoleCode(roleCodes: readonly string[]): StaffListItem["roleCode"] {
  if (roleCodes.includes("super_admin")) {
    return "super_admin";
  }

  for (const code of roleCodes) {
    if (isStaffAssignableRoleCode(code)) {
      return code;
    }
  }

  return "sales_executive";
}

async function fetchRoleCodesByStaffIds(
  client: StaffServerClient,
  staffIds: readonly string[]
): Promise<Readonly<Record<string, readonly string[]>>> {
  if (staffIds.length === 0) {
    return {};
  }

  const { data, error } = await staffQueryClient(client)
    .from("user_roles")
    .select("user_id, roles(code)")
    .in("user_id", [...staffIds]);

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const grouped: Record<string, string[]> = {};
  for (const row of (data as Array<{
    user_id: string;
    roles: { code: string } | null;
  }> | null) ?? []) {
    const roleCode = row.roles?.code;
    if (!roleCode) {
      continue;
    }
    grouped[row.user_id] = [...(grouped[row.user_id] ?? []), roleCode];
  }

  return grouped;
}

function mapEmploymentRowToListItem(
  row: EmploymentRow,
  roleCodes: readonly string[]
): StaffListItem {
  const rawStatus = row.profiles?.status ?? "";
  const status: StaffProfileStatusCode = isStaffProfileStatusCode(rawStatus)
    ? rawStatus
    : "pending";

  return {
    staffId: row.staff_id,
    employeeCode: row.employee_code,
    displayName: row.profiles?.display_name?.trim() || "Staff member",
    designation: row.designation,
    roleCode: resolveRoleCode(roleCodes),
    managerName: row.manager?.display_name?.trim() || null,
    accessState: isStaffAccessStateCode(row.access_state ?? "")
      ? (row.access_state as StaffAccessStateCode)
      // Fail closed: an unrecognised value must never imply that working
      // credentials exist.
      : "not_activated",
    status,
    joiningDate: row.joining_date,
  };
}

/**
 * Reconciles cached app-access state with authoritative Auth sign-in evidence.
 *
 * access_state is derived on INSERT, but a sign-in happening later cannot fire
 * that trigger. Staff read paths therefore resync first, so "credentials_ready"
 * becomes "active" only when a real sign-in exists. "revoked" is never
 * overwritten by the sync. Best-effort: a sync failure must never block
 * reading the directory.
 */
async function syncStaffAccessStates(
  client: Awaited<ReturnType<typeof createClient>>,
  staffId: string | null
): Promise<void> {
  try {
    await (
      client as unknown as {
        rpc(
          fn: "sync_staff_access_states",
          args: { readonly p_staff_id: string | null }
        ): PromiseLike<{ error: { message: string } | null }>;
      }
    ).rpc("sync_staff_access_states", { p_staff_id: staffId });
  } catch {
    // Non-fatal: the stored value is still shown, just possibly one sign-in stale.
  }
}

export async function loadStaffList(): Promise<readonly StaffListItem[]> {
  await requireStaffReadAccess();

  const supabase = await createClient();
  await syncStaffAccessStates(supabase, null);
  const { data, error } = await staffQueryClient(supabase)
    .from("staff_employment_profiles")
    .select(
      "staff_id, employee_code, designation, joining_date, reporting_manager_id, access_state, profiles!staff_employment_profiles_staff_id_fkey(display_name, status), manager:profiles!staff_employment_profiles_reporting_manager_id_fkey(display_name)"
    )
    .order("employee_code", { ascending: true });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const rows = (data as EmploymentRow[] | null) ?? [];
  const roleMap = await fetchRoleCodesByStaffIds(
    supabase,
    rows.map((row) => row.staff_id)
  );

  return rows.map((row) =>
    mapEmploymentRowToListItem(row, roleMap[row.staff_id] ?? [])
  );
}

export async function loadStaffDetail(staffId: string): Promise<StaffDetail | null> {
  await requireStaffReadAccess();

  const supabase = await createClient();
  await syncStaffAccessStates(supabase, staffId);
  const { data, error } = await staffQueryClient(supabase)
    .from("staff_employment_profiles")
    .select(
      "staff_id, employee_code, designation, joining_date, reporting_manager_id, attendance_eligible, attendance_policy_id, access_state, login_phone_e164, credentials_issued_at, access_revoked_at, profiles!staff_employment_profiles_staff_id_fkey(display_name, status, phone_e164), manager:profiles!staff_employment_profiles_reporting_manager_id_fkey(display_name), attendance_policies(name)"
    )
    .eq("staff_id", staffId)
    .maybeSingle();

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  if (!data) {
    return null;
  }

  const row = data as EmploymentRow;
  const roleMap = await fetchRoleCodesByStaffIds(supabase, [row.staff_id]);
  const listItem = mapEmploymentRowToListItem(row, roleMap[row.staff_id] ?? []);

  const { data: lastEvent } = await staffQueryClient(supabase)
    .from("staff_admin_events")
    .select("event_type, created_at")
    .eq("staff_id", staffId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const context = await getStaffAdminAccessContext();
  const event = lastEvent as { event_type: string; created_at: string } | null;

  return {
    ...listItem,
    phoneE164: row.profiles?.phone_e164 ?? null,
    email: context?.canManageStaff ? null : null,
    attendanceEligible: row.attendance_eligible,
    policyName: row.attendance_policies?.name ?? null,
    loginPhoneE164: row.login_phone_e164 ?? null,
    credentialsIssuedAt: row.credentials_issued_at ?? null,
    accessRevokedAt: row.access_revoked_at ?? null,
    auditSummary: {
      lastEventType: event?.event_type ?? null,
      lastEventAt: event?.created_at ?? null,
    },
  };
}

export async function loadReportingManagerDirectory(): Promise<
  readonly ReportingManagerOption[]
> {
  await requireStaffReadAccess();

  const supabase = await createClient();
  const { data, error } = await staffQueryClient(supabase)
    .from("staff_employment_profiles")
    .select(
      "staff_id, employee_code, profiles!staff_employment_profiles_staff_id_fkey(display_name, status)"
    )
    .order("employee_code", { ascending: true });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  return (
    (data as Array<{
      staff_id: string;
      employee_code: string;
      profiles: { display_name: string | null; status: string } | null;
    }> | null) ?? []
  )
    .filter((row) => row.profiles?.status === "active")
    .map((row) => ({
      staffId: row.staff_id,
      employeeCode: row.employee_code,
      displayName: row.profiles?.display_name?.trim() || row.employee_code,
    }));
}

export async function loadAttendancePolicyOptions(): Promise<
  readonly AttendancePolicyOption[]
> {
  const context = await getStaffAdminAccessContext();
  if (!context) {
    throw new StaffError({
      code: "STAFF_UNAUTHORIZED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  const supabase = await createClient();
  const { data, error } = await staffQueryClient(supabase)
    .from("attendance_policies")
    .select("id, code, name, is_current")
    .order("created_at", { ascending: false });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  return (
    (data as Array<{
      id: string;
      code: string;
      name: string;
      is_current: boolean;
    }> | null) ?? []
  ).map((row) => ({
    policyId: row.id,
    code: row.code,
    name: row.name,
    isCurrent: row.is_current,
  }));
}

/**
 * The unfinished credential operation for a staff member, if any.
 *
 * A prepare/Auth/finalize operation that failed part-way leaves a durable row
 * rather than silent half-state, and this is what makes it visible so a Super
 * Admin can retry it. Best-effort: only a credential admin may read it, so a
 * denial is a normal answer rather than an error.
 */
export async function loadStaffCredentialOperation(
  staffId: string
): Promise<StaffCredentialOperationSummary | null> {
  const supabase = await createClient();

  try {
    const { data, error } = await (
      supabase as unknown as {
        rpc(
          fn: "get_staff_credential_operation",
          args: { readonly p_staff_id: string }
        ): PromiseLike<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("get_staff_credential_operation", { p_staff_id: staffId });

    if (error || !data || typeof data !== "object") {
      return null;
    }

    const row = data as Record<string, unknown>;
    return {
      operationId: String(row.operationId ?? ""),
      operation: String(row.operation ?? ""),
      status: String(row.status ?? ""),
      targetLoginUsername:
        row.targetLoginUsername == null ? null : String(row.targetLoginUsername),
    };
  } catch {
    return null;
  }
}
