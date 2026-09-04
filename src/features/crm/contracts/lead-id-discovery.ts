/**
 * COMPLETE id discovery under the Data API row ceiling.
 *
 * `supabase/config.toml` sets `[api] max_rows = 1000`, so a bare
 * `.select("id")` returns AT MOST 1000 rows and gives no signal that more
 * existed. The lead-list prefilters used exactly that shape and then treated the
 * result as the authoritative match universe, so a text search or follow-up-due
 * filter matching more than 1000 rows silently dropped leads before the cohort
 * scan ever saw them. Those leads could then never reach the bucket counts, the
 * bucket filter, the ranking or the page — and the UI still presented the counts
 * as exact.
 *
 * The follow-up filter was worse: it returns follow-up ROWS and de-duplicates
 * `lead_id` afterwards, so 1000 rows can describe far fewer than 1000 leads
 * while later, entirely distinct leads are missing.
 *
 * This module is the paging contract. It is PURE — the caller injects a page
 * fetcher — so the behaviour that matters (does it read to exhaustion, does
 * de-duplication ever cost us a later page) is directly testable without a
 * Supabase client in scope.
 */

/**
 * The configured PostgREST ceiling. A discovery page must never ask for more
 * than this, because the API would silently trim the response.
 */
export const CRM_DATA_API_MAX_ROWS = 1000;

/** Rows requested per discovery page. MUST stay <= `CRM_DATA_API_MAX_ROWS`. */
export const CRM_ID_DISCOVERY_PAGE_SIZE = 1000;

/**
 * A generous stop so a pathological result set cannot spin forever. Reaching it
 * THROWS rather than returning a short list: a silently incomplete match set is
 * the exact defect this module exists to prevent.
 */
export const CRM_ID_DISCOVERY_MAX_PAGES = 500;

export class CrmIdDiscoveryOverflowError extends Error {
  constructor(pages: number) {
    super(
      `CRM_ID_DISCOVERY_OVERFLOW: filter matched more than ${
        pages * CRM_ID_DISCOVERY_PAGE_SIZE
      } rows; refusing to return a partial match set.`
    );
    this.name = "CrmIdDiscoveryOverflowError";
  }
}

/** Inclusive PostgREST range for a zero-based page index. */
export function idDiscoveryPageRange(
  pageIndex: number,
  pageSize: number = CRM_ID_DISCOVERY_PAGE_SIZE
): { readonly from: number; readonly to: number } {
  const from = pageIndex * pageSize;
  return { from, to: from + pageSize - 1 };
}

/**
 * Whether another page must be requested.
 *
 * Judged on ROWS RETURNED, never on how many NEW ids a page contributed. A page
 * of 1000 follow-up rows that all belong to one lead adds a single id, but it
 * still means the source has more to give — stopping there would drop every
 * later lead.
 */
export function shouldRequestNextIdPage(
  rowsInPage: number,
  pageSize: number = CRM_ID_DISCOVERY_PAGE_SIZE
): boolean {
  return rowsInPage >= pageSize;
}

/**
 * Reads every page of a deterministic id query and returns the de-duplicated
 * ids in first-seen order.
 *
 * `fetchPage` must apply a STABLE total order (a unique tie-break) before
 * ranging, or rows can be skipped or repeated between pages.
 */
export async function collectAllIds(
  fetchPage: (from: number, to: number) => Promise<readonly string[]>,
  options: {
    readonly pageSize?: number;
    readonly maxPages?: number;
  } = {}
): Promise<readonly string[]> {
  const pageSize = options.pageSize ?? CRM_ID_DISCOVERY_PAGE_SIZE;
  const maxPages = options.maxPages ?? CRM_ID_DISCOVERY_MAX_PAGES;

  if (pageSize > CRM_DATA_API_MAX_ROWS) {
    // Asking for more than the API returns would make every page look short and
    // stop discovery after the first one.
    throw new Error(
      `CRM_ID_DISCOVERY_PAGE_SIZE ${pageSize} exceeds the Data API max_rows ${CRM_DATA_API_MAX_ROWS}`
    );
  }

  const seen = new Set<string>();
  const ordered: string[] = [];

  for (let pageIndex = 0; pageIndex < maxPages; pageIndex += 1) {
    const { from, to } = idDiscoveryPageRange(pageIndex, pageSize);
    const rows = await fetchPage(from, to);

    for (const id of rows) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }

    if (!shouldRequestNextIdPage(rows.length, pageSize)) {
      return ordered;
    }
  }

  throw new CrmIdDiscoveryOverflowError(maxPages);
}

/** Union of several complete id sets, de-duplicated, order preserved. */
export function unionIds(
  ...sets: readonly (readonly string[])[]
): readonly string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const set of sets) {
    for (const id of set) {
      if (!seen.has(id)) {
        seen.add(id);
        ordered.push(id);
      }
    }
  }
  return ordered;
}
