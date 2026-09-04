/**
 * CRM — the owner-facing SALES BUCKET.
 *
 * One presentation concept, DERIVED and never stored. What IS stored is the
 * human's manual temperature (hot/warm/cold) and its audit trail; the effective
 * bucket is resolved from it on every read. Storing the effective bucket would
 * let it drift from the lifecycle the instant a lead was closed or parked.
 *
 * Precedence, in order:
 *
 *   1. lifecycle override   closed_lost / closed_won / on_hold
 *   2. manual temperature   the salesperson's own judgement
 *   3. system score band    the advisory fallback
 *
 * The fallback matters: without it every unjudged lead would land in a seventh
 * "unclassified" bucket, and the monthly counts would stop describing the month.
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
  "WON",
  "ON_HOLD",
] as const;

export type CrmLeadSalesBucket = (typeof CRM_LEAD_SALES_BUCKETS)[number];

/** The four the owner reaches for most; rendered with the strongest emphasis. */
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
  WON: "Won",
  ON_HOLD: "On hold",
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
  WON: "Closed won.",
  ON_HOLD: "Parked by decision.",
};

/** URL token <-> bucket. Lowercase so the query string stays readable. */
export const CRM_LEAD_SALES_BUCKET_PARAMS: Readonly<
  Record<CrmLeadSalesBucket, string>
> = {
  HOT: "hot",
  WARM: "warm",
  COLD: "cold",
  LOST: "lost",
  WON: "won",
  ON_HOLD: "on_hold",
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
 * Lifecycle outcome beats human judgement, and human judgement beats the
 * machine:
 *
 * - A lost lead is LOST no matter how hot anyone marked it. Ranking it HOT would
 *   put dead work at the top of a queue that exists to say who to call next.
 * - A salesperson who marks a lead WARM outranks a score that says COLD. The
 *   score is advisory intelligence, not authority.
 * - With no human judgement, the score band decides, so nothing is ever
 *   unclassified.
 *
 * The manual temperature is NOT erased by a lifecycle override — it is only
 * outranked, so a lead resumed from hold returns to the temperature its owner
 * chose.
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
    return { bucket: "WON", source: "lifecycle" };
  }
  if (status === "on_hold") {
    return { bucket: "ON_HOLD", source: "lifecycle" };
  }

  if (manualTemperature !== null) {
    return { bucket: manualTemperature, source: "manual" };
  }

  if (band === "HOT") {
    return { bucket: "HOT", source: "system" };
  }
  if (band === "WARM") {
    return { bucket: "WARM", source: "system" };
  }
  // NURTURE and COLD both present as COLD. The distinction is preserved in the
  // score engine and remains visible in the score band chip.
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
  ON_HOLD: 3,
  WON: 4,
  LOST: 5,
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
    WON: 0,
    ON_HOLD: 0,
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
    WON: 0,
    ON_HOLD: 0,
    TOTAL: 0,
  };
  for (const bucket of buckets) {
    counts[bucket] += 1;
    counts.TOTAL += 1;
  }
  return counts;
}
