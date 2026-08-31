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
import {
  deriveLeadScore,
  CRM_SCORE_MEANINGFUL_OUTCOME_CODES,
} from "../contracts/lead-score-contracts.ts";
import type { CrmCommercialState } from "../contracts/deal-value-contracts.ts";
import { CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES } from "../contracts/lead-timeline-contracts.ts";
import { latestIso } from "./crm-lead-score-signals.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { fetchCrmAssigneeDirectory } from "./crm-lead-queries.ts";
import { fetchCrmPipelineValueSummary } from "./crm-lead-commercial-queries.ts";

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

  const [
    directory,
    primaryActions,
    slaClocks,
    stageEntries,
    engagement,
    dealValues,
    valueSummary,
    salesTouches,
  ] = await Promise.all([
    context.canReadBroad ? fetchCrmAssigneeDirectory(context) : Promise.resolve([]),
    fetchPrimaryNextActions(leadIds),
    fetchSlaSignals(leadIds),
    fetchStageEntryInstants(leadIds),
    fetchEngagementSignals(leadIds),
    fetchDealValues(leadIds),
    // Totals come from the full RLS-scoped set, never from the fetched head.
    fetchCrmPipelineValueSummary(scopeOwnerId),
    fetchSalesTouchSignals(leadIds),
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
      const signals = engagement[row.id] ?? EMPTY_ENGAGEMENT;
      const deal = dealValues[row.id] ?? null;
      const touch = salesTouches[row.id] ?? null;

      // Same pure derivation the lead detail page uses, from the same signal
      // shape, so a lead can never score differently on the two surfaces.
      const score = deriveLeadScore(
        {
          status: entry.stage as LeadStageCode,
          isAssigned: row.assigned_to !== null,
          hasFirstContactAttempt: (sla?.firstContactAttemptAt ?? null) !== null,
          hasMeaningfulOutcome: signals.hasMeaningfulOutcome,
          hasConsultationOrSiteVisit: signals.hasConsultationOrSiteVisit,
          commercialState: deal?.state ?? "unknown",
          lastMeaningfulActivityAt: signals.lastMeaningfulActivityAt,
          latestMeaningfulSalesTouchAt: latestIso([
            signals.lastMeaningfulActivityAt,
            touch?.latestNoteAt ?? null,
            touch?.latestQuotationEventAt ?? null,
          ]),
          receivedAt: row.created_at,
          hasOpenPrimaryNextAction: primary !== null,
          primaryNextActionDueAt: primary?.dueAt ?? null,
          slaDueAt: sla?.slaDueAt ?? null,
        },
        now
      );

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
        score,
        dealValuePaise: deal?.taxableBasePaise ?? null,
        commercialState: deal?.state ?? "unknown",
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
    valueSummary,
  };
}

/* -------------------------------------------------------------------------- */
/* CRM 2D enrichment — batched, never per card                                 */
/* -------------------------------------------------------------------------- */

interface EngagementSignal {
  readonly hasMeaningfulOutcome: boolean;
  readonly hasConsultationOrSiteVisit: boolean;
  readonly lastMeaningfulActivityAt: string | null;
}

const EMPTY_ENGAGEMENT: EngagementSignal = {
  hasMeaningfulOutcome: false,
  hasConsultationOrSiteVisit: false,
  lastMeaningfulActivityAt: null,
};

const MEANINGFUL_OUTCOME_CODES: readonly string[] =
  CRM_SCORE_MEANINGFUL_OUTCOME_CODES;

/**
 * One batched read of the activity facts the score needs. Mirrors
 * `buildLeadScoreSignalsFromDetail` exactly so both surfaces agree.
 */
async function fetchEngagementSignals(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, EngagementSignal>>> {
  if (leadIds.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("lead_follow_ups")
    .select("lead_id, activity_type, status, outcome_code, completed_at")
    .in("lead_id", [...leadIds]);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const map: Record<string, EngagementSignal> = {};

  for (const row of data ?? []) {
    const current = map[row.lead_id] ?? EMPTY_ENGAGEMENT;

    const hasMeaningfulOutcome =
      current.hasMeaningfulOutcome ||
      (row.status === "completed" &&
        row.outcome_code !== null &&
        MEANINGFUL_OUTCOME_CODES.includes(row.outcome_code));

    const hasConsultationOrSiteVisit =
      current.hasConsultationOrSiteVisit ||
      ((row.activity_type === "consultation" ||
        row.activity_type === "site_visit") &&
        row.status !== "cancelled");

    let lastMeaningfulActivityAt = current.lastMeaningfulActivityAt;
    if (
      row.status === "completed" &&
      row.activity_type !== "internal_task" &&
      row.completed_at !== null &&
      (lastMeaningfulActivityAt === null ||
        Date.parse(row.completed_at) > Date.parse(lastMeaningfulActivityAt))
    ) {
      lastMeaningfulActivityAt = row.completed_at;
    }

    map[row.lead_id] = {
      hasMeaningfulOutcome,
      hasConsultationOrSiteVisit,
      lastMeaningfulActivityAt,
    };
  }

  return map;
}

interface DealValueSignal {
  readonly state: CrmCommercialState;
  readonly taxableBasePaise: number | null;
}

/**
 * Per-card deal value. Uses the same canonical resolver as the aggregate, so a
 * card's value and its column total can never disagree.
 */
async function fetchDealValues(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, DealValueSignal>>> {
  if (leadIds.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_crm_lead_deal_values", {
    p_lead_ids: [...leadIds],
  });

  if (error || !Array.isArray(data)) {
    // Deal value is additive: a denied or unavailable read degrades the card to
    // "value unknown" rather than breaking the board.
    return {};
  }

  const map: Record<string, DealValueSignal> = {};
  for (const row of data as readonly {
    readonly lead_id: string;
    readonly commercial_state: string;
    readonly taxable_base_paise: number | null;
  }[]) {
    map[row.lead_id] = {
      state: row.commercial_state as CrmCommercialState,
      taxableBasePaise:
        row.taxable_base_paise === null ? null : Number(row.taxable_base_paise),
    };
  }
  return map;
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

interface SalesTouchSignal {
  readonly latestNoteAt: string | null;
  readonly latestQuotationEventAt: string | null;
}

/**
 * Batched STALE inputs: the most recent lead note and the most recent
 * client-visible quotation event per lead. Uses the same event allowlist the
 * unified timeline uses, so both surfaces agree on what counts as a touch.
 * Both tables carry a (lead_id, <ts> desc) index.
 */
async function fetchSalesTouchSignals(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, SalesTouchSignal>>> {
  if (leadIds.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const [notesResult, quotationEventsResult] = await Promise.all([
    supabase
      .from("lead_notes")
      .select("lead_id, created_at")
      .in("lead_id", [...leadIds])
      .order("created_at", { ascending: false }),
    supabase
      .from("quotation_events")
      .select("lead_id, occurred_at")
      .in("lead_id", [...leadIds])
      .in("event_type", [...CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES])
      .order("occurred_at", { ascending: false }),
  ]);

  if (notesResult.error) {
    throw crmErrorFromPostgresMessage(notesResult.error.message, "RPC_FAILED");
  }
  // Quotation visibility is permission-scoped; an unreadable set simply yields
  // no touch rather than breaking the board.
  const quotationRows = quotationEventsResult.error
    ? []
    : quotationEventsResult.data ?? [];

  const map: Record<string, { latestNoteAt: string | null; latestQuotationEventAt: string | null }> = {};
  const ensure = (leadId: string) => {
    map[leadId] ??= { latestNoteAt: null, latestQuotationEventAt: null };
    return map[leadId]!;
  };

  // Both reads are ordered descending, so the first row per lead is the max.
  for (const row of notesResult.data ?? []) {
    const entry = ensure(row.lead_id);
    if (entry.latestNoteAt === null) {
      entry.latestNoteAt = row.created_at;
    }
  }
  for (const row of quotationRows) {
    const entry = ensure(row.lead_id);
    if (entry.latestQuotationEventAt === null) {
      entry.latestQuotationEventAt = row.occurred_at;
    }
  }

  return map;
}
