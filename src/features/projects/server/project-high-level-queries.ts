import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * The Sales Manager's view of a project: STATUS, not the workspace.
 *
 * WHY THIS IS A SEPARATE MODULE
 *
 * The existing project queries read `public.projects` and its related tables
 * directly, and RLS decides what comes back. A Sales Manager has no row access
 * to any of them — Section C of the control-plane migration revoked
 * `projects.read`, which is what every branch of `private.project_can_view` is
 * keyed on — so those queries return nothing for this role, correctly.
 *
 * High-level status therefore comes from a dedicated SECURITY DEFINER read
 * model whose field set is enumerated in SQL. The manager sees exactly the keys
 * below. A column added to `projects` tomorrow does not appear here unless
 * somebody puts it here, which is the property a row-level policy could not
 * have given us.
 *
 * The RPC checks `projects.read_high_level` itself, so this module carries no
 * authority of its own — it maps a result, and a denial surfaces as an error.
 */

export interface ProjectHighLevelStatus {
  readonly projectId: string;
  readonly projectNumber: string;
  readonly status: string;
  readonly clientDisplayName: string | null;
  readonly quotationNumber: string | null;
  readonly commercialCurrency: string | null;
  readonly commercialGrandTotalPaise: number | null;
  /** The CURRENT holder, as a status field. Never the assignment history. */
  readonly currentProjectManager: string | null;
  readonly currentLeadDesigner: string | null;
  readonly createdAt: string;
  readonly handoverAcceptedAt: string | null;
  readonly designState: string | null;
  readonly designStartedAt: string | null;
  readonly designCompletedAt: string | null;
  readonly executionState: string | null;
  readonly executionInitializationStatus: string | null;
  readonly executionUpdatedAt: string | null;
  readonly executionCompletedAt: string | null;
}

/** The shape the RPC returns, before it is renamed into the model above. */
interface HighLevelRow {
  project_id?: unknown;
  project_number?: unknown;
  status?: unknown;
  client_display_name?: unknown;
  quotation_number?: unknown;
  commercial_currency?: unknown;
  commercial_grand_total_paise?: unknown;
  current_project_manager?: unknown;
  current_lead_designer?: unknown;
  created_at?: unknown;
  handover_accepted_at?: unknown;
  design_state?: unknown;
  design_started_at?: unknown;
  design_completed_at?: unknown;
  execution_state?: unknown;
  execution_initialization_status?: unknown;
  execution_updated_at?: unknown;
  execution_completed_at?: unknown;
}

const text = (value: unknown): string | null =>
  typeof value === "string" && value.length > 0 ? value : null;

const number = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

function toStatus(row: HighLevelRow): ProjectHighLevelStatus | null {
  const projectId = text(row.project_id);
  const projectNumber = text(row.project_number);
  const status = text(row.status);
  const createdAt = text(row.created_at);

  // The four fields the page cannot render without. A row missing any of them
  // is dropped rather than rendered half-empty.
  if (!projectId || !projectNumber || !status || !createdAt) {
    return null;
  }

  return {
    projectId,
    projectNumber,
    status,
    clientDisplayName: text(row.client_display_name),
    quotationNumber: text(row.quotation_number),
    commercialCurrency: text(row.commercial_currency),
    commercialGrandTotalPaise: number(row.commercial_grand_total_paise),
    currentProjectManager: text(row.current_project_manager),
    currentLeadDesigner: text(row.current_lead_designer),
    createdAt,
    handoverAcceptedAt: text(row.handover_accepted_at),
    designState: text(row.design_state),
    designStartedAt: text(row.design_started_at),
    designCompletedAt: text(row.design_completed_at),
    executionState: text(row.execution_state),
    executionInitializationStatus: text(row.execution_initialization_status),
    executionUpdatedAt: text(row.execution_updated_at),
    executionCompletedAt: text(row.execution_completed_at),
  };
}

/** Every project this caller may see the status of. Empty when refused. */
export async function listProjectHighLevelStatus(): Promise<
  readonly ProjectHighLevelStatus[]
> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("list_project_high_level_status");

  if (error || !Array.isArray(data)) {
    return [];
  }

  return data.flatMap((row) => {
    const status = toStatus((row ?? {}) as HighLevelRow);
    return status ? [status] : [];
  });
}

/** One project's status. `null` when it does not exist or is refused. */
export async function getProjectHighLevelStatus(
  projectId: string
): Promise<ProjectHighLevelStatus | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_project_high_level_status", {
    p_project_id: projectId,
  });

  if (error || !data || typeof data !== "object") {
    return null;
  }

  return toStatus(data as HighLevelRow);
}
