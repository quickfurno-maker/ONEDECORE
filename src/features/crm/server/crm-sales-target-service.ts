import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type {
  CreateSalesTargetInput,
  LockSalesTargetInput,
  ReopenSalesTargetInput,
  ReviseSalesTargetInput,
  SalesTargetEventSummary,
  SalesTargetSummary,
} from "../contracts/sales-target-contracts.ts";
import {
  validateCreateSalesTargetInput,
  validateSalesTargetReason,
} from "../contracts/sales-target-contracts.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";

interface SalesTargetRow {
  readonly id: string;
  readonly target_scope: string;
  readonly target_month: string;
  readonly target_user_id: string | null;
  readonly revenue_target_paise: number;
  readonly closed_won_count_target: number;
  readonly currency: string;
  readonly status: string;
  readonly revision: number;
  readonly last_reason: string;
  readonly created_at: string;
  readonly updated_at: string;
  readonly profiles?: { display_name: string | null } | null;
}

interface SalesTargetEventRow {
  readonly id: string;
  readonly target_id: string;
  readonly event_type: string;
  readonly revision: number;
  readonly actor_id: string;
  readonly reason: string;
  readonly occurred_at: string;
  readonly profiles?: { display_name: string | null } | null;
}

function mapTarget(row: SalesTargetRow): SalesTargetSummary {
  return {
    id: row.id,
    targetScope: row.target_scope as SalesTargetSummary["targetScope"],
    targetMonth: row.target_month,
    targetUserId: row.target_user_id,
    targetDisplayName: row.profiles?.display_name ?? null,
    revenueTargetPaise: Number(row.revenue_target_paise),
    closedWonCountTarget: row.closed_won_count_target,
    currency: "INR",
    status: row.status as SalesTargetSummary["status"],
    revision: row.revision,
    lastReason: row.last_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapEvent(row: SalesTargetEventRow): SalesTargetEventSummary {
  return {
    id: row.id,
    targetId: row.target_id,
    eventType: row.event_type as SalesTargetEventSummary["eventType"],
    revision: row.revision,
    actorId: row.actor_id,
    actorDisplayName: row.profiles?.display_name ?? null,
    reason: row.reason,
    occurredAt: row.occurred_at,
  };
}

function assertManagePermission(context: CrmAccessContext): void {
  if (!context.canManageSalesTargets) {
    throw new CrmError({
      code: "SALES_TARGET_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

function assertReadPermission(context: CrmAccessContext): void {
  if (!context.canReadSalesTargets) {
    throw new CrmError({
      code: "SALES_TARGET_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

async function phase5eClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export async function fetchSalesTargetsForCurrentUser(): Promise<
  readonly SalesTargetSummary[]
> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "SALES_TARGET_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertReadPermission(context);

  const supabase = await phase5eClient();
  const { data, error } = await supabase
    .from("sales_targets")
    .select(
      "id, target_scope, target_month, target_user_id, revenue_target_paise, closed_won_count_target, currency, status, revision, last_reason, created_at, updated_at, profiles!sales_targets_target_user_id_fkey(display_name)"
    )
    .order("target_month", { ascending: false })
    .order("target_scope", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return (data ?? []).map((row) => mapTarget(row as unknown as SalesTargetRow));
}

export async function fetchSalesTargetEvents(
  targetId: string
): Promise<readonly SalesTargetEventSummary[]> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "SALES_TARGET_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertReadPermission(context);

  const supabase = await phase5eClient();
  const { data, error } = await supabase
    .from("sales_target_events")
    .select(
      "id, target_id, event_type, revision, actor_id, reason, occurred_at, profiles!sales_target_events_actor_id_fkey(display_name)"
    )
    .eq("target_id", targetId)
    .order("occurred_at", { ascending: false });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return (data ?? []).map((row) => mapEvent(row as unknown as SalesTargetEventRow));
}

export async function createSalesTargetForCurrentUser(
  input: CreateSalesTargetInput
): Promise<SalesTargetSummary> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "SALES_TARGET_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertManagePermission(context);

  const fieldErrors = validateCreateSalesTargetInput(input);
  if (Object.keys(fieldErrors).length > 0) {
    throw new CrmError({
      code: "SALES_TARGET_INVALID",
      message: "Sales target details are invalid.",
      httpStatus: 422,
    });
  }

  const supabase = await phase5eClient();
  const { data, error } = await supabase.rpc("create_sales_target", {
    p_target_scope: input.targetScope,
    p_target_month: input.targetMonth,
    p_target_user_id: input.targetUserId,
    p_revenue_target_paise: input.revenueTargetPaise,
    p_closed_won_count_target: input.closedWonCountTarget,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return mapTarget(data as unknown as SalesTargetRow);
}

export async function reviseSalesTargetForCurrentUser(
  input: ReviseSalesTargetInput
): Promise<SalesTargetSummary> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "SALES_TARGET_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertManagePermission(context);

  if (validateSalesTargetReason(input.reason)) {
    throw new CrmError({
      code: "SALES_TARGET_INVALID",
      message: "Reason is invalid.",
      httpStatus: 422,
    });
  }

  const supabase = await phase5eClient();
  const { data, error } = await supabase.rpc("revise_sales_target", {
    p_target_id: input.targetId,
    p_expected_revision: input.expectedRevision,
    p_revenue_target_paise: input.revenueTargetPaise,
    p_closed_won_count_target: input.closedWonCountTarget,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return mapTarget(data as unknown as SalesTargetRow);
}

export async function lockSalesTargetForCurrentUser(
  input: LockSalesTargetInput
): Promise<SalesTargetSummary> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "SALES_TARGET_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertManagePermission(context);

  if (validateSalesTargetReason(input.reason)) {
    throw new CrmError({
      code: "SALES_TARGET_INVALID",
      message: "Reason is invalid.",
      httpStatus: 422,
    });
  }

  const supabase = await phase5eClient();
  const { data, error } = await supabase.rpc("lock_sales_target", {
    p_target_id: input.targetId,
    p_expected_revision: input.expectedRevision,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return mapTarget(data as unknown as SalesTargetRow);
}

export async function reopenSalesTargetForCurrentUser(
  input: ReopenSalesTargetInput
): Promise<SalesTargetSummary> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "SALES_TARGET_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertManagePermission(context);

  if (validateSalesTargetReason(input.reason)) {
    throw new CrmError({
      code: "SALES_TARGET_INVALID",
      message: "Reason is invalid.",
      httpStatus: 422,
    });
  }

  const supabase = await phase5eClient();
  const { data, error } = await supabase.rpc("reopen_sales_target", {
    p_target_id: input.targetId,
    p_expected_revision: input.expectedRevision,
    p_reason: input.reason.trim(),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message);
  }

  return mapTarget(data as unknown as SalesTargetRow);
}
