import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DesignState } from "../contracts/design-states";
import { isDesignState } from "../contracts/design-states";
import type { ProjectStaffingSnapshot } from "../contracts/assignment";

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export interface AssignableDesigner {
  readonly id: string;
  readonly displayName: string;
}

export interface ProjectDesignDeliverableRow {
  readonly id: string;
  readonly deliverableKey: string;
  readonly kind: string;
  readonly versionNumber: number;
  readonly label: string;
  readonly uploadStatus: string;
  readonly fileName: string;
  readonly uploadedBy: string;
  readonly createdAt: string;
  readonly readyAt: string | null;
  readonly isCurrent: boolean;
}

export interface ProjectDesignEvidenceRow {
  readonly id: string;
  readonly evidenceType: string;
  readonly sourceType: string;
  readonly capturedAt: string;
  readonly note: string | null;
}

export interface ProjectDesignHighLevelStatus {
  readonly projectId: string;
  readonly projectNumber: string;
  readonly state: DesignState | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
}

export interface ProjectDesignWorkspaceData {
  readonly projectId: string;
  readonly workflowState: DesignState | null;
  readonly heldFromState: DesignState | null;
  readonly revisionReturnState: DesignState | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly staffing: Pick<ProjectStaffingSnapshot, "leadDesigner" | "supportingDesigners">;
  readonly deliverables: readonly ProjectDesignDeliverableRow[];
  readonly evidence: readonly ProjectDesignEvidenceRow[];
  readonly assignableDesigners: readonly AssignableDesigner[];
}

export async function listAssignableDesigners(): Promise<readonly AssignableDesigner[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_assignable_designers" as never);
  if (error || data == null) return [];
  const rows = Array.isArray(data) ? data : [];
  return rows.flatMap((item) => {
    const row = asRecord(item);
    if (!row?.id) return [];
    return [{ id: String(row.id), displayName: String(row.display_name ?? "Designer") }];
  });
}

export async function getProjectDesignHighLevelStatus(
  projectId: string
): Promise<ProjectDesignHighLevelStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_project_design_high_level_status" as never, {
    p_project_id: projectId,
  } as never);
  const row = asRecord(data);
  if (error || !row?.project_id) return null;
  const state = row.state ? String(row.state) : null;
  return {
    projectId: String(row.project_id),
    projectNumber: String(row.project_number ?? ""),
    state: state && isDesignState(state) ? state : null,
    startedAt: row.started_at ? String(row.started_at) : null,
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export async function getProjectDesignWorkspace(
  projectId: string,
  canStaff: boolean
): Promise<ProjectDesignWorkspaceData | null> {
  const supabase = await createClient();
  const { data: allowed } = await supabase.rpc("can_view_project_design" as never, {
    p_project_id: projectId,
  } as never);
  if (allowed !== true) {
    return null;
  }

  const { data: workflow } = await supabase
    .from("project_design_workflows" as never)
    .select("state, held_from_state, revision_return_state, started_at, completed_at")
    .eq("project_id" as never, projectId)
    .maybeSingle();

  const { data: assignments } = await supabase
    .from("project_designer_assignments" as never)
    .select("designer_id, assignment_role, assigned_at, assigned_by, ended_at")
    .eq("project_id" as never, projectId)
    .is("ended_at" as never, null);

  const { data: versions } = await supabase
    .from("project_design_deliverable_versions" as never)
    .select(
      "id, deliverable_key, kind, version_number, label, upload_status, file_name, uploaded_by, created_at, ready_at"
    )
    .eq("project_id" as never, projectId)
    .order("created_at" as never, { ascending: false });

  const { data: evidence } = await supabase
    .from("project_design_evidence" as never)
    .select("id, evidence_type, source_type, captured_at, note")
    .eq("project_id" as never, projectId)
    .order("captured_at" as never, { ascending: false });

  const assignmentRows = (assignments ?? []) as Array<{
    designer_id: string;
    assignment_role: string;
    assigned_at: string;
    assigned_by: string;
    ended_at: string | null;
  }>;
  const ids = assignmentRows.map((row) => row.designer_id);
  const { data: profiles } = ids.length
    ? await supabase.from("profiles").select("id, display_name").in("id", ids)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name ?? "Designer"]));

  const lead = assignmentRows.find((row) => row.assignment_role === "lead_designer") ?? null;
  const supporting = assignmentRows.filter((row) => row.assignment_role === "supporting_designer");

  const versionRows = (versions ?? []) as Array<{
    id: string;
    deliverable_key: string;
    kind: string;
    version_number: number;
    label: string;
    upload_status: string;
    file_name: string;
    uploaded_by: string;
    created_at: string;
    ready_at: string | null;
  }>;

  const currentByKey = new Map<string, number>();
  for (const row of versionRows) {
    if (row.upload_status !== "ready") continue;
    const existing = currentByKey.get(row.deliverable_key) ?? 0;
    if (row.version_number > existing) currentByKey.set(row.deliverable_key, row.version_number);
  }

  const wf = workflow as {
    state?: string;
    held_from_state?: string | null;
    revision_return_state?: string | null;
    started_at?: string;
    completed_at?: string | null;
  } | null;

  return {
    projectId,
    workflowState: wf?.state && isDesignState(wf.state) ? wf.state : null,
    heldFromState: wf?.held_from_state && isDesignState(wf.held_from_state) ? wf.held_from_state : null,
    revisionReturnState:
      wf?.revision_return_state && isDesignState(wf.revision_return_state)
        ? wf.revision_return_state
        : null,
    startedAt: wf?.started_at ?? null,
    completedAt: wf?.completed_at ?? null,
    staffing: {
      leadDesigner: lead
        ? {
            staffProfileId: lead.designer_id,
            displayName: nameById.get(lead.designer_id) ?? "Lead designer",
            role: "lead_designer",
            assignedAt: lead.assigned_at,
            assignedByProfileId: lead.assigned_by,
          }
        : null,
      supportingDesigners: supporting.map((row) => ({
        staffProfileId: row.designer_id,
        displayName: nameById.get(row.designer_id) ?? "Supporting designer",
        role: "supporting_designer" as const,
        assignedAt: row.assigned_at,
        assignedByProfileId: row.assigned_by,
      })),
    },
    deliverables: versionRows.map((row) => ({
      id: row.id,
      deliverableKey: row.deliverable_key,
      kind: row.kind,
      versionNumber: row.version_number,
      label: row.label,
      uploadStatus: row.upload_status,
      fileName: row.file_name,
      uploadedBy: row.uploaded_by,
      createdAt: row.created_at,
      readyAt: row.ready_at,
      isCurrent:
        row.upload_status === "ready" &&
        currentByKey.get(row.deliverable_key) === row.version_number,
    })),
    evidence: ((evidence ?? []) as Array<{
      id: string;
      evidence_type: string;
      source_type: string;
      captured_at: string;
      note: string | null;
    }>).map((row) => ({
      id: row.id,
      evidenceType: row.evidence_type,
      sourceType: row.source_type,
      capturedAt: row.captured_at,
      note: row.note,
    })),
    assignableDesigners: canStaff ? await listAssignableDesigners() : [],
  };
}
