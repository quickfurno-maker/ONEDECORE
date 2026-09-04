/**
 * The cohort-scan safety rule.
 *
 * Pure, and in `contracts/` rather than beside the scan, because "did we read
 * the whole month?" decides whether bucket counts may be shown as exact. That is
 * a correctness question about core sales numbers, so it deserves direct tests
 * that do not need a Supabase client in scope.
 *
 * BOTH scan paths use this — the range-paged unfiltered scan and the id-chunked
 * filtered scan. The ceiling was previously enforced only on the first, so a
 * broad `q` or `followUpDue` filter could pull an unbounded cohort into memory
 * and still report itself complete.
 */

/** Rows fetched per range page on the unfiltered scan. */
export const CRM_LEAD_COHORT_CHUNK_SIZE = 500;

/** The most rows one cohort scan will hold. */
export const CRM_LEAD_COHORT_MAX_ROWS = 5_000;

export type CohortScanVerdict = "continue" | "complete" | "truncated";

export interface CohortScanOptions {
  /**
   * The chunk size that signals "more may follow". A short chunk means the
   * source is exhausted, so the scan is COMPLETE.
   *
   * `null` on the id-chunked path: there, chunk sizes are dictated by the id
   * list rather than by how many rows exist, so a short chunk proves nothing and
   * the caller decides completeness when the id chunks run out.
   */
  readonly expectFullChunkOf: number | null;
  readonly maxRows: number;
}

/**
 * What to do after appending a chunk.
 *
 * Overflow is judged FIRST, and with a strict `>`:
 *
 * - `>` rather than `>=` so a cohort of exactly `maxRows` is complete. `>=`
 *   marked an exactly-full cohort as partial and needlessly suppressed counts
 *   that were in fact correct.
 * - first, because a final short chunk can be the one that carries the cohort
 *   past the ceiling; judging completeness first let 5001 rows report complete.
 */
export function cohortScanVerdict(
  totalRows: number,
  chunkRows: number,
  options: CohortScanOptions
): CohortScanVerdict {
  if (totalRows > options.maxRows) {
    return "truncated";
  }
  if (
    options.expectFullChunkOf !== null &&
    chunkRows < options.expectFullChunkOf
  ) {
    return "complete";
  }
  return "continue";
}

/** Never hand back more than the ceiling, even though one surplus row was read. */
export function trimCohortRows<T>(
  rows: readonly T[],
  maxRows: number = CRM_LEAD_COHORT_MAX_ROWS
): readonly T[] {
  return rows.length > maxRows ? rows.slice(0, maxRows) : rows;
}
