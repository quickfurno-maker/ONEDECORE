import "server-only";

import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import {
  calendarLocalDate,
  CRM_CALENDAR_EVENT_LIMIT,
  resolveCalendarRange,
  type CrmCalendarEvent,
  type CrmCalendarRange,
  type CrmCalendarSnapshot,
  type CrmCalendarView,
} from "../contracts/calendar-contracts.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";
import { fetchCrmAssigneeDirectory } from "./crm-lead-queries.ts";

/**
 * Bounded calendar read model.
 *
 * Reads only open activities whose `due_at` falls inside the rendered range, via
 * RLS (`lead_follow_ups_select` → `private.crm_can_view_lead`). One embedded
 * lead join and one directory lookup keep this at two round-trips — no per-event
 * lead or owner queries.
 *
 * The Supabase client is an OPTIONAL parameter, exactly as the leads, pipeline
 * and dashboard reads already take one. The browser workspace passes nothing and
 * keeps its cookie-scoped client; the mobile route passes the caller's own
 * bearer client. Either way the SAME range resolution, the SAME
 * `canReadBroad` scoping and the SAME owner-label gating run once, so a phone
 * and a browser showing the same week cannot disagree about what is in it.
 * Neither path is service-role: RLS resolves against the real user in both.
 */
const CALENDAR_SELECT =
  "id, lead_id, owner_id, activity_type, title, priority, due_at, duration_minutes, is_primary_next_action, leads!lead_follow_ups_lead_id_fkey(submitted_name, status)";

interface CalendarRow {
  readonly id: string;
  readonly lead_id: string;
  readonly owner_id: string;
  readonly activity_type: string;
  readonly title: string;
  readonly priority: string;
  readonly due_at: string;
  readonly duration_minutes: number | null;
  readonly is_primary_next_action: boolean;
  readonly leads: { readonly submitted_name: string; readonly status: string } | null;
}

export interface FetchCrmCalendarOptions {
  readonly view: CrmCalendarView;
  readonly anchorDate: string;
  readonly ownerId?: string | null;
}

export async function fetchCrmCalendarSnapshot(
  context: CrmAccessContext,
  options: FetchCrmCalendarOptions,
  db?: CrmDb
): Promise<CrmCalendarSnapshot> {
  const range: CrmCalendarRange = resolveCalendarRange(
    options.view,
    options.anchorDate
  );

  // Assignment-scoped roles never widen past their own activities.
  const scopeOwnerId = context.canReadBroad
    ? options.ownerId ?? null
    : context.userId;

  const supabase = await resolveCrmDb(db);
  let request = supabase
    .from("lead_follow_ups")
    .select(CALENDAR_SELECT)
    .eq("status", "open")
    .gte("due_at", range.startUtc)
    .lt("due_at", range.endUtc);

  if (scopeOwnerId) {
    request = request.eq("owner_id", scopeOwnerId);
  }

  const [{ data, error }, directory] = await Promise.all([
    request
      .order("due_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(CRM_CALENDAR_EVENT_LIMIT + 1),
    context.canReadBroad
      ? fetchCrmAssigneeDirectory(context, db)
      : Promise.resolve([]),
  ]);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const rows = (data ?? []) as unknown as CalendarRow[];
  const truncated = rows.length > CRM_CALENDAR_EVENT_LIMIT;
  const visibleRows = truncated ? rows.slice(0, CRM_CALENDAR_EVENT_LIMIT) : rows;

  const ownerLabels = Object.fromEntries(
    directory.map((entry) => [entry.userId, entry.displayName])
  );

  const events: CrmCalendarEvent[] = visibleRows.map((row) => ({
    activityId: row.id,
    leadId: row.lead_id,
    leadDisplayLabel: row.leads?.submitted_name ?? "Lead",
    leadStatus: (row.leads?.status ?? "new") as LeadStageCode,
    ownerId: row.owner_id,
    ownerLabel: context.canReadBroad
      ? ownerLabels[row.owner_id] ?? "Staff member"
      : null,
    activityType: row.activity_type,
    title: row.title,
    priority: row.priority,
    dueAt: row.due_at,
    durationMinutes: row.duration_minutes,
    isPrimaryNextAction: row.is_primary_next_action,
  }));

  const capturedAt = new Date().toISOString();

  return {
    range,
    events,
    truncated,
    scopeOwnerId,
    isTeamScope: context.canReadBroad && scopeOwnerId === null,
    todayLocalDate: calendarLocalDate(capturedAt),
    capturedAt,
  };
}
