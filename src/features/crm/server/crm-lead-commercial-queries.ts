import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  CRM_COMMERCIAL_STATES,
  EMPTY_PIPELINE_VALUE_SUMMARY,
  UNKNOWN_COMMERCIAL_STATE,
  type CrmCommercialState,
  type CrmLeadCommercialState,
  type CrmPipelineStageValue,
  type CrmPipelineValueSummary,
} from "../contracts/deal-value-contracts.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";

interface CommercialStatePayload {
  readonly state?: unknown;
  readonly quotationId?: unknown;
  readonly quotationNumber?: unknown;
  readonly versionNumber?: unknown;
  readonly taxableBasePaise?: unknown;
  readonly at?: unknown;
  readonly probabilityBasisPoints?: unknown;
}

function asCommercialState(value: unknown): CrmCommercialState {
  return (CRM_COMMERCIAL_STATES as readonly string[]).includes(String(value))
    ? (value as CrmCommercialState)
    : "unknown";
}

function asNullableNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Canonical commercial state + deal value for one lead.
 *
 * Delegates to `public.get_crm_lead_commercial_state`, which is the only path
 * able to distinguish an ISSUED quotation from a merely FINALIZED one:
 * `quotation_access_grants` carries no SELECT policy for `authenticated`, so
 * the live-grant check must happen inside the database.
 *
 * A denied or unreadable lead resolves to UNKNOWN rather than throwing, so a
 * missing quotations permission degrades the header instead of breaking the
 * page. `taxableBasePaise === null` means unknown and must never render as 0.
 */
export async function fetchLeadCommercialState(
  leadId: string
): Promise<CrmLeadCommercialState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_crm_lead_commercial_state", {
    p_lead_id: leadId,
  });

  if (error || data === null || typeof data !== "object") {
    return UNKNOWN_COMMERCIAL_STATE;
  }

  const payload = data as CommercialStatePayload;

  return {
    state: asCommercialState(payload.state),
    quotationId: asNullableString(payload.quotationId),
    quotationNumber: asNullableString(payload.quotationNumber),
    versionNumber: asNullableNumber(payload.versionNumber),
    taxableBasePaise: asNullableNumber(payload.taxableBasePaise),
    at: asNullableString(payload.at),
  };
}

interface StagePayload {
  readonly stage?: unknown;
  readonly leadCount?: unknown;
  readonly valuedLeadCount?: unknown;
  readonly dealValuePaise?: unknown;
  readonly weightedValuePaise?: unknown;
  readonly probabilityBasisPoints?: unknown;
}

interface SummaryPayload {
  readonly capturedAt?: unknown;
  readonly scopeOwnerId?: unknown;
  readonly isTeamScope?: unknown;
  readonly stages?: unknown;
  readonly activeLeadCount?: unknown;
  readonly activeValuedLeadCount?: unknown;
  readonly activeDealValuePaise?: unknown;
  readonly activeWeightedValuePaise?: unknown;
  readonly parkedLeadCount?: unknown;
  readonly parkedValuedLeadCount?: unknown;
  readonly parkedDealValuePaise?: unknown;
}

/**
 * Weighted pipeline aggregate over the FULL RLS-scoped lead set.
 *
 * The board fetches at most 30 cards per column, so totals must never be
 * derived from loaded cards. Probabilities come from the RPC payload — the
 * locked table is encoded once, in the migration, and echoed here.
 */
export async function fetchCrmPipelineValueSummary(
  ownerId: string | null
): Promise<CrmPipelineValueSummary> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_crm_pipeline_value_summary", {
    p_owner_id: ownerId,
  });

  if (error || data === null || typeof data !== "object") {
    return EMPTY_PIPELINE_VALUE_SUMMARY;
  }

  const payload = data as SummaryPayload;
  const rawStages = Array.isArray(payload.stages) ? payload.stages : [];

  const stages: CrmPipelineStageValue[] = rawStages.map((entry) => {
    const stage = entry as StagePayload;
    return {
      stage: String(stage.stage) as LeadStageCode,
      leadCount: asNullableNumber(stage.leadCount) ?? 0,
      valuedLeadCount: asNullableNumber(stage.valuedLeadCount) ?? 0,
      dealValuePaise: asNullableNumber(stage.dealValuePaise) ?? 0,
      weightedValuePaise: asNullableNumber(stage.weightedValuePaise) ?? 0,
      probabilityBasisPoints:
        asNullableNumber(stage.probabilityBasisPoints) ?? 0,
    };
  });

  return {
    capturedAt: asNullableString(payload.capturedAt) ?? new Date().toISOString(),
    scopeOwnerId: asNullableString(payload.scopeOwnerId),
    isTeamScope: payload.isTeamScope === true,
    stages,
    activeLeadCount: asNullableNumber(payload.activeLeadCount) ?? 0,
    activeValuedLeadCount: asNullableNumber(payload.activeValuedLeadCount) ?? 0,
    activeDealValuePaise: asNullableNumber(payload.activeDealValuePaise) ?? 0,
    activeWeightedValuePaise:
      asNullableNumber(payload.activeWeightedValuePaise) ?? 0,
    parkedLeadCount: asNullableNumber(payload.parkedLeadCount) ?? 0,
    parkedValuedLeadCount: asNullableNumber(payload.parkedValuedLeadCount) ?? 0,
    parkedDealValuePaise: asNullableNumber(payload.parkedDealValuePaise) ?? 0,
  };
}
