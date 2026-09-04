import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmCommercialState } from "../contracts/deal-value-contracts.ts";
import { CRM_SCORE_MEANINGFUL_OUTCOME_CODES } from "../contracts/lead-score-contracts.ts";
import { CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES } from "../contracts/lead-timeline-contracts.ts";
import {
  CRM_PIPELINE_STAGE_ENTRY_EVENT_TYPES,
  CRM_PIPELINE_STAGE_EVENT_SCAN_LIMIT,
} from "../contracts/pipeline-contracts.ts";
import {
  CRM_LEAD_ID_CHUNK_SIZE,
  chunkLeadIds,
} from "../contracts/lead-batch-chunking.ts";
import {
  resolveSiteVisitState,
  type CrmSiteVisitState,
} from "../contracts/lead-milestones.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

export { CRM_LEAD_ID_CHUNK_SIZE, chunkLeadIds };

/**
 * ONE batched assembly of the signals `deriveLeadScore` needs.
 *
 * Extracted from the pipeline board so the Leads list and the board read the
 * SAME facts through the SAME queries. Previously only the board could score in
 * bulk, so giving the list a score meant either N+1 reads or a second, drifting
 * copy of the signal rules.
 *
 * Every function here is batched by lead id and CHUNKED: none of them issues a
 * query per lead, and none of them sends an unbounded `.in(...)` list that
 * Postgres or the PostgREST URL length would reject. The request count grows
 * with the number of chunks, not with the number of leads — bounded, not
 * constant.
 *
 * These reads run under the CALLER'S RLS. There is no service-role shortcut, so
 * a signal the user cannot read simply does not contribute — a scoped user can
 * never be shown facts about leads they cannot see.
 */

const MEANINGFUL_OUTCOME_CODES: readonly string[] =
  CRM_SCORE_MEANINGFUL_OUTCOME_CODES;

export interface CrmEngagementSignal {
  readonly hasMeaningfulOutcome: boolean;
  readonly hasConsultationOrSiteVisit: boolean;
  readonly lastMeaningfulActivityAt: string | null;
}

export const CRM_EMPTY_ENGAGEMENT: CrmEngagementSignal = {
  hasMeaningfulOutcome: false,
  hasConsultationOrSiteVisit: false,
  lastMeaningfulActivityAt: null,
};

export interface CrmDealValueSignal {
  readonly state: CrmCommercialState;
  readonly taxableBasePaise: number | null;
}

export interface CrmPrimaryNextAction {
  readonly title: string;
  readonly activityType: string;
  readonly dueAt: string;
}

export interface CrmSlaSignal {
  readonly slaDueAt: string | null;
  readonly firstContactAttemptAt: string | null;
}

export interface CrmSlaSignalResult {
  readonly signals: Readonly<Record<string, CrmSlaSignal>>;
  /** True only when at least one clock carries a real deadline. */
  readonly hasActiveSlaDue: boolean;
}

export interface CrmSalesTouchSignal {
  readonly latestNoteAt: string | null;
  readonly latestQuotationEventAt: string | null;
}

/**
 * The SITE VISIT milestone, batched.
 *
 * Read only from `activity_type = 'site_visit'` rows and only through the
 * canonical open/completed/cancelled status vocabulary. It is never inferred
 * from the `consultation_scheduled` pipeline stage — that is a different fact,
 * and using it here would turn one milestone into a proxy for another.
 */
export async function fetchSiteVisitSignals(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, CrmSiteVisitState>>> {
  const chunks = chunkLeadIds(leadIds);
  if (chunks.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const tally: Record<
    string,
    { completed: number; open: number; cancelled: number }
  > = {};

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("lead_follow_ups")
      .select("lead_id, status")
      .in("lead_id", [...chunk])
      .eq("activity_type", "site_visit");

    if (error) {
      throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }

    for (const row of data ?? []) {
      const entry = (tally[row.lead_id] ??= {
        completed: 0,
        open: 0,
        cancelled: 0,
      });
      if (row.status === "completed") {
        entry.completed += 1;
      } else if (row.status === "open") {
        entry.open += 1;
      } else if (row.status === "cancelled") {
        entry.cancelled += 1;
      }
    }
  }

  const map: Record<string, CrmSiteVisitState> = {};
  for (const [leadId, counts] of Object.entries(tally)) {
    map[leadId] = resolveSiteVisitState(counts);
  }
  return map;
}

/**
 * One batched read of the activity facts the score needs. Mirrors
 * `buildLeadScoreSignalsFromDetail` exactly so all surfaces agree.
 */
export async function fetchEngagementSignals(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, CrmEngagementSignal>>> {
  const chunks = chunkLeadIds(leadIds);
  if (chunks.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const map: Record<string, CrmEngagementSignal> = {};

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("lead_follow_ups")
      .select("lead_id, activity_type, status, outcome_code, completed_at")
      .in("lead_id", [...chunk]);

    if (error) {
      throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }

    for (const row of data ?? []) {
      const current = map[row.lead_id] ?? CRM_EMPTY_ENGAGEMENT;

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
  }

  return map;
}

/**
 * Per-lead deal value. Uses the same canonical resolver as the aggregate, so a
 * row's value and its column total can never disagree.
 */
export async function fetchDealValues(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, CrmDealValueSignal>>> {
  const chunks = chunkLeadIds(leadIds);
  if (chunks.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const map: Record<string, CrmDealValueSignal> = {};

  for (const chunk of chunks) {
    const { data, error } = await supabase.rpc("get_crm_lead_deal_values", {
      p_lead_ids: [...chunk],
    });

    if (error || !Array.isArray(data)) {
      // Deal value is additive: a denied or unavailable read degrades the row to
      // "value unknown" rather than breaking the workspace.
      continue;
    }

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
  }

  return map;
}

export async function fetchPrimaryNextActions(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, CrmPrimaryNextAction>>> {
  const chunks = chunkLeadIds(leadIds);
  if (chunks.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const map: Record<string, CrmPrimaryNextAction> = {};

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("lead_follow_ups")
      .select("lead_id, title, activity_type, due_at")
      .in("lead_id", [...chunk])
      .eq("status", "open")
      .eq("is_primary_next_action", true)
      .order("due_at", { ascending: true });

    if (error) {
      throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }

    for (const row of data ?? []) {
      if (!map[row.lead_id]) {
        map[row.lead_id] = {
          title: row.title,
          activityType: row.activity_type,
          dueAt: row.due_at,
        };
      }
    }
  }

  return map;
}

export async function fetchSlaSignals(
  leadIds: readonly string[]
): Promise<CrmSlaSignalResult> {
  const chunks = chunkLeadIds(leadIds);
  if (chunks.length === 0) {
    return { signals: {}, hasActiveSlaDue: false };
  }

  const supabase = await createClient();
  const signals: Record<string, CrmSlaSignal> = {};
  let hasActiveSlaDue = false;

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("crm_sla_clocks")
      .select("lead_id, sla_due_at, first_contact_attempt_at")
      .in("lead_id", [...chunk]);

    if (error) {
      throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }

    for (const row of data ?? []) {
      signals[row.lead_id] = {
        slaDueAt: row.sla_due_at,
        firstContactAttemptAt: row.first_contact_attempt_at,
      };
      if (row.sla_due_at != null) {
        hasActiveSlaDue = true;
      }
    }
  }

  return { signals, hasActiveSlaDue };
}

/**
 * Latest stage-entry event per lead, from one bounded descending scan per chunk.
 * Leads whose events fall outside the scan window fall back to `created_at`,
 * which callers report as `stageEnteredSource: "created"`.
 */
export async function fetchStageEntryInstants(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, string>>> {
  const chunks = chunkLeadIds(leadIds);
  if (chunks.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const map: Record<string, string> = {};

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("lead_events")
      .select("lead_id, occurred_at")
      .in("lead_id", [...chunk])
      .in("event_type", [...CRM_PIPELINE_STAGE_ENTRY_EVENT_TYPES])
      .order("occurred_at", { ascending: false })
      .limit(CRM_PIPELINE_STAGE_EVENT_SCAN_LIMIT);

    if (error) {
      throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
    }

    for (const row of data ?? []) {
      if (!map[row.lead_id]) {
        map[row.lead_id] = row.occurred_at;
      }
    }
  }

  return map;
}

/**
 * Batched STALE inputs: the most recent lead note and the most recent
 * client-visible quotation event per lead. Uses the same event allowlist the
 * unified timeline uses, so all surfaces agree on what counts as a touch.
 * Both tables carry a (lead_id, <ts> desc) index.
 */
export async function fetchSalesTouchSignals(
  leadIds: readonly string[]
): Promise<Readonly<Record<string, CrmSalesTouchSignal>>> {
  const chunks = chunkLeadIds(leadIds);
  if (chunks.length === 0) {
    return {};
  }

  const supabase = await createClient();
  const map: Record<
    string,
    { latestNoteAt: string | null; latestQuotationEventAt: string | null }
  > = {};
  const ensure = (leadId: string) => {
    map[leadId] ??= { latestNoteAt: null, latestQuotationEventAt: null };
    return map[leadId]!;
  };

  for (const chunk of chunks) {
    const [notesResult, quotationEventsResult] = await Promise.all([
      supabase
        .from("lead_notes")
        .select("lead_id, created_at")
        .in("lead_id", [...chunk])
        .order("created_at", { ascending: false }),
      supabase
        .from("quotation_events")
        .select("lead_id, occurred_at")
        .in("lead_id", [...chunk])
        .in("event_type", [...CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES])
        .order("occurred_at", { ascending: false }),
    ]);

    if (notesResult.error) {
      throw crmErrorFromPostgresMessage(notesResult.error.message, "RPC_FAILED");
    }
    // Quotation visibility is permission-scoped; an unreadable set simply yields
    // no touch rather than breaking the workspace.
    const quotationRows = quotationEventsResult.error
      ? []
      : quotationEventsResult.data ?? [];

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
  }

  return map;
}

export interface CrmLeadScoreBatch {
  readonly primaryActions: Readonly<Record<string, CrmPrimaryNextAction>>;
  readonly slaClocks: CrmSlaSignalResult;
  readonly stageEntries: Readonly<Record<string, string>>;
  readonly engagement: Readonly<Record<string, CrmEngagementSignal>>;
  readonly dealValues: Readonly<Record<string, CrmDealValueSignal>>;
  readonly salesTouches: Readonly<Record<string, CrmSalesTouchSignal>>;
  readonly siteVisits: Readonly<Record<string, CrmSiteVisitState>>;
}

/**
 * Everything the score and the milestone columns need for a set of leads.
 *
 * A FIXED NUMBER OF QUERY GROUPS, each of which chunks its own lead-id list.
 * That is bounded and free of per-lead N+1 reads, but it is NOT a constant
 * number of database requests: a cohort larger than one chunk issues one
 * request per chunk per group, by design.
 */
export async function fetchLeadScoreBatch(
  leadIds: readonly string[]
): Promise<CrmLeadScoreBatch> {
  const [
    primaryActions,
    slaClocks,
    stageEntries,
    engagement,
    dealValues,
    salesTouches,
    siteVisits,
  ] = await Promise.all([
    fetchPrimaryNextActions(leadIds),
    fetchSlaSignals(leadIds),
    fetchStageEntryInstants(leadIds),
    fetchEngagementSignals(leadIds),
    fetchDealValues(leadIds),
    fetchSalesTouchSignals(leadIds),
    fetchSiteVisitSignals(leadIds),
  ]);

  return {
    primaryActions,
    slaClocks,
    stageEntries,
    engagement,
    dealValues,
    salesTouches,
    siteVisits,
  };
}
