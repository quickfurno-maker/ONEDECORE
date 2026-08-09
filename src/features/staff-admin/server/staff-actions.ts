"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  mapFinalizeStaffMemberRpcResult,
  normalizeEmployeeCode,
  type CreateStaffMemberInput,
  type CreateStaffMemberResult,
  type SetReportingManagerInput,
  type SetStaffStatusInput,
  type UpdateStaffEmploymentInput,
  validateCreateStaffMemberInput,
} from "../contracts/dto.ts";
import { isStaffProfileStatusCode } from "../contracts/permissions.ts";
import { StaffError, staffErrorFromPostgresMessage } from "../contracts/errors.ts";
import { getStaffAdminAccessContext } from "./staff-auth.ts";
import { inviteStaffMemberByEmail } from "./staff-invite-adapter.ts";

type StaffServerClient = SupabaseClient<Database>;

interface FinalizeStaffMemberRpcArgs {
  readonly p_client_request_id: string;
  readonly p_staff_id: string;
  readonly p_employee_code: string;
  readonly p_display_name: string;
  readonly p_phone_e164: string | null;
  readonly p_designation: string;
  readonly p_joining_date: string;
  readonly p_role_code: string;
  readonly p_reporting_manager_id: string | null;
  readonly p_attendance_eligible: boolean;
  readonly p_attendance_policy_id: string | null;
}

interface ReconcileStaffInviteRpcArgs {
  readonly p_client_request_id: string;
}

interface SetStaffProfileStatusRpcArgs {
  readonly p_staff_id: string;
  readonly p_status: string;
  readonly p_reason: string;
}

interface SetStaffReportingManagerRpcArgs {
  readonly p_staff_id: string;
  readonly p_manager_id: string | null;
  readonly p_reason: string;
}

interface UpdateStaffEmploymentRpcArgs {
  readonly p_staff_id: string;
  readonly p_employee_code?: string | null;
  readonly p_designation?: string | null;
  readonly p_joining_date?: string | null;
  readonly p_phone_e164?: string | null;
  readonly p_display_name?: string | null;
  readonly p_attendance_eligible?: boolean | null;
  readonly p_attendance_policy_id?: string | null;
  readonly p_reason?: string | null;
}

type StaffRpcClient = StaffServerClient & {
  rpc(
    fn: "finalize_staff_member",
    args: FinalizeStaffMemberRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "reconcile_staff_invite",
    args: ReconcileStaffInviteRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "set_staff_profile_status",
    args: SetStaffProfileStatusRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "set_staff_reporting_manager",
    args: SetStaffReportingManagerRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "update_staff_employment",
    args: UpdateStaffEmploymentRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
};

async function requireManageStaffContext() {
  const context = await getStaffAdminAccessContext();
  if (!context) {
    throw new StaffError({
      code: "STAFF_UNAUTHORIZED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  if (!context.canManageStaff) {
    throw new StaffError({
      code: "STAFF_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }

  return context;
}

function assertRpcJson(data: unknown, label: string): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    throw staffErrorFromPostgresMessage(`Empty ${label} RPC result`);
  }

  return data as Record<string, unknown>;
}

export async function createStaffMember(
  input: CreateStaffMemberInput
): Promise<CreateStaffMemberResult> {
  await requireManageStaffContext();

  const validationErrors = validateCreateStaffMemberInput(input);
  if (validationErrors.length > 0) {
    throw new StaffError({
      code: "STAFF_VALIDATION_FAILED",
      message: validationErrors[0]?.message ?? "Validation failed",
      httpStatus: 422,
      details: validationErrors.map((entry) => entry.message).join("; "),
    });
  }

  const employeeCode = normalizeEmployeeCode(input.employeeCode);
  const displayName = input.displayName.trim();
  const email = input.email.trim().toLowerCase();
  const phoneE164 = input.phoneE164?.trim() || null;
  const designation = input.designation.trim();
  const reportingManagerId = input.reportingManagerId?.trim() || null;

  let invitedUserId: string;
  try {
    const invite = await inviteStaffMemberByEmail({ email, displayName });
    invitedUserId = invite.userId;
  } catch (error) {
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message: "Staff invitation could not be sent.",
      httpStatus: 502,
      details: error instanceof Error ? error.message : undefined,
    });
  }

  const supabase = await createClient();
  const rpcClient = supabase as StaffRpcClient;
  const { data, error } = await rpcClient.rpc("finalize_staff_member", {
    p_client_request_id: input.clientRequestId,
    p_staff_id: invitedUserId,
    p_employee_code: employeeCode,
    p_display_name: displayName,
    p_phone_e164: phoneE164,
    p_designation: designation,
    p_joining_date: input.joiningDate,
    p_role_code: input.roleCode,
    p_reporting_manager_id: reportingManagerId,
    p_attendance_eligible: input.attendanceEligible,
    p_attendance_policy_id: input.attendancePolicyId ?? null,
  });

  if (error) {
    return {
      staffId: invitedUserId,
      employeeCode,
      profileStatus: "pending",
      invitationState: "reconciliation_required",
      reconciliationState: "auth_created_db_pending",
      idempotentReplay: false,
    };
  }

  return mapFinalizeStaffMemberRpcResult(data);
}

export async function reconcileStaffInvite(
  clientRequestId: string
): Promise<CreateStaffMemberResult> {
  await requireManageStaffContext();

  if (!clientRequestId.trim()) {
    throw new StaffError({
      code: "STAFF_VALIDATION_FAILED",
      message: "Client request id is required.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  const rpcClient = supabase as StaffRpcClient;
  const { data, error } = await rpcClient.rpc("reconcile_staff_invite", {
    p_client_request_id: clientRequestId,
  });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  return mapFinalizeStaffMemberRpcResult(data);
}

export async function setStaffStatus(
  input: SetStaffStatusInput
): Promise<{ readonly staffId: string; readonly status: string }> {
  await requireManageStaffContext();

  if (!isStaffProfileStatusCode(input.status)) {
    throw new StaffError({
      code: "STAFF_VALIDATION_FAILED",
      message: "Invalid profile status.",
      httpStatus: 422,
    });
  }

  const reason = input.reason.trim();
  if (reason.length < 1) {
    throw new StaffError({
      code: "STAFF_VALIDATION_FAILED",
      message: "Reason is required.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  const rpcClient = supabase as StaffRpcClient;
  const { data, error } = await rpcClient.rpc("set_staff_profile_status", {
    p_staff_id: input.staffId,
    p_status: input.status,
    p_reason: reason,
  });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const payload = assertRpcJson(data, "set_staff_profile_status");
  return {
    staffId: String(payload.staffId ?? input.staffId),
    status: String(payload.status ?? input.status),
  };
}

export async function setReportingManager(
  input: SetReportingManagerInput
): Promise<{ readonly staffId: string; readonly reportingManagerId: string | null }> {
  await requireManageStaffContext();

  const reason = input.reason.trim();
  if (reason.length < 1) {
    throw new StaffError({
      code: "STAFF_VALIDATION_FAILED",
      message: "Reason is required.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  const rpcClient = supabase as StaffRpcClient;
  const { data, error } = await rpcClient.rpc("set_staff_reporting_manager", {
    p_staff_id: input.staffId,
    p_manager_id: input.managerId,
    p_reason: reason,
  });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const payload = assertRpcJson(data, "set_staff_reporting_manager");
  const managerId = payload.reportingManagerId;
  return {
    staffId: String(payload.staffId ?? input.staffId),
    reportingManagerId:
      managerId === null || managerId === undefined ? null : String(managerId),
  };
}

export async function updateEmployment(
  input: UpdateStaffEmploymentInput
): Promise<{ readonly staffId: string; readonly attendanceEligible: boolean }> {
  await requireManageStaffContext();

  const supabase = await createClient();
  const rpcClient = supabase as StaffRpcClient;
  const { data, error } = await rpcClient.rpc("update_staff_employment", {
    p_staff_id: input.staffId,
    p_employee_code: input.employeeCode ?? null,
    p_designation: input.designation ?? null,
    p_joining_date: input.joiningDate ?? null,
    p_phone_e164: input.phoneE164 ?? null,
    p_display_name: input.displayName ?? null,
    p_attendance_eligible: input.attendanceEligible ?? null,
    p_attendance_policy_id: input.attendancePolicyId ?? null,
    p_reason: input.reason ?? null,
  });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const payload = assertRpcJson(data, "update_staff_employment");
  return {
    staffId: String(payload.staffId ?? input.staffId),
    attendanceEligible: payload.attendanceEligible === true,
  };
}
