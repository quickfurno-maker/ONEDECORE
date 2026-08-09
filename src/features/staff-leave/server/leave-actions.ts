"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import { LeaveError, leaveErrorFromPostgresMessage } from "../contracts/errors.ts";
import type {
  CreateLeaveRequestInput,
  LeaveMutationResult,
  LeaveRequestDetail,
  LeaveRequestSummary,
} from "../contracts/dto.ts";
import {
  mapLeaveMutationRpcResult,
  mapLeaveRequestRowToDetail,
  mapLeaveRequestRowToSummary,
} from "../contracts/dto.ts";
import {
  getLeaveAccessContext,
  requireLeaveSelfAccess,
  requireLeaveTeamApproveAccess,
} from "./leave-auth.ts";

type LeaveServerClient = SupabaseClient<Database>;

interface CreateLeaveRequestRpcArgs {
  readonly p_leave_type_id: string;
  readonly p_start_date: string;
  readonly p_end_date: string;
  readonly p_reason: string;
  readonly p_half_day_part?: string | null;
}

interface CancelLeaveRequestRpcArgs {
  readonly p_request_id: string;
  readonly p_reason: string;
}

interface ReviewLeaveRequestRpcArgs {
  readonly p_request_id: string;
  readonly p_note?: string | null;
}

type LeaveRpcClient = LeaveServerClient & {
  rpc(fn: "create_leave_request", args: CreateLeaveRequestRpcArgs): ReturnType<LeaveServerClient["rpc"]>;
  rpc(fn: "cancel_leave_request", args: CancelLeaveRequestRpcArgs): ReturnType<LeaveServerClient["rpc"]>;
  rpc(fn: "approve_leave_request", args: ReviewLeaveRequestRpcArgs): ReturnType<LeaveServerClient["rpc"]>;
  rpc(fn: "reject_leave_request", args: ReviewLeaveRequestRpcArgs): ReturnType<LeaveServerClient["rpc"]>;
};

type LeaveQueryResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type LeaveQueryBuilder = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select(columns: string): LeaveQueryBuilder;
  eq(column: string, value: string): LeaveQueryBuilder;
  order(column: string, options: { ascending: boolean }): LeaveQueryBuilder;
  maybeSingle(): LeaveQueryResult;
};

type LeaveQueryClient = {
  from(table: "leave_requests" | "leave_types"): LeaveQueryBuilder;
};

function leaveRpcClient(client: LeaveServerClient): LeaveRpcClient {
  return client as LeaveRpcClient;
}

function leaveQueryClient(client: LeaveServerClient): LeaveQueryClient {
  return client as unknown as LeaveQueryClient;
}

export async function create(input: CreateLeaveRequestInput): Promise<LeaveMutationResult> {
  await requireLeaveSelfAccess();

  const supabase = await createClient();
  const { data, error } = await leaveRpcClient(supabase).rpc("create_leave_request", {
    p_leave_type_id: input.leaveTypeId,
    p_start_date: input.startDate,
    p_end_date: input.endDate,
    p_reason: input.reason.trim(),
    p_half_day_part: input.halfDayPart ?? null,
  });

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  return mapLeaveMutationRpcResult(data as { requestId: string; status: string });
}

export async function cancel(input: {
  readonly requestId: string;
  readonly reason: string;
}): Promise<LeaveMutationResult> {
  const context = await getLeaveAccessContext();
  if (!context) {
    throw new LeaveError({
      code: "LEAVE_UNAUTHORIZED",
      message: "Authentication or permission required.",
      httpStatus: 401,
    });
  }

  const supabase = await createClient();
  const { data, error } = await leaveRpcClient(supabase).rpc("cancel_leave_request", {
    p_request_id: input.requestId,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  return mapLeaveMutationRpcResult(data as { requestId: string; status: string });
}

export async function approve(input: {
  readonly requestId: string;
  readonly note?: string | null;
}): Promise<LeaveMutationResult> {
  await requireLeaveTeamApproveAccess();

  const supabase = await createClient();
  const { data, error } = await leaveRpcClient(supabase).rpc("approve_leave_request", {
    p_request_id: input.requestId,
    p_note: input.note?.trim() ?? null,
  });

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  return mapLeaveMutationRpcResult(data as { requestId: string; status: string });
}

export async function reject(input: {
  readonly requestId: string;
  readonly note?: string | null;
}): Promise<LeaveMutationResult> {
  await requireLeaveTeamApproveAccess();

  const supabase = await createClient();
  const { data, error } = await leaveRpcClient(supabase).rpc("reject_leave_request", {
    p_request_id: input.requestId,
    p_note: input.note?.trim() ?? null,
  });

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  return mapLeaveMutationRpcResult(data as { requestId: string; status: string });
}

export async function loadMyRequests(): Promise<readonly LeaveRequestSummary[]> {
  const context = await requireLeaveSelfAccess();
  const supabase = await createClient();
  const { data, error } = await leaveQueryClient(supabase)
    .from("leave_requests")
    .select(
      "id, staff_id, leave_type_id, start_date, end_date, half_day_part, reason, status, reviewed_by, reviewed_at, review_note, created_at, updated_at, leave_types(display_name)"
    )
    .eq("staff_id", context.userId)
    .order("start_date", { ascending: false });

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  return ((data as Parameters<typeof mapLeaveRequestRowToSummary>[0][] | null) ?? []).map(
    mapLeaveRequestRowToSummary
  );
}

export async function loadRequestDetail(requestId: string): Promise<LeaveRequestDetail | null> {
  const context = await getLeaveAccessContext();
  if (!context) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await leaveQueryClient(supabase)
    .from("leave_requests")
    .select(
      "id, staff_id, leave_type_id, start_date, end_date, half_day_part, reason, status, reviewed_by, reviewed_at, review_note, created_at, updated_at, leave_types(display_name)"
    )
    .eq("id", requestId)
    .maybeSingle();

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  if (!data) {
    return null;
  }

  return mapLeaveRequestRowToDetail(data as Parameters<typeof mapLeaveRequestRowToDetail>[0]);
}

export interface LeaveTypeSummary {
  readonly id: string;
  readonly code: string;
  readonly displayName: string;
  readonly allowsHalfDay: boolean;
  readonly isActive: boolean;
}

export interface TeamLeaveRequestSummary extends LeaveRequestSummary {
  readonly staffId: string;
  readonly staffName: string;
}

export async function loadLeaveTypes(): Promise<readonly LeaveTypeSummary[]> {
  const context = await getLeaveAccessContext();
  if (!context) {
    throw new LeaveError({
      code: "LEAVE_UNAUTHORIZED",
      message: "Authentication or permission required.",
      httpStatus: 401,
    });
  }

  const supabase = await createClient();
  const { data, error } = await leaveQueryClient(supabase)
    .from("leave_types")
    .select("id, code, display_name, allows_half_day, is_active")
    .order("display_name", { ascending: true });

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  return (
    (data as Array<{
      id: string;
      code: string;
      display_name: string;
      allows_half_day: boolean;
      is_active: boolean;
    }> | null) ?? []
  ).map((row) => ({
    id: row.id,
    code: row.code,
    displayName: row.display_name,
    allowsHalfDay: row.allows_half_day,
    isActive: row.is_active,
  }));
}

export async function loadActiveLeaveTypes(): Promise<readonly LeaveTypeSummary[]> {
  const types = await loadLeaveTypes();
  return types.filter((type) => type.isActive);
}

export async function loadTeamPendingRequests(): Promise<readonly TeamLeaveRequestSummary[]> {
  await requireLeaveTeamApproveAccess();

  const supabase = await createClient();
  const { data, error } = await leaveQueryClient(supabase)
    .from("leave_requests")
    .select(
      "id, staff_id, leave_type_id, start_date, end_date, half_day_part, reason, status, reviewed_by, reviewed_at, review_note, created_at, updated_at, leave_types(display_name), profiles!leave_requests_staff_id_fkey(display_name)"
    )
    .eq("status", "pending")
    .order("start_date", { ascending: true });

  if (error) {
    throw leaveErrorFromPostgresMessage(error.message);
  }

  return (
    (data as Array<Parameters<typeof mapLeaveRequestRowToSummary>[0] & {
      profiles?: { display_name: string | null } | null;
    }> | null) ?? []
  ).map((row) => ({
    ...mapLeaveRequestRowToSummary(row),
    staffId: row.staff_id,
    staffName: row.profiles?.display_name?.trim() || "Staff member",
  }));
}
