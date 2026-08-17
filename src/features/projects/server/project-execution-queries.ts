import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ExecutionState } from "../execution/contracts/execution-states";
import { isExecutionState } from "../execution/contracts/execution-states";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export type ExecutionInitializationStatus =
  | "not_eligible"
  | "pending_initialization"
  | "active"
  | "on_hold"
  | "cancelled"
  | "completed";

export interface ProjectExecutionHighLevelStatus {
  readonly projectId: string;
  readonly projectNumber: string;
  readonly executionState: ExecutionState | null;
  readonly initializationStatus: ExecutionInitializationStatus;
  readonly updatedAt: string | null;
  readonly isOnHold: boolean;
  readonly isCancelled: boolean;
  readonly isCompleted: boolean;
}

export interface ProjectExecutionSnagRow {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: string;
  readonly createdAt: string;
  readonly resolvedAt: string | null;
}

export interface ProjectExecutionEvidenceRow {
  readonly id: string;
  readonly evidenceType: string;
  readonly targetState: string | null;
  readonly snagId: string | null;
  readonly sourceType: string;
  readonly capturedAt: string;
  readonly note: string | null;
}

export interface ProjectExecutionWorkspaceData {
  readonly projectId: string;
  readonly projectNumber: string;
  readonly initializationStatus: ExecutionInitializationStatus;
  readonly state: ExecutionState | null;
  readonly heldFromState: string | null;
  readonly holdReasonCode: string | null;
  readonly holdReason: string | null;
  readonly updatedAt: string | null;
  readonly completedAt: string | null;
  readonly cancelledAt: string | null;
  readonly snags: readonly ProjectExecutionSnagRow[];
  readonly evidence: readonly ProjectExecutionEvidenceRow[];
}

function parseInit(value: unknown): ExecutionInitializationStatus {
  if (
    value === "not_eligible" ||
    value === "pending_initialization" ||
    value === "active" ||
    value === "on_hold" ||
    value === "cancelled" ||
    value === "completed"
  ) {
    return value;
  }
  return "not_eligible";
}

export async function getProjectExecutionHighLevelStatus(
  projectId: string
): Promise<ProjectExecutionHighLevelStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_project_execution_high_level_status" as never, {
    p_project_id: projectId,
  } as never);
  if (error || data == null) return null;
  const row = asRecord(data);
  if (!row?.project_id) return null;
  const state = typeof row.execution_state === "string" && isExecutionState(row.execution_state)
    ? row.execution_state
    : null;
  return {
    projectId: String(row.project_id),
    projectNumber: String(row.project_number ?? ""),
    executionState: state,
    initializationStatus: parseInit(row.initialization_status),
    updatedAt: row.updated_at ? String(row.updated_at) : null,
    isOnHold: row.is_on_hold === true,
    isCancelled: row.is_cancelled === true,
    isCompleted: row.is_completed === true,
  };
}

export async function getProjectExecutionWorkspace(
  projectId: string
): Promise<ProjectExecutionWorkspaceData | null> {
  const supabase = await createClient();
  const { data: allowed, error: viewError } = await supabase.rpc(
    "can_view_project_execution_detail" as never,
    { p_project_id: projectId } as never
  );
  if (viewError || allowed !== true) return null;

  const highLevel = await getProjectExecutionHighLevelStatus(projectId);
  if (!highLevel) return null;

  const [{ data: workflow }, { data: snags }, { data: evidence }] = await Promise.all([
    supabase.from("project_execution_workflows" as never).select("*").eq("project_id", projectId).maybeSingle(),
    supabase.from("project_execution_snags" as never).select("*").eq("project_id", projectId).order("created_at"),
    supabase.from("project_execution_evidence" as never).select("id, evidence_type, target_state, snag_id, source_type, captured_at, note").eq("project_id", projectId).order("captured_at"),
  ]);

  const workflowRow = asRecord(workflow);
  const snagRows = Array.isArray(snags) ? snags : [];
  const evidenceRows = Array.isArray(evidence) ? evidence : [];

  return {
    projectId,
    projectNumber: highLevel.projectNumber,
    initializationStatus: highLevel.initializationStatus,
    state: highLevel.executionState,
    heldFromState: workflowRow?.held_from_state ? String(workflowRow.held_from_state) : null,
    holdReasonCode: workflowRow?.hold_reason_code ? String(workflowRow.hold_reason_code) : null,
    holdReason: workflowRow?.hold_reason ? String(workflowRow.hold_reason) : null,
    updatedAt: highLevel.updatedAt,
    completedAt: workflowRow?.completed_at ? String(workflowRow.completed_at) : null,
    cancelledAt: workflowRow?.cancelled_at ? String(workflowRow.cancelled_at) : null,
    snags: snagRows.flatMap((item) => {
      const row = asRecord(item);
      if (!row?.id) return [];
      return [{
        id: String(row.id),
        title: String(row.title ?? ""),
        description: String(row.description ?? ""),
        status: String(row.status ?? ""),
        createdAt: String(row.created_at ?? ""),
        resolvedAt: row.resolved_at ? String(row.resolved_at) : null,
      }];
    }),
    evidence: evidenceRows.flatMap((item) => {
      const row = asRecord(item);
      if (!row?.id) return [];
      return [{
        id: String(row.id),
        evidenceType: String(row.evidence_type ?? ""),
        targetState: row.target_state ? String(row.target_state) : null,
        snagId: row.snag_id ? String(row.snag_id) : null,
        sourceType: String(row.source_type ?? ""),
        capturedAt: String(row.captured_at ?? ""),
        note: row.note ? String(row.note) : null,
      }];
    }),
  };
}
