import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProjectHandoverState } from "../contracts/lifecycle";
import type { ProjectCommercialSnapshotView } from "../contracts/commercial";
import type { ProjectStaffingSnapshot } from "../contracts/assignment";
import type { ProjectSummary } from "../contracts/summary";
import { createProjectRef } from "../contracts/reference";

export interface ProjectListItem {
  readonly id: string;
  readonly projectNumber: string;
  readonly status: ProjectHandoverState;
  readonly quotationNumber: string | null;
  readonly clientDisplayName: string | null;
  readonly primaryPmDisplayName: string | null;
  readonly handoverAcceptedAt: string | null;
  readonly createdAt: string;
}

export interface PendingMaterializationRow {
  readonly quotationVersionId: string;
  readonly quotationId: string;
  readonly quotationAcceptanceId: string;
  readonly leadId: string;
  readonly quotationNumber: string | null;
  readonly acceptedAt: string | null;
}

export interface AssignableProjectManager {
  readonly id: string;
  readonly displayName: string;
}

export interface ProjectAssignmentHistoryRow {
  readonly id: string;
  readonly projectManagerId: string;
  readonly projectManagerDisplayName: string | null;
  readonly assignedBy: string;
  readonly assignedAt: string;
  readonly endedAt: string | null;
  readonly reason: string | null;
}

export interface ProjectEventRow {
  readonly id: string;
  readonly eventType: string;
  readonly actorKind: string;
  readonly actorId: string | null;
  readonly occurredAt: string;
  readonly details: Record<string, unknown>;
}

export interface ProjectHandoverDetail {
  readonly id: string;
  readonly projectNumber: string;
  readonly status: ProjectHandoverState;
  readonly leadId: string;
  readonly acceptedQuotationId: string;
  readonly acceptedQuotationVersionId: string;
  readonly quotationNumber: string | null;
  readonly acceptedAt: string | null;
  readonly handoverAcceptedAt: string | null;
  readonly createdAt: string;
  readonly primaryPmId: string | null;
  readonly creditedSalesExecutiveId: string | null;
  readonly summary: ProjectSummary;
  readonly commercial: ProjectCommercialSnapshotView | null;
  readonly staffing: ProjectStaffingSnapshot;
  readonly assignments: readonly ProjectAssignmentHistoryRow[];
  readonly events: readonly ProjectEventRow[];
  readonly clientDisplayName: string | null;
  readonly propertySnapshot: string | null;
}

function isHandoverState(value: string): value is ProjectHandoverState {
  return (
    value === "awaiting_project_manager_assignment" ||
    value === "awaiting_project_manager_acceptance" ||
    value === "handover_accepted"
  );
}

function statusLabel(status: ProjectHandoverState): string {
  switch (status) {
    case "awaiting_project_manager_assignment":
      return "Awaiting PM assignment";
    case "awaiting_project_manager_acceptance":
      return "Awaiting PM acceptance";
    case "handover_accepted":
      return "Handover accepted";
    default:
      return status;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export async function listProjects(): Promise<readonly ProjectListItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      project_number,
      status,
      handover_accepted_at,
      created_at,
      primary_pm:profiles!projects_primary_pm_id_fkey(display_name),
      quotations:quotations!projects_accepted_quotation_id_fkey(quotation_number),
      leads:leads!projects_lead_id_fkey(submitted_name),
      quotation_acceptances:quotation_acceptances!projects_quotation_acceptance_id_fkey(accepted_by_name)
    `
    )
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.flatMap((row) => {
    if (!isHandoverState(row.status)) return [];
    const quotation = Array.isArray(row.quotations) ? row.quotations[0] : row.quotations;
    const lead = Array.isArray(row.leads) ? row.leads[0] : row.leads;
    const acceptance = Array.isArray(row.quotation_acceptances)
      ? row.quotation_acceptances[0]
      : row.quotation_acceptances;
    const pm = Array.isArray(row.primary_pm) ? row.primary_pm[0] : row.primary_pm;
    return [
      {
        id: row.id,
        projectNumber: row.project_number,
        status: row.status,
        quotationNumber: quotation?.quotation_number ?? null,
        clientDisplayName: lead?.submitted_name ?? acceptance?.accepted_by_name ?? null,
        primaryPmDisplayName: pm?.display_name ?? null,
        handoverAcceptedAt: row.handover_accepted_at,
        createdAt: row.created_at,
      },
    ];
  });
}

export async function listPendingProjectMaterializations(): Promise<
  readonly PendingMaterializationRow[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_pending_closed_won_project_materializations");
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item) => {
    const row = asRecord(item);
    if (!row?.quotation_version_id) return [];
    return [
      {
        quotationVersionId: String(row.quotation_version_id),
        quotationId: String(row.quotation_id ?? ""),
        quotationAcceptanceId: String(row.quotation_acceptance_id ?? ""),
        leadId: String(row.lead_id ?? ""),
        quotationNumber: row.quotation_number ? String(row.quotation_number) : null,
        acceptedAt: row.accepted_at ? String(row.accepted_at) : null,
      },
    ];
  });
}

export async function listAssignableProjectManagers(): Promise<
  readonly AssignableProjectManager[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_assignable_project_managers");
  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.flatMap((item) => {
    const row = asRecord(item);
    if (!row?.id) return [];
    return [
      {
        id: String(row.id),
        displayName: row.display_name ? String(row.display_name) : "Project manager",
      },
    ];
  });
}

export async function getProjectHandoverDetail(
  projectId: string
): Promise<ProjectHandoverDetail | null> {
  const supabase = await createClient();
  const { data: project, error } = await supabase
    .from("projects")
    .select(
      `
      id,
      project_number,
      status,
      lead_id,
      accepted_quotation_id,
      accepted_quotation_version_id,
      primary_pm_id,
      handover_accepted_at,
      created_at,
      quotations:quotations!projects_accepted_quotation_id_fkey(quotation_number),
      leads:leads!projects_lead_id_fkey(submitted_name),
      quotation_acceptances:quotation_acceptances!projects_quotation_acceptance_id_fkey(
        accepted_at,
        accepted_by_name,
        credited_sales_executive_id,
        taxable_base_paise
      )
    `
    )
    .eq("id", projectId)
    .maybeSingle();

  if (error || !project || !isHandoverState(project.status)) {
    return null;
  }

  const quotation = Array.isArray(project.quotations) ? project.quotations[0] : project.quotations;
  const lead = Array.isArray(project.leads) ? project.leads[0] : project.leads;
  const acceptance = Array.isArray(project.quotation_acceptances)
    ? project.quotation_acceptances[0]
    : project.quotation_acceptances;

  const { data: version } = await supabase
    .from("quotation_versions")
    .select(
      "version_number, taxable_base_paise, grand_total_paise, scope_summary, finalized_content_sha256, client_name_snapshot, property_address_snapshot"
    )
    .eq("id", project.accepted_quotation_version_id)
    .maybeSingle();

  const { data: assignmentRows } = await supabase
    .from("project_manager_assignments")
    .select("id, project_manager_id, assigned_by, assigned_at, ended_at, reason")
    .eq("project_id", projectId)
    .order("assigned_at", { ascending: false });

  const { data: eventRows } = await supabase
    .from("project_events")
    .select("id, event_type, actor_kind, actor_id, occurred_at, details")
    .eq("project_id", projectId)
    .order("occurred_at", { ascending: false });

  const pmIds = new Set<string>();
  if (project.primary_pm_id) pmIds.add(project.primary_pm_id);
  for (const row of assignmentRows ?? []) {
    pmIds.add(row.project_manager_id);
  }

  const { data: profiles } = pmIds.size
    ? await supabase.from("profiles").select("id, display_name").in("id", [...pmIds])
    : { data: [] as { id: string; display_name: string | null }[] };

  const nameById = new Map((profiles ?? []).map((p) => [p.id, p.display_name]));
  const currentAssignment = (assignmentRows ?? []).find((row) => row.ended_at === null) ?? null;
  const quotationNumber = quotation?.quotation_number ?? "OD-Q-UNKNOWN";
  const revisionNumber = version?.version_number ?? 1;
  const clientDisplayName =
    version?.client_name_snapshot ?? lead?.submitted_name ?? acceptance?.accepted_by_name ?? "Client";

  const summary: ProjectSummary = {
    ref: createProjectRef({
      projectReference: project.project_number,
      leadReference: project.lead_id,
      acceptedQuotationReference: quotationNumber,
      acceptedRevisionNumber: revisionNumber,
    }),
    clientDisplayName,
    projectLabel: version?.scope_summary ?? null,
    handoverState: project.status,
    highLevelStatusLabel: statusLabel(project.status),
    owningSalesExecutiveId: acceptance?.credited_sales_executive_id ?? null,
    primaryProjectManagerId: project.primary_pm_id,
    leadDesignerId: null,
    createdAt: project.created_at,
  };

  const commercial: ProjectCommercialSnapshotView | null = version
    ? {
        quotationReference: quotationNumber,
        revisionNumber,
        acceptedAt: acceptance?.accepted_at ?? project.created_at,
        currency: "INR",
        taxableBasePaise: version.taxable_base_paise,
        grandTotalPaise: version.grand_total_paise ?? version.taxable_base_paise,
        grandTotalLabel: `₹${((version.grand_total_paise ?? version.taxable_base_paise) / 100).toLocaleString("en-IN")}`,
        scopeSummary: version.scope_summary,
        contentHash: version.finalized_content_sha256 ?? project.accepted_quotation_version_id,
      }
    : null;

  const staffing: ProjectStaffingSnapshot = {
    primaryProjectManager:
      project.primary_pm_id && currentAssignment
        ? {
            staffProfileId: project.primary_pm_id,
            displayName: nameById.get(project.primary_pm_id) ?? "Project manager",
            role: "primary_project_manager",
            assignedAt: currentAssignment.assigned_at,
            assignedByProfileId: currentAssignment.assigned_by,
          }
        : null,
    leadDesigner: null,
    supportingDesigners: [],
  };

  return {
    id: project.id,
    projectNumber: project.project_number,
    status: project.status,
    leadId: project.lead_id,
    acceptedQuotationId: project.accepted_quotation_id,
    acceptedQuotationVersionId: project.accepted_quotation_version_id,
    quotationNumber: quotation?.quotation_number ?? null,
    acceptedAt: acceptance?.accepted_at ?? null,
    handoverAcceptedAt: project.handover_accepted_at,
    createdAt: project.created_at,
    primaryPmId: project.primary_pm_id,
    creditedSalesExecutiveId: acceptance?.credited_sales_executive_id ?? null,
    summary,
    commercial,
    staffing,
    assignments: (assignmentRows ?? []).map((row) => ({
      id: row.id,
      projectManagerId: row.project_manager_id,
      projectManagerDisplayName: nameById.get(row.project_manager_id) ?? null,
      assignedBy: row.assigned_by,
      assignedAt: row.assigned_at,
      endedAt: row.ended_at,
      reason: row.reason,
    })),
    events: (eventRows ?? []).map((row) => ({
      id: row.id,
      eventType: row.event_type,
      actorKind: row.actor_kind,
      actorId: row.actor_id,
      occurredAt: row.occurred_at,
      details: asRecord(row.details) ?? {},
    })),
    clientDisplayName,
    propertySnapshot: version?.property_address_snapshot ?? null,
  };
}
