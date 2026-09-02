"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  createWorkforceError,
  workforceErrorFromPostgresMessage,
} from "../contracts/workforce-errors.ts";
import {
  isWorkforceFinalCategory,
  isWorkforceSubmittableCategory,
  mapApprovalInboxRow,
  mapMonthlySummary,
  type WorkforceApprovalInboxRow,
  type WorkforceFinalCategory,
  type WorkforceMonthlySummary,
  type WorkforceSubmittableCategory,
} from "../contracts/workforce-contracts.ts";
import { getAttendanceAccessContext } from "./attendance-auth.ts";

type WorkforceServerClient = SupabaseClient<Database>;

interface SubmitAttendanceDayRpcArgs {
  readonly p_attendance_date: string;
  readonly p_category: string;
}

interface RequestCorrectionRpcArgs {
  readonly p_attendance_date: string;
  readonly p_note: string;
}

interface ApproveAttendanceDayRpcArgs {
  readonly p_staff_id: string;
  readonly p_attendance_date: string;
  readonly p_final_category?: string | null;
  readonly p_note?: string | null;
}

interface DecideAttendanceDayRpcArgs {
  readonly p_staff_id: string;
  readonly p_attendance_date: string;
  readonly p_note: string;
}

interface ApprovalInboxRpcArgs {
  readonly p_from?: string | null;
  readonly p_to?: string | null;
  readonly p_limit?: number;
}

interface MonthlySummaryRpcArgs {
  readonly p_staff_id: string;
  readonly p_month: string;
}

type WorkforceRpcClient = WorkforceServerClient & {
  rpc(fn: "submit_attendance_day", args: SubmitAttendanceDayRpcArgs): ReturnType<WorkforceServerClient["rpc"]>;
  rpc(fn: "request_attendance_correction", args: RequestCorrectionRpcArgs): ReturnType<WorkforceServerClient["rpc"]>;
  rpc(fn: "approve_attendance_day", args: ApproveAttendanceDayRpcArgs): ReturnType<WorkforceServerClient["rpc"]>;
  rpc(fn: "reject_attendance_day", args: DecideAttendanceDayRpcArgs): ReturnType<WorkforceServerClient["rpc"]>;
  rpc(fn: "return_attendance_for_correction", args: DecideAttendanceDayRpcArgs): ReturnType<WorkforceServerClient["rpc"]>;
  rpc(fn: "get_attendance_approval_inbox", args: ApprovalInboxRpcArgs): ReturnType<WorkforceServerClient["rpc"]>;
  rpc(fn: "get_attendance_monthly_summary", args: MonthlySummaryRpcArgs): ReturnType<WorkforceServerClient["rpc"]>;
};

function workforceRpcClient(client: WorkforceServerClient): WorkforceRpcClient {
  return client as WorkforceRpcClient;
}

async function requireSelfAttendance() {
  const context = await getAttendanceAccessContext();
  if (!context?.canSelfAttendance) {
    throw createWorkforceError("WORKFORCE_UNAUTHORIZED");
  }
  return context;
}

function assertJsonObject(data: unknown, label: string): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    throw workforceErrorFromPostgresMessage(`Empty ${label} RPC result`);
  }
  return data as Record<string, unknown>;
}

/**
 * Staff submits one daily attendance category.
 *
 * The category allow-list is enforced again in the database; rejecting ABSENT
 * here only avoids a pointless round trip. Server validation stays
 * authoritative, and the Weekly Off monthly cap is enforced in the RPC.
 */
export async function submitAttendanceDay(input: {
  readonly attendanceDate: string;
  readonly category: WorkforceSubmittableCategory;
}): Promise<Record<string, unknown>> {
  await requireSelfAttendance();

  if (!isWorkforceSubmittableCategory(input.category)) {
    throw createWorkforceError("WORKFORCE_CATEGORY_INVALID");
  }

  const client = await createClient();
  const { data, error } = await workforceRpcClient(client).rpc("submit_attendance_day", {
    p_attendance_date: input.attendanceDate,
    p_category: input.category,
  });

  if (error) {
    throw workforceErrorFromPostgresMessage(error.message);
  }

  return assertJsonObject(data, "submit_attendance_day");
}

/** Staff asks for a correction when check-in/out evidence is wrong or missing. */
export async function requestAttendanceCorrection(input: {
  readonly attendanceDate: string;
  readonly note: string;
}): Promise<Record<string, unknown>> {
  await requireSelfAttendance();

  const note = input.note.trim();
  if (note.length === 0 || note.length > 500) {
    throw createWorkforceError("WORKFORCE_REASON_REQUIRED");
  }

  const client = await createClient();
  const { data, error } = await workforceRpcClient(client).rpc(
    "request_attendance_correction",
    { p_attendance_date: input.attendanceDate, p_note: note }
  );

  if (error) {
    throw workforceErrorFromPostgresMessage(error.message);
  }

  return assertJsonObject(data, "request_attendance_correction");
}

/**
 * Super Admin approval, optionally overriding the category (Edit + Approve).
 *
 * Authority is checked in the database (`attendance.approve`), so this wrapper
 * deliberately does not pre-authorize: a client that skipped the UI still hits
 * the same server gate.
 */
export async function approveAttendanceDay(input: {
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly finalCategory?: WorkforceFinalCategory | null;
  readonly note?: string | null;
}): Promise<Record<string, unknown>> {
  if (input.finalCategory != null && !isWorkforceFinalCategory(input.finalCategory)) {
    throw createWorkforceError("WORKFORCE_CATEGORY_INVALID");
  }

  const client = await createClient();
  const { data, error } = await workforceRpcClient(client).rpc("approve_attendance_day", {
    p_staff_id: input.staffId,
    p_attendance_date: input.attendanceDate,
    p_final_category: input.finalCategory ?? null,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    throw workforceErrorFromPostgresMessage(error.message);
  }

  return assertJsonObject(data, "approve_attendance_day");
}

export async function rejectAttendanceDay(input: {
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly note: string;
}): Promise<Record<string, unknown>> {
  const client = await createClient();
  const { data, error } = await workforceRpcClient(client).rpc("reject_attendance_day", {
    p_staff_id: input.staffId,
    p_attendance_date: input.attendanceDate,
    p_note: input.note.trim(),
  });

  if (error) {
    throw workforceErrorFromPostgresMessage(error.message);
  }

  return assertJsonObject(data, "reject_attendance_day");
}

export async function returnAttendanceForCorrection(input: {
  readonly staffId: string;
  readonly attendanceDate: string;
  readonly note: string;
}): Promise<Record<string, unknown>> {
  const client = await createClient();
  const { data, error } = await workforceRpcClient(client).rpc(
    "return_attendance_for_correction",
    {
      p_staff_id: input.staffId,
      p_attendance_date: input.attendanceDate,
      p_note: input.note.trim(),
    }
  );

  if (error) {
    throw workforceErrorFromPostgresMessage(error.message);
  }

  return assertJsonObject(data, "return_attendance_for_correction");
}

/** Super Admin approval inbox. */
export async function loadApprovalInbox(input?: {
  readonly from?: string | null;
  readonly to?: string | null;
  readonly limit?: number;
}): Promise<readonly WorkforceApprovalInboxRow[]> {
  const client = await createClient();
  const { data, error } = await workforceRpcClient(client).rpc(
    "get_attendance_approval_inbox",
    {
      p_from: input?.from ?? null,
      p_to: input?.to ?? null,
      p_limit: input?.limit ?? 200,
    }
  );

  if (error) {
    throw workforceErrorFromPostgresMessage(error.message);
  }

  const payload = assertJsonObject(data, "get_attendance_approval_inbox");
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  return rows.map((row) => mapApprovalInboxRow(row as Record<string, unknown>));
}

/**
 * Approved-only monthly summary. Visibility is enforced by
 * `private.staff_can_view_attendance`, so staff see only their own month.
 */
export async function loadMonthlyAttendanceSummary(input: {
  readonly staffId: string;
  readonly month: string;
}): Promise<WorkforceMonthlySummary> {
  const client = await createClient();
  const { data, error } = await workforceRpcClient(client).rpc(
    "get_attendance_monthly_summary",
    { p_staff_id: input.staffId, p_month: input.month }
  );

  if (error) {
    throw workforceErrorFromPostgresMessage(error.message);
  }

  return mapMonthlySummary(assertJsonObject(data, "get_attendance_monthly_summary"));
}
