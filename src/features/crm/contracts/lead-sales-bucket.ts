/**
 * CRM — the owner-facing SALES BUCKET.
 *
 * One presentation concept, derived and never stored. There is deliberately no
 * manual temperature column: a rep-controlled HOT/WARM/COLD goes stale, can be
 * gamed, and would contradict the deterministic score. A future owner-authorized
 * override needs actor + reason + timestamp + expiry + audit and is out of scope.
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

/**
 * THE canonical resolver. Every surface — lead list, pipeline, lead detail —
 * calls this one function, so the same (status, band) can never render as two
 * different buckets on two different pages.
 *
 * Lifecycle outcome beats temperature: a lost lead is LOST no matter how hot it
 * once scored. Ranking it as HOT would put dead work at the top of a queue that
 * exists to tell a salesperson who to call next.
 */
export function resolveLeadSalesBucket(
  status: LeadStageCode,
  band: CrmLeadScoreBand
): CrmLeadSalesBucket {
  if (status === "closed_lost") {
    return "LOST";
  }
  if (status === "closed_won") {
    return "WON";
  }
  if (status === "on_hold") {
    return "ON_HOLD";
  }

  if (band === "HOT") {
    return "HOT";
  }
  if (band === "WARM") {
    return "WARM";
  }
  // NURTURE and COLD both present as COLD. The distinction is preserved in the
  // score engine and remains visible in the score band chip.
  return "COLD";
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
