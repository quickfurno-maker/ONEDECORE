import "server-only";

import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  CRM_APPOINTMENT_ACTIVITY_TYPES,
  CRM_APPOINTMENT_LABELS,
  resolveCrmDashboardWindows,
  type CrmAppointmentActivityType,
  type CrmDashboardSummary,
  type CrmDashboardWindow,
} from "../contracts/dashboard-summary-contracts.ts";

/**
 * The Owner dashboard's CRM summary.
 *
 * FIVE BOUNDED READS, and not one row of lead data crosses the wire for the
 * counts: four `head: true` exact counts, plus one small ordered select of
 * today's appointments. The alternative — fetching a month of leads and
 * counting them on the phone — would move megabytes to answer three integers,
 * and would answer them differently on a slow connection.
 *
 * EVERY BOUNDARY IS CANONICAL. The IST day, the Monday week and the month come
 * from `resolveCrmDashboardWindows`, which composes the calendar contract the
 * CRM already scans sales weeks with. Nothing here does date arithmetic.
 *
 * RLS DOES THE SCOPING. `db` is the caller's own client, so the counts are of
 * the leads that caller can see — the same population their Leads workspace
 * shows them. There is no service-role path and no privileged count.
 */

/**
 * How many of today's appointments are READ to resolve upcoming, pending and
 * next.
 *
 * A day with more than this many client appointments is not a day, it is a data
 * problem; the cap exists so one bad row cannot pull an unbounded result into a
 * request. `totalToday` is deliberately NOT taken from this list — it is its own
 * exact count, so the headline number stays true even at the ceiling.
 */
const APPOINTMENT_SCAN_LIMIT = 200;

interface AppointmentRow {
  readonly id: string;
  readonly lead_id: string;
  readonly activity_type: string;
  readonly title: string;
  readonly due_at: string;
  readonly status: string;
  readonly leads: { readonly submitted_name: string } | null;
}

/** One half-open `created_at` count, run as the caller. */
async function countLeadsReceived(
  window: CrmDashboardWindow,
  db?: CrmDb
): Promise<number> {
  const supabase = await resolveCrmDb(db);

  /*
   * `created_at` is the RECEIVED instant and the only correct column here.
   * `updated_at` would move a lead into today because somebody edited it today,
   * which is a different — and useless — question.
   */
  const { count, error } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .gte("created_at", window.startIso)
    .lt("created_at", window.endIso);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return count ?? 0;
}

export async function fetchCrmDashboardSummary(
  _context: CrmAccessContext,
  db?: CrmDb
): Promise<CrmDashboardSummary> {
  const supabase = await resolveCrmDb(db);

  /*
   * ONE instant for the whole summary. Every window, and the upcoming/pending
   * split, is resolved against it — so a request that straddles a boundary
   * cannot report counts from two different "now"s.
   */
  const capturedAt = new Date().toISOString();
  const windows = resolveCrmDashboardWindows(capturedAt);

  const appointmentTypes = [...CRM_APPOINTMENT_ACTIVITY_TYPES];

  const [
    todayCount,
    weekCount,
    monthCount,
    totalTodayResult,
    appointmentResult,
  ] = await Promise.all([
    countLeadsReceived(windows.today, db),
    countLeadsReceived(windows.thisWeek, db),
    countLeadsReceived(windows.thisMonth, db),

    /* The headline number, exact and independent of the scan ceiling. */
    supabase
      .from("lead_follow_ups")
      .select("id", { count: "exact", head: true })
      .in("activity_type", appointmentTypes)
      .neq("status", "cancelled")
      .gte("due_at", windows.today.startIso)
      .lt("due_at", windows.today.endIso),

    /*
     * Today's appointments, ordered so the first OPEN one at or after now is
     * the next one. Cancelled activities are excluded in the query rather than
     * filtered afterwards, so they never reach any count.
     */
    supabase
      .from("lead_follow_ups")
      .select(
        "id, lead_id, activity_type, title, due_at, status, leads!inner(submitted_name)"
      )
      .in("activity_type", appointmentTypes)
      .neq("status", "cancelled")
      .gte("due_at", windows.today.startIso)
      .lt("due_at", windows.today.endIso)
      .order("due_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(APPOINTMENT_SCAN_LIMIT),
  ]);

  if (totalTodayResult.error) {
    throw crmErrorFromPostgresMessage(
      totalTodayResult.error.message,
      "RPC_FAILED"
    );
  }

  if (appointmentResult.error) {
    throw crmErrorFromPostgresMessage(
      appointmentResult.error.message,
      "RPC_FAILED"
    );
  }

  const rows = (appointmentResult.data ?? []) as unknown as AppointmentRow[];

  const nowMs = Date.parse(capturedAt);

  /*
   * UPCOMING and PENDING split the OPEN appointments at `capturedAt`. A
   * completed one is neither — it already happened and needs nothing. Making
   * this split on the server is what stops two phones with different clocks
   * disagreeing about which side of the line a 3:30 appointment falls on.
   */
  const open = rows.filter((row) => row.status === "open");

  const upcoming = open.filter((row) => Date.parse(row.due_at) >= nowMs);

  const pending = open.filter((row) => Date.parse(row.due_at) < nowMs);

  /* Rows arrive ordered by due_at, so the first upcoming one IS the earliest. */
  const nextRow = upcoming[0] ?? null;

  const nextType = nextRow
    ? (nextRow.activity_type as CrmAppointmentActivityType)
    : null;

  return {
    capturedAt,
    localDate: windows.localDate,
    leads: {
      today: todayCount,
      thisWeek: weekCount,
      thisMonth: monthCount,
    },
    appointments: {
      totalToday: totalTodayResult.count ?? 0,
      upcoming: upcoming.length,
      pending: pending.length,
      next:
        nextRow && nextType
          ? {
              activityId: nextRow.id,
              leadId: nextRow.lead_id,
              leadDisplayLabel:
                nextRow.leads?.submitted_name ?? "Client",
              activityType: nextType,
              activityLabel: CRM_APPOINTMENT_LABELS[nextType],
              title: nextRow.title,
              dueAt: nextRow.due_at,
            }
          : null,
    },
  };
}
