/**
 * Received order for the Leads workspace: newest enquiry first.
 *
 * WHY THIS EXISTS BESIDE `lead-segmentation-order.ts`
 *
 * The CRM has two different products that both list leads, and they answer
 * two different questions:
 *
 *   /admin/crm/leads     "what has come in?"      -> this file
 *   /admin/crm/pipeline  "what should I work?"    -> sortPipelineCards
 *
 * The Leads page inherited the sales-priority comparator, so a fresh enquiry
 * could land below week-old HOT leads simply because they scored higher. That
 * is correct behaviour for a work queue and wrong for an inbox: the owner
 * opens this page to see what just arrived, and an inbox that hides the newest
 * item is not an inbox.
 *
 * `lead-segmentation-order.ts` is deliberately left intact. Priority ranking is
 * still the right answer for the pipeline, and deleting it to make this page
 * behave would have taken the other product with it.
 *
 * THE ORDER IS RECEIPT, AND ONLY RECEIPT
 *
 * `createdAt` DESC, then `id` DESC. Nothing else participates — not
 * `updatedAt`, not `stageEnteredAt`, not score, bucket, urgency, SLA or manual
 * temperature. Every one of those changes after a lead arrives, and a list
 * ordered by "when we received it" must not reshuffle because somebody edited
 * a note or a clock ticked past a due date.
 */

/** The two fields receipt order is allowed to read. Nothing else belongs here. */
export interface CrmReceivedOrderLead {
  readonly id: string;
  readonly createdAt: string;
}

/**
 * Timestamps arrive as strings from PostgREST and can differ in shape between
 * transports, so they are compared as instants rather than as text. An
 * unparseable value falls back to a string comparison instead of poisoning the
 * sort with `NaN`, which would make the whole order non-deterministic.
 */
function receivedAtValue(iso: string): number {
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? Number.NaN : parsed;
}

/**
 * Newest received first, with a deterministic tie-break.
 *
 * The `id` tie-break is not decoration. Bulk imports write hundreds of rows
 * inside one transaction and they share `created_at` to the microsecond; with
 * no second key their relative order would depend on whatever the engine's
 * sort happened to do, and page 2 could repeat or drop rows that page 1
 * already showed.
 */
export function compareLeadsByReceivedNewestFirst(
  left: CrmReceivedOrderLead,
  right: CrmReceivedOrderLead
): number {
  const leftAt = receivedAtValue(left.createdAt);
  const rightAt = receivedAtValue(right.createdAt);

  if (Number.isNaN(leftAt) || Number.isNaN(rightAt)) {
    const byText = right.createdAt.localeCompare(left.createdAt);
    if (byText !== 0) {
      return byText;
    }
  } else if (leftAt !== rightAt) {
    return rightAt - leftAt;
  }

  return right.id.localeCompare(left.id);
}

/** Total receipt order over a cohort. Pure; never mutates the input. */
export function sortLeadsByReceivedNewestFirst<T extends CrmReceivedOrderLead>(
  leads: readonly T[]
): readonly T[] {
  return [...leads].sort(compareLeadsByReceivedNewestFirst);
}
