import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import {
  CRM_TIMELINE_INCLUDED_EVENT_TYPES,
  CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES,
  CRM_TIMELINE_MAX_ENTRIES,
  CRM_TIMELINE_ORIGIN_ACTIVITY_TYPES,
  CRM_TIMELINE_SOURCE_FETCH_LIMIT,
  formatTimelineActivityLabel,
  formatTimelineEventLabel,
  formatTimelineTemperatureDetail,
  formatTimelineQuotationLabel,
  sortTimelineEntries,
  timelineCategoryForActivity,
  timelineCategoryForEvent,
  type CrmLeadTimelinePage,
  type CrmTimelineEntry,
} from "../contracts/lead-timeline-contracts.ts";
import { formatCrmCodeLabel } from "../contracts/crm-labels.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

/** Resolves a staff display name; never leaks an id when unknown. */
export type ActorLabelResolver = (
  userId: string | null | undefined
) => string | null;

const INCLUDED_EVENT_TYPES: readonly string[] = CRM_TIMELINE_INCLUDED_EVENT_TYPES;
const ORIGIN_ACTIVITY_TYPES: readonly string[] = CRM_TIMELINE_ORIGIN_ACTIVITY_TYPES;
const INCLUDED_QUOTATION_EVENT_TYPES: readonly string[] =
  CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES;

const NOTE_EXCERPT_MAX = 400;

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

/**
 * Builds the unified lead timeline from canonical, RLS-scoped audit rows.
 *
 * Every source read here is already policied: `lead_activities` additionally
 * requires `crm.activities.read`, `consent_events` requires `consents.read`,
 * and `quotation_events` requires `quotations.read` composed with CRM lead
 * scope via `private.quotation_can_view`. A permission the actor lacks simply
 * yields no rows — omission is SILENT, because rendering a "hidden entries"
 * count would itself leak the existence and volume of restricted data.
 *
 * No source row is ever deleted or mutated. Dedupe is presentation-only, and
 * only where a twin can be PROVEN by reference key or entry-method pairing.
 */
export async function fetchLeadTimelinePage(
  leadId: string,
  context: CrmAccessContext,
  labelForUser: ActorLabelResolver
): Promise<CrmLeadTimelinePage> {
  const supabase = await createClient();

  const [
    activitiesResult,
    notesResult,
    eventsResult,
    quotationEventsResult,
    consentResult,
  ] = await Promise.all([
    context.canReadActivities
      ? supabase
          .from("lead_activities")
          .select("id, activity_type, reference_id, occurred_at, actor_id, summary, metadata")
          .eq("lead_id", leadId)
          .order("occurred_at", { ascending: false })
          .limit(CRM_TIMELINE_SOURCE_FETCH_LIMIT)
      : Promise.resolve({ data: [], error: null }),
    supabase
      .from("lead_notes")
      .select("id, body, created_at, created_by")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false })
      .limit(CRM_TIMELINE_SOURCE_FETCH_LIMIT),
    supabase
      .from("lead_events")
      .select("id, event_type, occurred_at, actor_id, actor_type, event_data")
      .eq("lead_id", leadId)
      .in("event_type", [...INCLUDED_EVENT_TYPES])
      .order("occurred_at", { ascending: false })
      .limit(CRM_TIMELINE_SOURCE_FETCH_LIMIT),
    supabase
      .from("quotation_events")
      .select("id, event_type, occurred_at, actor_id, quotation_version_id")
      .eq("lead_id", leadId)
      .in("event_type", [...INCLUDED_QUOTATION_EVENT_TYPES])
      .order("occurred_at", { ascending: false })
      .limit(CRM_TIMELINE_SOURCE_FETCH_LIMIT),
    context.canReadConsents
      ? supabase
          .from("consent_events")
          .select("id, purpose_code, channel, event_type, occurred_at, actor_type")
          .eq("lead_id", leadId)
          .order("occurred_at", { ascending: false })
          .limit(CRM_TIMELINE_SOURCE_FETCH_LIMIT)
      : Promise.resolve({ data: [], error: null }),
  ]);

  for (const result of [
    activitiesResult,
    notesResult,
    eventsResult,
    quotationEventsResult,
    consentResult,
  ]) {
    if (result.error) {
      throw crmErrorFromPostgresMessage(result.error.message, "RPC_FAILED");
    }
  }

  const activityRows = activitiesResult.data ?? [];
  const noteRows = notesResult.data ?? [];
  const eventRows = eventsResult.data ?? [];
  const quotationEventRows = quotationEventsResult.data ?? [];
  const consentRows = consentResult.data ?? [];

  /* ---------------------------------------------------------------------- */
  /* Quotation version enrichment (amount + version number)                  */
  /* ---------------------------------------------------------------------- */

  const versionIds = Array.from(
    new Set(
      quotationEventRows
        .map((row) => row.quotation_version_id)
        .filter((value): value is string => value !== null)
    )
  );

  const versionById = new Map<
    string,
    { readonly versionNumber: number; readonly taxableBasePaise: number }
  >();

  if (versionIds.length > 0) {
    const { data: versions, error: versionError } = await supabase
      .from("quotation_versions")
      .select("id, version_number, taxable_base_paise")
      .in("id", versionIds);

    if (versionError) {
      throw crmErrorFromPostgresMessage(versionError.message, "RPC_FAILED");
    }

    for (const version of versions ?? []) {
      versionById.set(version.id, {
        versionNumber: version.version_number,
        taxableBasePaise: version.taxable_base_paise,
      });
    }
  }

  /* ---------------------------------------------------------------------- */
  /* Dedupe inputs                                                           */
  /* ---------------------------------------------------------------------- */

  // Notes are first-class timeline entries (owner lock Q6) and are read from
  // `lead_notes` so the FULL body is available rather than the 120-char
  // `lead_activities.note.created` excerpt. The activity twin is suppressed
  // only where its reference_id proves it points at a note we actually fetched;
  // an unproven pair is shown in full rather than hidden.
  const fetchedNoteIds = new Set(noteRows.map((row) => row.id));

  // `lead.created` is suppressed only when an entry-method activity twin
  // exists. Web-planner and other intake leads keep their origin row.
  const hasOriginActivity = activityRows.some((row) =>
    ORIGIN_ACTIVITY_TYPES.includes(row.activity_type)
  );

  /* ---------------------------------------------------------------------- */
  /* Entry construction                                                      */
  /* ---------------------------------------------------------------------- */

  const entries: CrmTimelineEntry[] = [];

  for (const row of activityRows) {
    if (
      row.activity_type === "note.created" &&
      row.reference_id !== null &&
      fetchedNoteIds.has(row.reference_id)
    ) {
      continue;
    }

    entries.push({
      id: `activity:${row.id}`,
      source: "activity",
      category: timelineCategoryForActivity(row.activity_type),
      title: formatTimelineActivityLabel(row.activity_type),
      detail: row.summary ? truncate(row.summary, NOTE_EXCERPT_MAX) : null,
      occurredAt: row.occurred_at,
      actorLabel: labelForUser(row.actor_id),
      referenceId: row.reference_id,
      amountPaise: null,
    });
  }

  for (const row of noteRows) {
    entries.push({
      id: `note:${row.id}`,
      source: "note",
      category: "note",
      title: "Note added",
      detail: truncate(row.body, NOTE_EXCERPT_MAX),
      occurredAt: row.created_at,
      actorLabel: labelForUser(row.created_by) ?? "Staff member",
      referenceId: row.id,
      amountPaise: null,
    });
  }

  for (const row of eventRows) {
    if (row.event_type === "lead.created" && hasOriginActivity) {
      continue;
    }

    entries.push({
      id: `event:${row.id}`,
      source: "event",
      category: timelineCategoryForEvent(row.event_type),
      title: formatTimelineEventLabel(row.event_type),
      // Only the temperature event carries a from/to worth rendering; every
      // other event keeps its title-only presentation.
      detail:
        row.event_type === "lead.sales_temperature_set"
          ? formatTimelineTemperatureDetail(row.event_data)
          : null,
      occurredAt: row.occurred_at,
      actorLabel:
        row.actor_type === "staff"
          ? labelForUser(row.actor_id) ?? "Staff member"
          : "System",
      referenceId: null,
      amountPaise: null,
    });
  }

  for (const row of quotationEventRows) {
    const version = row.quotation_version_id
      ? versionById.get(row.quotation_version_id) ?? null
      : null;

    entries.push({
      id: `quotation:${row.id}`,
      source: "quotation",
      category: "quotation",
      title: formatTimelineQuotationLabel(row.event_type),
      detail: version ? `Version ${version.versionNumber}` : null,
      occurredAt: row.occurred_at,
      actorLabel: labelForUser(row.actor_id) ?? "Staff member",
      referenceId: row.quotation_version_id,
      amountPaise: version ? version.taxableBasePaise : null,
    });
  }

  for (const row of consentRows) {
    entries.push({
      id: `consent:${row.id}`,
      source: "consent",
      category: "consent",
      title: `Consent ${formatCrmCodeLabel(row.event_type).toLowerCase()}`,
      detail: `${formatCrmCodeLabel(row.purpose_code)} · ${formatCrmCodeLabel(row.channel)}`,
      occurredAt: row.occurred_at,
      // consent_events carries actor_type only — never a staff identity.
      actorLabel: row.actor_type === "staff" ? "Staff member" : "Client",
      referenceId: null,
      amountPaise: null,
    });
  }

  const ordered = sortTimelineEntries(entries);
  const truncated = ordered.length > CRM_TIMELINE_MAX_ENTRIES;

  return {
    entries: truncated ? ordered.slice(0, CRM_TIMELINE_MAX_ENTRIES) : ordered,
    truncated,
    entryCount: truncated ? CRM_TIMELINE_MAX_ENTRIES : ordered.length,
    limit: CRM_TIMELINE_MAX_ENTRIES,
  };
}
