import "server-only";

import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import {
  CRM_PIPELINE_BOARD_STAGES,
  CRM_PIPELINE_STAGE_FETCH_LIMIT,
  sortPipelineCards,
  type CrmPipelineBoard,
  type CrmPipelineBoardStage,
  type CrmPipelineCard,
  type CrmPipelineStageColumn,
} from "../contracts/pipeline-contracts.ts";
import { deriveLeadScore } from "../contracts/lead-score-contracts.ts";
import { resolveEffectiveSalesBucket } from "../contracts/lead-sales-bucket.ts";
import { parseManualSalesTemperature } from "../contracts/lead-sales-temperature.ts";
import { latestIso } from "./crm-lead-score-signals.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { fetchCrmAssigneeDirectory } from "./crm-lead-queries.ts";
import { fetchCrmPipelineValueSummary } from "./crm-lead-commercial-queries.ts";
// The batched signal assembly is shared with the segmented Leads list, so a
// lead scores identically on both surfaces by construction rather than by two
// implementations happening to agree.
import {
  CRM_EMPTY_ENGAGEMENT,
  fetchDealValues,
  fetchEngagementSignals,
  fetchPrimaryNextActions,
  fetchSalesTouchSignals,
  fetchSlaSignals,
  fetchStageEntryInstants,
} from "./crm-lead-score-batch.ts";

const PIPELINE_LEAD_SELECT =
  "id, status, submitted_name, service_code, locality, assigned_to, manual_sales_temperature, created_at, lead_sources!leads_primary_source_id_fkey(display_name)";

interface PipelineLeadRow {
  readonly id: string;
  readonly status: string;
  readonly submitted_name: string;
  readonly service_code: string;
  readonly locality: string | null;
  readonly assigned_to: string | null;
  readonly manual_sales_temperature: string | null;
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
  options: FetchCrmPipelineOptions = {},
  db?: CrmDb
): Promise<CrmPipelineBoard> {
  const supabase = await resolveCrmDb(db);
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
    context.canReadBroad
      ? fetchCrmAssigneeDirectory(context, db)
      : Promise.resolve([]),
    fetchPrimaryNextActions(leadIds, db),
    fetchSlaSignals(leadIds, db),
    fetchStageEntryInstants(leadIds, db),
    fetchEngagementSignals(leadIds, db),
    fetchDealValues(leadIds, db),
    // Totals come from the full RLS-scoped set, never from the fetched head.
    fetchCrmPipelineValueSummary(scopeOwnerId, db),
    fetchSalesTouchSignals(leadIds, db),
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
      const signals = engagement[row.id] ?? CRM_EMPTY_ENGAGEMENT;
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

      // The SAME canonical resolver the list and the detail page call. A
      // second implementation here is exactly how the board and the list would
      // start disagreeing about a lead the salesperson has classified.
      const manualSalesTemperature = parseManualSalesTemperature(
        row.manual_sales_temperature
      );
      const effective = resolveEffectiveSalesBucket(
        entry.stage as LeadStageCode,
        score.band,
        manualSalesTemperature
      );

      return {
        leadId: row.id,
        displayName: row.submitted_name,
        salesBucket: effective.bucket,
        salesBucketSource: effective.source,
        manualSalesTemperature,
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
