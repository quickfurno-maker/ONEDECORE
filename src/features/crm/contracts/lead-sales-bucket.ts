/**
 * CRM — the owner-facing SALES BUCKET.
 *
 * One presentation concept, DERIVED and never stored. What IS stored is the
 * human's manual temperature (hot/warm/cold) and its audit trail; the effective
 * bucket is resolved from it on every read. Storing the effective bucket would
 * let it drift from the lifecycle the instant a lead was closed or parked.
 *
 * Classification rule, in order:
 *
 *   1. closed_lost lifecycle -> LOST
 *   2. manual temperature    -> HOT / WARM / COLD
 *   3. no manual temperature -> COLD by default
 *
 * The system score remains useful intelligence, but it does not classify the
 * lead. Sales classification is deliberately human-owned and predictable.
 *
 * SALES BUCKET IS NOT PIPELINE STAGE. Stage is where the work has reached
 * (new -> assigned -> contacted -> qualified -> consultation -> proposal ->
 * negotiation -> won/lost). Bucket is how the owner organises selling effort.
 * Both are shown, side by side, and neither replaces the other.
 *
 * NURTURE lives ONLY inside the canonical score engine. The owner asked for a
 * simple HOT / WARM / COLD language, so NURTURE collapses into COLD here, at the
 * presentation layer — `lead-score-contracts.ts` keeps all four bands and none
 * of its thresholds move.
 *
 * NON-DISCRIMINATION: the bucket is a total function of (lifecycle status,
 * canonical score band). It never reads a name, email, phone, locality, budget
 * or any free text, because the score it consumes never does either.
 */

import type { CrmLeadScoreBand } from "./lead-score-contracts.ts";
import type {
  CrmManualSalesTemperature,
  CrmSalesBucketSource,
} from "./lead-sales-temperature.ts";
import type { LeadStageCode } from "./lead-stages.ts";

export const CRM_LEAD_SALES_BUCKETS = [
  "HOT",
  "WARM",
  "COLD",
  "LOST",
] as const;

export type CrmLeadSalesBucket = (typeof CRM_LEAD_SALES_BUCKETS)[number];

/** The complete owner-facing classification vocabulary. */
export const CRM_LEAD_PRIMARY_SALES_BUCKETS = [
  "HOT",
  "WARM",
  "COLD",
  "LOST",
] as const satisfies readonly CrmLeadSalesBucket[];

/** Buckets whose members are still being actively worked. */
export const CRM_LEAD_ACTIVE_SALES_BUCKETS = [
  "HOT",
  "WARM",
  "COLD",
] as const satisfies readonly CrmLeadSalesBucket[];

export const CRM_LEAD_SALES_BUCKET_LABELS: Readonly<
  Record<CrmLeadSalesBucket, string>
> = {
  HOT: "Hot",
  WARM: "Warm",
  COLD: "Cold",
  LOST: "Lost",
};

/**
 * What each bucket is FOR. Surfaced as tooltip/helper copy so the strip reads as
 * a set of queues rather than six unexplained words.
 */
export const CRM_LEAD_SALES_BUCKET_DESCRIPTIONS: Readonly<
  Record<CrmLeadSalesBucket, string>
> = {
  HOT: "Strongest operational queue — call these first.",
  WARM: "Nurture and convert.",
  COLD: "Lower intent — re-engagement.",
  LOST: "Closed lost. Terminal, and kept out of the active queues.",
};

/** URL token <-> bucket. Lowercase so the query string stays readable. */
export const CRM_LEAD_SALES_BUCKET_PARAMS: Readonly<
  Record<CrmLeadSalesBucket, string>
> = {
  HOT: "hot",
  WARM: "warm",
  COLD: "cold",
  LOST: "lost",
};

const PARAM_TO_BUCKET: Readonly<Record<string, CrmLeadSalesBucket>> =
  Object.fromEntries(
    CRM_LEAD_SALES_BUCKETS.map((bucket) => [
      CRM_LEAD_SALES_BUCKET_PARAMS[bucket],
      bucket,
    ])
  );

export function parseLeadSalesBucketParam(
  raw: string | undefined | null
): CrmLeadSalesBucket | null {
  if (!raw) {
    return null;
  }
  return PARAM_TO_BUCKET[raw.trim().toLowerCase()] ?? null;
}

export function leadSalesBucketParam(bucket: CrmLeadSalesBucket): string {
  return CRM_LEAD_SALES_BUCKET_PARAMS[bucket];
}

export interface CrmEffectiveSalesBucket {
  readonly bucket: CrmLeadSalesBucket;
  readonly source: CrmSalesBucketSource;
}

/**
 * THE canonical resolver. Every surface — lead list, pipeline, lead detail —
 * calls this one function, so the same inputs can never render as two different
 * buckets on two different pages.
 *
 * Lost is a governed lifecycle outcome, so a closed-lost lead is always LOST.
 * For every other lead the salesperson's manual HOT / WARM / COLD choice is the
 * authority. If nobody has classified the lead yet, it is COLD by default.
 *
 * The score band is intentionally ignored here. It remains visible as advisory
 * intelligence but can never silently promote or demote the sales classification.
 */
export function resolveEffectiveSalesBucket(
  status: LeadStageCode,
  band: CrmLeadScoreBand,
  manualTemperature: CrmManualSalesTemperature | null = null
): CrmEffectiveSalesBucket {
  if (status === "closed_lost") {
    return { bucket: "LOST", source: "lifecycle" };
  }
  if (status === "closed_won") {
    return { bucket: manualTemperature ?? "COLD", source: manualTemperature ? "manual" : "system" };
  }
  if (status === "on_hold") {
    return { bucket: manualTemperature ?? "COLD", source: manualTemperature ? "manual" : "system" };
  }

  if (manualTemperature !== null) {
    return { bucket: manualTemperature, source: "manual" };
  }

  // The score band is advisory only. An unclassified lead is always Cold.
  void band;
  return { bucket: "COLD", source: "system" };
}

/** The bucket alone, for callers that do not need to show its provenance. */
export function resolveLeadSalesBucket(
  status: LeadStageCode,
  band: CrmLeadScoreBand,
  manualTemperature: CrmManualSalesTemperature | null = null
): CrmLeadSalesBucket {
  return resolveEffectiveSalesBucket(status, band, manualTemperature).bucket;
}

/** True for the three buckets that carry live selling work. */
export function isActiveSalesBucket(bucket: CrmLeadSalesBucket): boolean {
  return (CRM_LEAD_ACTIVE_SALES_BUCKETS as readonly CrmLeadSalesBucket[]).includes(
    bucket
  );
}

/**
 * HOT before WARM before COLD, then the terminal/parked buckets. Used to order
 * the mixed ALL view; within a bucket the deterministic sales comparator takes
 * over.
 */
const BUCKET_ORDER: Readonly<Record<CrmLeadSalesBucket, number>> = {
  HOT: 0,
  WARM: 1,
  COLD: 2,
  LOST: 3,
};

export function leadSalesBucketRank(bucket: CrmLeadSalesBucket): number {
  return BUCKET_ORDER[bucket];
}

export type CrmLeadSalesBucketCounts = Readonly<
  Record<CrmLeadSalesBucket, number>
> & { readonly TOTAL: number };

export function emptySalesBucketCounts(): CrmLeadSalesBucketCounts {
  return {
    HOT: 0,
    WARM: 0,
    COLD: 0,
    LOST: 0,
    TOTAL: 0,
  };
}

/** Exact counts over a WHOLE cohort — never over one page of it. */
export function countSalesBuckets(
  buckets: readonly CrmLeadSalesBucket[]
): CrmLeadSalesBucketCounts {
  const counts = {
    HOT: 0,
    WARM: 0,
    COLD: 0,
    LOST: 0,
    TOTAL: 0,
  };
  for (const bucket of buckets) {
    counts[bucket] += 1;
    counts.TOTAL += 1;
  }
  return counts;
}
