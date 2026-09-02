"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  mapCreateStaffMemberRpcResult,
  normalizeEmployeeCode,
  type CreateStaffMemberInput,
  type CreateStaffMemberResult,
  type SetReportingManagerInput,
  type SetStaffStatusInput,
  type UpdateStaffEmploymentInput,
  normalizeStaffEmail,
  validateCreateStaffMemberInput,
} from "../contracts/dto.ts";
import { isStaffProfileStatusCode } from "../contracts/permissions.ts";
import { StaffError, staffErrorFromPostgresMessage } from "../contracts/errors.ts";
import { getStaffAdminAccessContext } from "./staff-auth.ts";
import {
  inviteStaffMemberByEmail,
  provisionStaffLoginIdentity,
} from "./staff-invite-adapter.ts";

type StaffServerClient = SupabaseClient<Database>;

interface PrepareStaffInviteSagaRpcArgs {
  readonly p_client_request_id: string;
  readonly p_employee_code: string;
  readonly p_display_name: string;
  readonly p_email: string;
  readonly p_phone_e164: string | null;
  readonly p_designation: string;
  readonly p_joining_date: string;
  readonly p_role_code: string;
  readonly p_reporting_manager_id: string | null;
  readonly p_attendance_eligible: boolean;
  readonly p_attendance_policy_id: string | null;
}

interface RecordStaffInviteAuthSuccessRpcArgs {
  readonly p_client_request_id: string;
  readonly p_staff_id: string;
}

interface ClientRequestIdRpcArgs {
  readonly p_client_request_id: string;
}

interface ResendStaffInviteRpcArgs {
  readonly p_staff_id: string;
  readonly p_reason: string;
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

interface CreateStaffWithoutInviteRpcArgs {
  readonly p_client_request_id: string;
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

type StaffRpcClient = StaffServerClient & {
  rpc(
    fn: "attach_staff_app_access",
    args: { readonly p_staff_id: string; readonly p_email: string }
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "create_staff_member_without_invite",
    args: CreateStaffWithoutInviteRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "prepare_staff_invite_saga",
    args: PrepareStaffInviteSagaRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "record_staff_invite_auth_success",
    args: RecordStaffInviteAuthSuccessRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "create_staff_member",
    args: ClientRequestIdRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "reconcile_staff_invite",
    args: ClientRequestIdRpcArgs
  ): ReturnType<StaffServerClient["rpc"]>;
  rpc(
    fn: "resend_staff_invite",
    args: ResendStaffInviteRpcArgs
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

function mapPrepareResult(payload: Record<string, unknown>): {
  readonly needsAuth: boolean;
  readonly staffId: string | null;
  readonly sagaState: string | null;
  readonly completed: boolean;
  readonly result: CreateStaffMemberResult | null;
} {
  if (payload.sagaState === "completed" || payload.invitationState === "completed") {
    return {
      needsAuth: false,
      staffId: payload.staffId ? String(payload.staffId) : null,
      sagaState: "completed",
      completed: true,
      result: mapCreateStaffMemberRpcResult(payload),
    };
  }

  return {
    needsAuth: payload.needsAuth === true,
    staffId: payload.staffId ? String(payload.staffId) : null,
    sagaState: payload.sagaState ? String(payload.sagaState) : null,
    completed: false,
    result: null,
  };
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
  const email = normalizeStaffEmail(input.email ?? null);
  const phoneE164 = input.phoneE164?.trim() || null;
  const designation = input.designation.trim();
  const reportingManagerId = input.reportingManagerId?.trim() || null;

  const supabase = await createClient();
  const rpcClient = supabase as StaffRpcClient;

  // No email means no login identity. The employment record is created
  // directly, in one transaction, with no auth user and no invitation. A
  // placeholder address is never generated.
  if (email === null) {
    const { data, error } = await rpcClient.rpc("create_staff_member_without_invite", {
      p_client_request_id: input.clientRequestId,
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
      throw staffErrorFromPostgresMessage(error.message);
    }

    return mapCreateStaffMemberRpcResult(
      assertRpcJson(data, "create_staff_member_without_invite")
    );
  }

  const { data: prepareData, error: prepareError } = await rpcClient.rpc(
    "prepare_staff_invite_saga",
    {
      p_client_request_id: input.clientRequestId,
      p_employee_code: employeeCode,
      p_display_name: displayName,
      p_email: email,
      p_phone_e164: phoneE164,
      p_designation: designation,
      p_joining_date: input.joiningDate,
      p_role_code: input.roleCode,
      p_reporting_manager_id: reportingManagerId,
      p_attendance_eligible: input.attendanceEligible,
      p_attendance_policy_id: input.attendancePolicyId ?? null,
    }
  );

  if (prepareError) {
    throw staffErrorFromPostgresMessage(prepareError.message);
  }

  const preparePayload = assertRpcJson(prepareData, "prepare_staff_invite_saga");
  const prepared = mapPrepareResult(preparePayload);

  if (prepared.completed && prepared.result) {
    return prepared.result;
  }

  let staffId = prepared.staffId;

  if (prepared.needsAuth && !staffId) {
    try {
      const invite = await inviteStaffMemberByEmail({ email, displayName });
      staffId = invite.userId;
    } catch (error) {
      throw new StaffError({
        code: "STAFF_INVITE_FAILED",
        message: "Staff invitation could not be sent.",
        httpStatus: 502,
        details: error instanceof Error ? error.message : undefined,
      });
    }

    const { error: recordError } = await rpcClient.rpc(
      "record_staff_invite_auth_success",
      {
        p_client_request_id: input.clientRequestId,
        p_staff_id: staffId,
      }
    );

    if (recordError) {
      throw staffErrorFromPostgresMessage(recordError.message);
    }
  } else if (!staffId) {
    throw new StaffError({
      code: "STAFF_RECONCILIATION_REQUIRED",
      message: "Staff invite requires reconciliation before finalization.",
      httpStatus: 409,
    });
  }

  const { data, error } = await rpcClient.rpc("create_staff_member", {
    p_client_request_id: input.clientRequestId,
  });

  if (error) {
    return {
      staffId: staffId ?? "",
      employeeCode,
      profileStatus: "pending",
      invitationState: "reconciliation_required",
      accessState: "invited",
      reconciliationState: "auth_created_db_pending",
      idempotentReplay: false,
    };
  }

  return mapCreateStaffMemberRpcResult(data);
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

  return mapCreateStaffMemberRpcResult(data);
}

export async function resendStaffInvite(input: {
  readonly staffId: string;
  readonly reason: string;
}): Promise<{ readonly staffId: string; readonly email: string }> {
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
  const { data, error } = await rpcClient.rpc("resend_staff_invite", {
    p_staff_id: input.staffId,
    p_reason: reason,
  });

  if (error) {
    throw staffErrorFromPostgresMessage(error.message);
  }

  const payload = assertRpcJson(data, "resend_staff_invite");
  const email = String(payload.email ?? "");

  try {
    await inviteStaffMemberByEmail({
      email,
      displayName: String(payload.displayName ?? email),
    });
  } catch (inviteError) {
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message: "Staff invitation could not be resent.",
      httpStatus: 502,
      details: inviteError instanceof Error ? inviteError.message : undefined,
    });
  }

  return {
    staffId: String(payload.staffId ?? input.staffId),
    email,
  };
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

/**
 * Attaches a LOGIN identity to an existing employment record.
 *
 * Order mirrors the invite saga: mark intent in the database first, then call
 * the identity provider. A provider failure leaves access_state at "invited"
 * and is safely retryable, and the auth user is always created with the
 * pre-allocated employment id so profiles.id === auth.users.id.
 */
export async function attachStaffAppAccess(input: {
  readonly staffId: string;
  readonly email: string;
  readonly displayName: string;
}): Promise<{ readonly staffId: string; readonly accessState: string }> {
  await requireManageStaffContext();

  const email = normalizeStaffEmail(input.email);
  if (email === null) {
    throw new StaffError({
      code: "STAFF_EMAIL_INVALID",
      message: "Enter the work email to activate app access.",
      httpStatus: 422,
    });
  }

  const supabase = await createClient();
  const rpcClient = supabase as StaffRpcClient;

  const { error: attachError } = await rpcClient.rpc("attach_staff_app_access", {
    p_staff_id: input.staffId,
    p_email: email,
  });

  if (attachError) {
    throw staffErrorFromPostgresMessage(attachError.message);
  }

  try {
    await provisionStaffLoginIdentity({
      staffId: input.staffId,
      email,
      displayName: input.displayName,
    });
  } catch (error) {
    // The database was already moved to "invited" above, so claiming the record
    // is unchanged would be false. State is deliberately left at "invited":
    // either the login identity exists and only the email failed, or neither
    // happened. Retrying is safe in both cases — attach_staff_app_access
    // refuses only once access is genuinely active, and creating an identity
    // that already exists surfaces as a provider error rather than a duplicate.
    throw new StaffError({
      code: "STAFF_INVITE_FAILED",
      message:
        "App access is marked invited but activation did not finish. Nothing was lost — retry to create the login and resend the set-password email.",
      httpStatus: 502,
      details: error instanceof Error ? error.message : undefined,
    });
  }

  return { staffId: input.staffId, accessState: "invited" };
}
