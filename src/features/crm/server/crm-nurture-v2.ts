import "server-only";

import {
  crmNurtureStageLabel,
  isCrmNurtureTemporarilySuppressed,
  resolveCrmNurtureStage,
  type CrmNurtureStage,
} from "../contracts/nurture-v2";
import { resolveCrmDb, type CrmDb } from "./crm-db";
import { fetchLeadScoreBatch } from "./crm-lead-score-batch";
import { crmErrorFromPostgresMessage } from "./crm-errors";

export interface CrmNurtureV2Signal {
  readonly leadId: string;
  readonly stage: CrmNurtureStage;
  readonly stageLabel: string;
  readonly nurtureCount: number;
  readonly lastTemplateName: string | null;
  readonly lastNurtureAt: string | null;
  readonly nextNurtureAt: string | null;
  readonly reengagedAt: string | null;
  readonly suppressedUntil: string | null;
  readonly temporarilySuppressed: boolean;
  readonly lastMeaningfulActivityAt: string | null;
  readonly lastInboundAt: string | null;
}

export async function fetchCrmNurtureV2Signals(
  leadIds: readonly string[],
  db?: CrmDb
): Promise<Readonly<Record<string, CrmNurtureV2Signal>>> {
  if (leadIds.length === 0) return {};
  const supabase = await resolveCrmDb(db);
  const [rowsResult, scoreBatch] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, created_at, nurture_count, last_nurture_template_name, last_nurture_at, next_nurture_at, nurture_reengaged_at, nurture_suppressed_until"
      )
      .in("id", [...leadIds]),
    fetchLeadScoreBatch(leadIds, db),
  ]);

  if (rowsResult.error) {
    throw crmErrorFromPostgresMessage(rowsResult.error.message, "RPC_FAILED");
  }

  const output: Record<string, CrmNurtureV2Signal> = {};
  for (const row of rowsResult.data ?? []) {
    const engagement = scoreBatch.engagement[row.id];
    const whatsapp = scoreBatch.whatsapp[row.id];
    const stage = resolveCrmNurtureStage({
      createdAt: row.created_at,
      lastMeaningfulActivityAt: engagement?.lastMeaningfulActivityAt ?? null,
      lastInboundAt: whatsapp?.lastInboundAt ?? null,
      lastNurtureAt: row.last_nurture_at,
      reengagedAt: row.nurture_reengaged_at,
    });
    output[row.id] = {
      leadId: row.id,
      stage,
      stageLabel: crmNurtureStageLabel(stage),
      nurtureCount: row.nurture_count,
      lastTemplateName: row.last_nurture_template_name,
      lastNurtureAt: row.last_nurture_at,
      nextNurtureAt: row.next_nurture_at,
      reengagedAt: row.nurture_reengaged_at,
      suppressedUntil: row.nurture_suppressed_until,
      temporarilySuppressed: isCrmNurtureTemporarilySuppressed(
        row.nurture_suppressed_until
      ),
      lastMeaningfulActivityAt: engagement?.lastMeaningfulActivityAt ?? null,
      lastInboundAt: whatsapp?.lastInboundAt ?? null,
    };
  }
  return output;
}

export function countCrmNurtureStages(
  signals: Readonly<Record<string, CrmNurtureV2Signal>>
): Readonly<Record<CrmNurtureStage, number>> {
  const counts: Record<CrmNurtureStage, number> = {
    long_horizon: 0,
    dormant_30: 0,
    dormant_60: 0,
    dormant_90: 0,
    re_engaged: 0,
  };
  for (const signal of Object.values(signals)) {
    counts[signal.stage] += 1;
  }
  return counts;
}
