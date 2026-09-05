/**
 * The Lead Detail payload the Owner mobile app receives.
 *
 * It is the CANONICAL `CrmLeadDetail` — the exact model the web lead page
 * renders — plus one derived array the web computes at render time and a native
 * client cannot reach.
 *
 * WHY THE EXTRA ARRAY EXISTS. The repository reads `lead_follow_ups` ordered
 * `due_at asc`, which is correct for the OPEN queue and wrong for history: due
 * time is when work was PLANNED, not when the conversation happened. The web
 * corrects that inside `ActivityHistoryList`, which also resolves the real
 * occurrence instant, the real actor and the human outcome. None of that is
 * reachable from Android, and reimplementing the comparator or the occurrence
 * rule there would fork the semantics `lead-activity-history.ts` owns.
 *
 * So the SAME helpers compose the ordered log once, on the server. The phone
 * renders what it is given and formats dates; it does not sort, does not pick
 * an actor and does not decide what a client-facing activity is.
 *
 * `followUps` is carried through UNCHANGED beside it. It is still the plan —
 * the open-activity queue reads it in its own order — and the history is still
 * a read interpretation of the same rows, not a second store.
 */

import {
  buildConversationActivityHistory,
  type CrmConversationActivityEntry,
} from "./lead-activity-history.ts";
import type { CrmLeadDetail } from "./lead-detail-dtos.ts";

export interface CrmMobileLeadDetail extends CrmLeadDetail {
  /**
   * Finished activities only, ordered by ACTUAL occurrence DESC with a stable
   * id tie-break, each already carrying its label, outcome, occurrence instant
   * and real actor.
   */
  readonly conversationHistory: readonly CrmConversationActivityEntry[];
}

export function toMobileLeadDetail(
  detail: CrmLeadDetail
): CrmMobileLeadDetail {
  return {
    ...detail,
    conversationHistory: buildConversationActivityHistory(detail.followUps),
  };
}
