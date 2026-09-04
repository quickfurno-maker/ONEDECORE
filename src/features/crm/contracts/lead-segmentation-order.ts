/**
 * CRM — deterministic ordering for the segmented Leads workspace.
 *
 * The list used to sort by `updated_at`, which answers "what did someone touch
 * most recently", not "who should sales call next". Editing a note on a dead
 * lead pushed it to the top. This comparator answers the selling question and is
 * a TOTAL order: every comparison ends in a stable lead-id tie break, so the
 * same cohort always paginates identically.
 *
 * Urgency policy is REUSED from `pipeline-contracts.ts` rather than restated —
 * two copies of an urgency ladder is two places for it to drift.
 */

import {
  isActiveSalesBucket,
  leadSalesBucketRank,
  type CrmLeadSalesBucket,
} from "./lead-sales-bucket.ts";
import {
  pipelineUrgencyRank,
  resolvePipelineUrgency,
} from "./pipeline-contracts.ts";

/** The minimum a row must expose to be ordered. */
export interface CrmSortableLead {
  readonly id: string;
  readonly salesBucket: CrmLeadSalesBucket;
  readonly priorityScore: number;
  /**
   * The CANONICAL primary next action only.
   *
   * A generic "next open follow-up" used to be fed in here as if it were the
   * primary action, so a lead with no primary action but an unrelated open
   * activity escaped the `no_next_action` urgency rank.
   */
  readonly primaryNextActionDueAt: string | null;
  readonly slaBreached: boolean;
  readonly newUncontacted: boolean;
  readonly createdAt: string;
  readonly stageEnteredAt: string;
}

function parseMs(value: string | null, fallback: number): number {
  if (value === null) {
    return fallback;
  }
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? fallback : ms;
}

/**
 * Terminal and parked buckets are ordered by their canonical stage-entry instant,
 * newest first — the most recently lost lead is the one worth reviewing.
 *
 * When no stage-entry event exists the row falls back to `stageEnteredAt`, which
 * the read model already defaults to `created_at`. That keeps the order total and
 * defined rather than throwing a lead to an arbitrary position.
 */
function compareTerminal(left: CrmSortableLead, right: CrmSortableLead): number {
  const leftMs = parseMs(left.stageEnteredAt, parseMs(left.createdAt, 0));
  const rightMs = parseMs(right.stageEnteredAt, parseMs(right.createdAt, 0));
  if (leftMs !== rightMs) {
    return rightMs - leftMs;
  }
  return left.id.localeCompare(right.id);
}

/**
 * Active ordering: score first, then urgency, then the soonest next action, then
 * the oldest lead. Score leads because the owner's question is "who is most
 * likely to close"; urgency breaks ties so an SLA breach outranks a calm lead of
 * identical score.
 */
function compareActive(
  left: CrmSortableLead,
  right: CrmSortableLead,
  now: number
): number {
  if (left.priorityScore !== right.priorityScore) {
    return right.priorityScore - left.priorityScore;
  }

  const urgencyDelta =
    pipelineUrgencyRank(
      resolvePipelineUrgency(
        {
          slaBreached: left.slaBreached,
          primaryNextActionDueAt: left.primaryNextActionDueAt,
          newUncontacted: left.newUncontacted,
        },
        now
      )
    ) -
    pipelineUrgencyRank(
      resolvePipelineUrgency(
        {
          slaBreached: right.slaBreached,
          primaryNextActionDueAt: right.primaryNextActionDueAt,
          newUncontacted: right.newUncontacted,
        },
        now
      )
    );
  if (urgencyDelta !== 0) {
    return urgencyDelta;
  }

  const leftDue = parseMs(left.primaryNextActionDueAt, Number.POSITIVE_INFINITY);
  const rightDue = parseMs(right.primaryNextActionDueAt, Number.POSITIVE_INFINITY);
  if (leftDue !== rightDue) {
    return leftDue < rightDue ? -1 : 1;
  }

  // Older received lead first: it has been waiting longest.
  const createdDelta =
    parseMs(left.createdAt, 0) - parseMs(right.createdAt, 0);
  if (createdDelta !== 0) {
    return createdDelta;
  }

  return left.id.localeCompare(right.id);
}

/**
 * Total order across a mixed cohort.
 *
 * Active work outranks terminal/parked work in the ALL view, so LOST never
 * pollutes the top of a conversion queue. Within the active set the buckets stay
 * grouped HOT -> WARM -> COLD, which is what makes the strip's promise ("HOT is
 * the strongest operational queue") true of the default listing too.
 */
export function compareSegmentedLeads(
  left: CrmSortableLead,
  right: CrmSortableLead,
  now: number = Date.now()
): number {
  const leftActive = isActiveSalesBucket(left.salesBucket);
  const rightActive = isActiveSalesBucket(right.salesBucket);

  if (leftActive !== rightActive) {
    return leftActive ? -1 : 1;
  }

  const bucketDelta =
    leadSalesBucketRank(left.salesBucket) - leadSalesBucketRank(right.salesBucket);
  if (bucketDelta !== 0) {
    return bucketDelta;
  }

  return leftActive
    ? compareActive(left, right, now)
    : compareTerminal(left, right);
}

export function sortSegmentedLeads<T extends CrmSortableLead>(
  leads: readonly T[],
  now: number = Date.now()
): readonly T[] {
  return [...leads].sort((left, right) => compareSegmentedLeads(left, right, now));
}
