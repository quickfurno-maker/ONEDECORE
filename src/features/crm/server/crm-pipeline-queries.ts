import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import {
  CRM_PIPELINE_BOARD_STAGES,
  CRM_PIPELINE_STAGE_EVENT_SCAN_LIMIT,
  CRM_PIPELINE_STAGE_ENTRY_EVENT_TYPES,
  CRM_PIPELINE_STAGE_FETCH_LIMIT,
  sortPipelineCards,
  type CrmPipelineBoard,
  type CrmPipelineBoardStage,
  type CrmPipelineCard,
  type CrmPipelineStageColumn,
} from "../contracts/pipeline-contracts.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { fetchCrmAssigneeDirectory } from "./crm-lead-queries.ts";

const PIPELINE_LEAD_SELECT =
  "id, status, submitted_name, service_code, locality, assigned_to, created_at, lead_sources!leads_primary_source_id_fkey(display_name)";

interface PipelineLeadRow {
  readonly id: string;
  readonly status: string;
  readonly submitted_name: string;
  readonly service_code: string;
  readonly locality: string | null;
  readonly assigned_to: string | null;
  readonly created_at: string;
  readonly lead_sources: { readonly display_name: string } | null;
}

export interface FetchCrmPipelineOptions {
  readonly ownerId?: string | null;
}

/**
 * Bounded pipeline read model.
 *
 * One request per board column (exact total + the urgent head), then three
 * batched lookups keyed on the fetched lead ids. No per-card queries, and no
 * stage taxonomy beyond `CRM_PIPELINE_BOARD_STAGES`, which is derived from the
 * canonical `LEAD_STAGE_CODES`.
 */
export async function fetchCrmPipelineBoard(
  context: CrmAccessContext,
  options: FetchCrmPipelineOptions = {}
): Promise<CrmPipelineBoard> {
  const supabase = await createClient();
  const scopeOwnerId = context.canReadBroad ? options.ownerId ?? null : null;

  const stageResults = await Promise.all(
    CRM_PIPELINE_BOARD_STAGES.map(async (stage) => {
      let request = supabase
        .from("leads")
        .select(PIPELINE_LEAD_SELECT, { count: "exact" })
        .eq("status", stage);

      if (scopeOwnerId) {
        request = request.eq("assigned_to", scopeOwnerId);
      }

      const { data, error, count } = await request
        // Oldest first so the bounded head is the at-risk head, never the
        // freshest rows. Urgency ordering is applied after enrichment.
        .order("created_at", { ascending: true })
        .order("id", { ascending: true })
        .limit(CRM_PIPELINE_STAGE_FETCH_LIMIT);

      if (error) {
        throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
      }

      return {
        stage,
        total: count ?? 0,
        rows: (data ?? []) as unknown as PipelineLeadRow[],
      };
    })
  );

  const leadIds = stageResults.flatMap((entry) => entry.rows.map((row) => row.id));

  const [directory, primaryActions, slaClocks, stageEntries] = await Promise.all([
    context.canReadBroad ? fetchCrmAssigneeDirectory(context) : Promise.resolve([]),
    fetchPrimaryNextActions(leadIds),
    fetchSlaSignals(leadIds),
    fetchStageEntryInstants(leadIds),
  ]);

  const assigneeLabels = Object.fromEntries(
    directory.map((entry) => [entry.userId, entry.displayName])
  );

  const capturedAt = new Date().toISOString();
  const now = Date.parse(capturedAt);

  const columns: CrmPipelineStageColumn[] = stageResults.map((entry) => {
    const cards = entry.rows.map((row): CrmPipelineCard => {
      const primary = primaryActions[row.id] ?? null;
      const sla = slaClocks.signals[row.id] ?? null;
      const stageEnteredAt = stageEntries[row.id] ?? null;

      return {
        leadId: row.id,
        displayName: row.submitted_name,
        status: entry.stage as CrmPipelineBoardStage,
        serviceCode: row.service_code,
        locality: row.locality,
        sourceLabel: row.lead_sources?.display_name ?? "Unknown source",
        assigneeId: row.assigned_to,
        assigneeLabel: row.assigned_to
          ? assigneeLabels[row.assigned_to] ?? "Assigned staff"
          : "Unassigned",
        primaryNextActionTitle: primary?.title ?? null,
        primaryNextActionType: primary?.activityType ?? null,
        primaryNextActionDueAt: primary?.dueAt ?? null,
        slaBreached:
          sla?.slaDueAt != null &&
          sla.firstContactAttemptAt == null &&
          Date.parse(sla.slaDueAt) < now,
        newUncontacted:
          row.assigned_to != null && (sla?.firstContactAttemptAt ?? null) == null,
        stageEnteredAt: stageEnteredAt ?? row.created_at,
        stageEnteredSource: stageEnteredAt ? "event" : "created",
        createdAt: row.created_at,
      };
    });

    return {
      stage: entry.stage as CrmPipelineBoardStage,
      total: entry.total,
      cards: sortPipelineCards(cards, now),
      truncated: entry.total > entry.rows.length,
    };
  });

  return {
    columns,
    capturedAt,
    scopeOwnerId,
    isTeamScope: context.canReadBroad && scopeOwnerId === null,
    slaSignalAvailable: slaClocks.hasActiveSlaDue,
  };
}

interface PrimaryNextAction {
  readonly title: string;
  readonly activityType: string;
  readonly dueAt: string;
}

async function fetchPrimaryNextActions(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, PrimaryNextAction>>> {
  if (leadIds.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_follow_ups")
    .select("lead_id, title, activity_type, due_at")
    .in("lead_id", [...leadIds])
    .eq("status", "open")
    .eq("is_primary_next_action", true)
    .order("due_at", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const map: Record<string, PrimaryNextAction> = {};
  for (const row of data ?? []) {
    if (!map[row.lead_id]) {
      map[row.lead_id] = {
        title: row.title,
        activityType: row.activity_type,
        dueAt: row.due_at,
      };
    }
  }
  return map;
}

interface SlaSignal {
  readonly slaDueAt: string | null;
  readonly firstContactAttemptAt: string | null;
}

interface SlaSignalResult {
  readonly signals: Readonly<Record<string, SlaSignal>>;
  /** True only when at least one clock carries a real deadline. */
  readonly hasActiveSlaDue: boolean;
}

async function fetchSlaSignals(
  leadIds: readonly string[]
): Promise<SlaSignalResult> {
  if (leadIds.length === 0) {
    return { signals: {}, hasActiveSlaDue: false };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("crm_sla_clocks")
    .select("lead_id, sla_due_at, first_contact_attempt_at")
    .in("lead_id", [...leadIds]);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const signals: Record<string, SlaSignal> = {};
  let hasActiveSlaDue = false;
  for (const row of data ?? []) {
    signals[row.lead_id] = {
      slaDueAt: row.sla_due_at,
      firstContactAttemptAt: row.first_contact_attempt_at,
    };
    if (row.sla_due_at != null) {
      hasActiveSlaDue = true;
    }
  }

  return { signals, hasActiveSlaDue };
}

/**
 * Latest stage-entry event per lead, from a single bounded descending scan.
 * Leads whose events fall outside the scan window simply fall back to
 * `created_at`, which the card marks as `stageEnteredSource: "created"`.
 */
async function fetchStageEntryInstants(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, string>>> {
  if (leadIds.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_events")
    .select("lead_id, occurred_at")
    .in("lead_id", [...leadIds])
    .in("event_type", [...CRM_PIPELINE_STAGE_ENTRY_EVENT_TYPES])
    .order("occurred_at", { ascending: false })
    .limit(CRM_PIPELINE_STAGE_EVENT_SCAN_LIMIT);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const map: Record<string, string> = {};
  for (const row of data ?? []) {
    if (!map[row.lead_id]) {
      map[row.lead_id] = row.occurred_at;
    }
  }
  return map;
}
