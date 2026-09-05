import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import {
  CRM_CALENDAR_VIEWS,
  isCalendarLocalDate,
  parseCalendarAnchorDate,
  parseCalendarView,
} from "@/features/crm/contracts/calendar-contracts.ts";
import { parseMyDayOwnerFilter } from "@/features/crm/contracts/my-day-contracts.ts";
import { fetchCrmCalendarSnapshot } from "@/features/crm/server/crm-calendar-queries.ts";

/**
 * The Owner mobile app's CRM calendar.
 *
 * A calendar looks like the most reproducible screen in the product and is the
 * least. Three separate facts behind it are server-owned, and a phone that
 * recomputed any of them would be right most days and quietly wrong on the ones
 * that matter:
 *
 *   the range        `resolveCalendarRange` owns the Monday-start week, the
 *                    month grid's overshoot to whole weeks, the fixed +05:30
 *                    Asia/Kolkata day index and the half-open `[start, end)`
 *                    bound. A phone off by one day at either edge would also be
 *                    wrong about whether the 400 ceiling was reached.
 *   the scope        `context.canReadBroad` decides whether a caller may look at
 *                    another owner's commitments or only their own. RLS bounds
 *                    the rows either way, but RLS is wider than this: it admits
 *                    a colleague's activity on a lead you can see, which the
 *                    canonical calendar deliberately excludes for an
 *                    assignment-scoped user.
 *   today            `todayLocalDate` is resolved from the server's instant, so
 *                    "Today" means the same day on every device.
 *
 * So this route decides none of them. It authenticates the caller, hands the
 * canonical parsers their strings, and returns `CrmCalendarSnapshot` exactly as
 * `fetchCrmCalendarSnapshot` assembled it — the same function the browser
 * workspace calls, now running against the caller's bearer client.
 *
 * Read-only, and it must stay that way: rescheduling, completing, transferring
 * and designating a primary next action are already governed RPCs the app calls
 * directly, and adding a write here would create a second authority for them.
 */

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  const url = new URL(request.url);
  const rawView = url.searchParams.get("view");
  const rawDate = url.searchParams.get("date");
  const rawOwner = url.searchParams.get("owner");

  /*
   * The canonical parsers substitute a default for anything they do not
   * recognise, which is right for a browser URL a human typed and wrong for a
   * client that asked for something specific: a phone sending `view=quarter`
   * would render a week and label it a quarter. So an ABSENT parameter still
   * takes the canonical default, while a PRESENT one that the canonical
   * vocabulary does not admit is refused here.
   *
   * The membership tests are the canonical exports, not a second spelling of
   * them — this route never maps a string onto a view or a date itself.
   */
  if (
    rawView !== null &&
    !(CRM_CALENDAR_VIEWS as readonly string[]).includes(rawView)
  ) {
    return crmMobileError(
      "invalid_request",
      "Unknown calendar view. Use day, week or month."
    );
  }

  if (rawDate !== null && !isCalendarLocalDate(rawDate.trim())) {
    return crmMobileError(
      "invalid_request",
      "Unknown calendar date. Use YYYY-MM-DD."
    );
  }

  const ownerId = parseMyDayOwnerFilter(rawOwner ?? undefined);

  /*
   * An unparseable owner falls back to team scope in the canonical parser,
   * which would silently WIDEN a request that named one person. Refusing is the
   * safe direction: it never returns more than was asked for.
   */
  if (
    rawOwner !== null &&
    ownerId === null &&
    rawOwner.trim() !== "" &&
    rawOwner.trim() !== "team"
  ) {
    return crmMobileError(
      "invalid_request",
      "Unknown calendar owner filter."
    );
  }

  const view = parseCalendarView(rawView ?? undefined);
  const anchorDate = parseCalendarAnchorDate(rawDate ?? undefined);

  try {
    /*
     * `auth.context` carries the caller's real permissions and `auth.db` runs as
     * the caller. Whether the requested `ownerId` is honoured or replaced by the
     * caller's own id is decided inside the query, by `canReadBroad` — never
     * here, and never by the phone.
     */
    const snapshot = await fetchCrmCalendarSnapshot(
      auth.context,
      { view, anchorDate, ownerId },
      auth.db
    );

    return NextResponse.json(snapshot);
  } catch (error) {
    /*
     * Categories, never internals. A Postgres message can name columns, policies
     * and grants, and none of that belongs on a phone.
     */
    console.error("[mobile/crm/calendar]", error);

    return crmMobileError(
      "unavailable",
      "The calendar is unavailable right now. Try again."
    );
  }
}
