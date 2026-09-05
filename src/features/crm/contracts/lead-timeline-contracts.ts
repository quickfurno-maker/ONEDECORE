/**
 * CRM 2D-1 — unified lead timeline contracts (owner locks Q6).
 *
 * The timeline is a READ INTERPRETATION of existing canonical audit rows. It
 * creates no persistence, no projection and no second event store: every entry
 * is derived from an append-only row that some existing CRM authority already
 * wrote.
 *
 * Dedupe happens in presentation only — no source row is ever deleted, and a
 * pair that cannot be PROVEN to be a twin is shown in full rather than hidden.
 */

import { formatCrmCodeLabel } from "./crm-labels.ts";
import { humanizeCrmUnderscoreCode } from "./lead-activity-history.ts";

/* -------------------------------------------------------------------------- */
/* Categories                                                                  */
/* -------------------------------------------------------------------------- */

export const CRM_TIMELINE_CATEGORIES = [
  "activity",
  "note",
  "stage",
  "assignment",
  "cadence",
  "quotation",
  "consent",
  "system",
] as const;

export type CrmTimelineCategory = (typeof CRM_TIMELINE_CATEGORIES)[number];

export const CRM_TIMELINE_CATEGORY_LABELS: Readonly<
  Record<CrmTimelineCategory, string>
> = {
  activity: "Activity",
  note: "Note",
  stage: "Stage",
  assignment: "Assignment",
  cadence: "Cadence",
  quotation: "Quotation",
  consent: "Consent",
  system: "System",
};

/* -------------------------------------------------------------------------- */
/* Source ranking — the documented tie-breaker                                 */
/* -------------------------------------------------------------------------- */

/**
 * Physical origin of an entry. `now()` is transaction time, so several canonical
 * sources routinely share a byte-identical timestamp; the rank below is the
 * documented, data-derivable second sort key that makes those ties stable AND
 * meaningful. Lower sorts first within one instant.
 */
export const CRM_TIMELINE_SOURCES = [
  "quotation",
  "note",
  "activity",
  "event",
  "consent",
] as const;

export type CrmTimelineSource = (typeof CRM_TIMELINE_SOURCES)[number];

export const CRM_TIMELINE_SOURCE_RANK: Readonly<
  Record<CrmTimelineSource, number>
> = {
  quotation: 1,
  note: 2,
  activity: 3,
  event: 4,
  consent: 5,
};

/* -------------------------------------------------------------------------- */
/* Bounds                                                                      */
/* -------------------------------------------------------------------------- */

/** Per-source bounded fetch. Every source is indexed on (lead_id, ts desc). */
export const CRM_TIMELINE_SOURCE_FETCH_LIMIT = 60;

/** Hard ceiling on a rendered timeline. Truncation is always disclosed. */
export const CRM_TIMELINE_MAX_ENTRIES = 120;

/* -------------------------------------------------------------------------- */
/* Entry shape                                                                 */
/* -------------------------------------------------------------------------- */

export interface CrmTimelineEntry {
  /** Stable, source-prefixed identity. Also the final sort tie-breaker. */
  readonly id: string;
  readonly source: CrmTimelineSource;
  readonly category: CrmTimelineCategory;
  /** Human-readable. Never a raw DB or event code. */
  readonly title: string;
  /** Optional second line — outcome, excerpt, amount context. */
  readonly detail: string | null;
  readonly occurredAt: string;
  readonly actorLabel: string | null;
  /** Domain row this entry points at, used for dedupe proof. */
  readonly referenceId: string | null;
  /** Ex-tax paise, only on commercial entries where a version total applies. */
  readonly amountPaise: number | null;
}

export interface CrmLeadTimelinePage {
  readonly entries: readonly CrmTimelineEntry[];
  /** True when the bounded read hit `CRM_TIMELINE_MAX_ENTRIES`. */
  readonly truncated: boolean;
  /** Entries actually returned. */
  readonly entryCount: number;
  /** Ceiling applied, surfaced so the UI can state it honestly. */
  readonly limit: number;
}

/* -------------------------------------------------------------------------- */
/* Comparator — the single ordering authority                                  */
/* -------------------------------------------------------------------------- */

/**
 * Total order: occurredAt DESC, then documented source rank ASC, then id ASC.
 * Never returns 0 for two distinct entries, so the order is stable regardless
 * of input order or sort algorithm.
 */
export function compareTimelineEntries(
  left: CrmTimelineEntry,
  right: CrmTimelineEntry
): number {
  const leftMs = Date.parse(left.occurredAt);
  const rightMs = Date.parse(right.occurredAt);
  const leftValid = Number.isNaN(leftMs) ? Number.NEGATIVE_INFINITY : leftMs;
  const rightValid = Number.isNaN(rightMs) ? Number.NEGATIVE_INFINITY : rightMs;

  if (leftValid !== rightValid) {
    return leftValid > rightValid ? -1 : 1;
  }

  const rankDelta =
    CRM_TIMELINE_SOURCE_RANK[left.source] - CRM_TIMELINE_SOURCE_RANK[right.source];
  if (rankDelta !== 0) {
    return rankDelta;
  }

  return left.id.localeCompare(right.id);
}

export function sortTimelineEntries(
  entries: readonly CrmTimelineEntry[]
): readonly CrmTimelineEntry[] {
  return [...entries].sort(compareTimelineEntries);
}

/* -------------------------------------------------------------------------- */
/* Dedupe                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * `lead_events` types whose business meaning is already carried by a richer
 * `lead_activities` row written in the same transaction by the same authority.
 * Excluding them removes the systematic twin without touching source data.
 *
 * `lead.note_added` is listed because it is an allowlist entry with no producer
 * in the repository; if one ever appears, `note.created` already covers it.
 */
export const CRM_TIMELINE_SUPPRESSED_EVENT_TYPES = [
  "lead.status_changed",
  "lead.on_hold",
  "lead.resumed",
  "lead.assigned",
  "lead.note_added",
] as const;

/**
 * `lead.created` is suppressed ONLY when an entry-method activity twin
 * (`lead.manual_created` / `lead.bulk_imported`) is present for the same lead.
 * Web-planner and intake leads have no such twin, so they keep their origin row.
 */
export const CRM_TIMELINE_ORIGIN_ACTIVITY_TYPES = [
  "lead.manual_created",
  "lead.bulk_imported",
] as const;

/** `lead_events` types that carry business meaning no activity represents. */
export const CRM_TIMELINE_INCLUDED_EVENT_TYPES = [
  "lead.created",
  "lead.duplicate_detected",
  "lead.consent_updated",
  // M56 writes the manual sales temperature audit here. Without it the ledger
  // recorded who reclassified a lead and from what, and the CRM history could
  // not show any of it. There is no activity twin for this event, so including
  // it duplicates nothing.
  "lead.sales_temperature_set",
] as const;

/**
 * Client-visible or decision-grade commercial events. Draft churn
 * (draft_updated, discount_changed, tax_profile_changed, …) is excluded.
 */
export const CRM_TIMELINE_INCLUDED_QUOTATION_EVENT_TYPES = [
  "quotation.created",
  "quotation.finalized",
  "quotation.capability_issued",
  "quotation.capability_revoked",
  "quotation.accepted",
  "quotation.revision_created",
] as const;

/* -------------------------------------------------------------------------- */
/* Labels — no raw code ever reaches the UI                                    */
/* -------------------------------------------------------------------------- */

const ACTIVITY_TYPE_LABELS: Readonly<Record<string, string>> = {
  "note.created": "Note added",
  "follow_up.scheduled": "Activity scheduled",
  "follow_up.auto_created": "Activity auto-created",
  "follow_up.completed": "Activity completed",
  "follow_up.cancelled": "Activity cancelled",
  "follow_up.sla_breached": "First-contact SLA breached",
  "status.changed": "Stage changed",
  "assignment.changed": "Lead assignment changed",
  "lead.manual_created": "Lead created manually",
  "lead.bulk_imported": "Lead imported",
  "cadence.enrolled": "Cadence started",
  "cadence.completed": "Cadence completed",
  "cadence.stopped": "Cadence stopped",
};

const EVENT_TYPE_LABELS: Readonly<Record<string, string>> = {
  "lead.created": "Lead received",
  "lead.duplicate_detected": "Possible duplicate detected",
  "lead.consent_updated": "Consent updated",
  "lead.status_changed": "Stage changed",
  "lead.assigned": "Lead assignment changed",
  "lead.on_hold": "Lead put on hold",
  "lead.resumed": "Lead resumed",
  "lead.note_added": "Note added",
  "lead.sales_temperature_set": "Sales temperature changed",
};

const QUOTATION_EVENT_LABELS: Readonly<Record<string, string>> = {
  "quotation.created": "Quotation started",
  "quotation.finalized": "Quotation finalized",
  "quotation.capability_issued": "Quotation issued to client",
  "quotation.capability_revoked": "Quotation access revoked",
  "quotation.accepted": "Quotation accepted",
  "quotation.revision_created": "Quotation revision created",
};

const ACTIVITY_TYPE_CATEGORY: Readonly<Record<string, CrmTimelineCategory>> = {
  "note.created": "note",
  "follow_up.scheduled": "activity",
  "follow_up.auto_created": "activity",
  "follow_up.completed": "activity",
  "follow_up.cancelled": "activity",
  "follow_up.sla_breached": "activity",
  "status.changed": "stage",
  "assignment.changed": "assignment",
  "lead.manual_created": "system",
  "lead.bulk_imported": "system",
  "cadence.enrolled": "cadence",
  "cadence.completed": "cadence",
  "cadence.stopped": "cadence",
};

const EVENT_TYPE_CATEGORY: Readonly<Record<string, CrmTimelineCategory>> = {
  "lead.created": "system",
  "lead.duplicate_detected": "system",
  "lead.consent_updated": "consent",
  "lead.status_changed": "stage",
  "lead.assigned": "assignment",
  "lead.on_hold": "stage",
  "lead.resumed": "stage",
  "lead.note_added": "note",
  // Reuses the existing `stage` category: it is a classification change on
  // the lead, and inventing a category for one event type would fragment
  // the filter vocabulary.
  "lead.sales_temperature_set": "stage",
};

/**
 * Never returns a raw dotted code. Unknown codes fall back to the shared CRM
 * code formatter, which title-cases them into readable words.
 */
export function formatTimelineActivityLabel(activityType: string): string {
  return (
    ACTIVITY_TYPE_LABELS[activityType] ??
    formatCrmCodeLabel(activityType.replace(/\./g, "-"))
  );
}

export function formatTimelineEventLabel(eventType: string): string {
  return (
    EVENT_TYPE_LABELS[eventType] ??
    formatCrmCodeLabel(eventType.replace(/\./g, "-"))
  );
}

export function formatTimelineQuotationLabel(eventType: string): string {
  return (
    QUOTATION_EVENT_LABELS[eventType] ??
    formatCrmCodeLabel(eventType.replace(/\./g, "-"))
  );
}

export function timelineCategoryForActivity(
  activityType: string
): CrmTimelineCategory {
  return ACTIVITY_TYPE_CATEGORY[activityType] ?? "system";
}

export function timelineCategoryForEvent(
  eventType: string
): CrmTimelineCategory {
  return EVENT_TYPE_CATEGORY[eventType] ?? "system";
}

/**
 * "Cold → Warm", "System → Hot", "Warm → System".
 *
 * The stored values are `hot`/`warm`/`cold`/null, and a NULL on either side is a
 * real state — the lead using the system suggestion — so it reads as "System"
 * rather than being hidden. Returns null when the payload carries neither side,
 * and the caller then shows the title alone rather than an empty arrow.
 */
export function formatTimelineTemperatureDetail(
  eventData: unknown
): string | null {
  if (!eventData || typeof eventData !== "object") {
    return null;
  }
  const data = eventData as Record<string, unknown>;
  if (!("from" in data) && !("to" in data)) {
    return null;
  }

  const label = (value: unknown): string => {
    if (value == null) {
      return "System";
    }
    const raw = String(value).trim();
    if (!raw) {
      return "System";
    }
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  };

  return `${label(data.from)} \u2192 ${label(data.to)}`;
}

/* -------------------------------------------------------------------------- */
/* Activity detail — outcome and conversation note from existing metadata      */
/* -------------------------------------------------------------------------- */

/** Bounded second line. A 1000-char note must not run away with the timeline. */
export const CRM_TIMELINE_ACTIVITY_DETAIL_MAX = 200;

const FINISHED_ACTIVITY_TYPES = [
  "follow_up.completed",
  "follow_up.cancelled",
] as const;

/** Only strings are usable as display text; anything else is ignored. */
function readTextField(source: Record<string, unknown>, key: string): string | null {
  const value = source[key];
  if (typeof value !== "string") {
    return null;
  }
  // Newlines are collapsed because this is a single-line timeline detail; the
  // full multi-line note stays visible in the activity log.
  const flattened = value.replace(/\s+/g, " ").trim();
  return flattened.length > 0 ? flattened : null;
}

function clampDetail(value: string): string {
  if (value.length <= CRM_TIMELINE_ACTIVITY_DETAIL_MAX) {
    return value;
  }
  return `${value.slice(0, CRM_TIMELINE_ACTIVITY_DETAIL_MAX - 1).trimEnd()}…`;
}

/**
 * The detail line for a timeline activity entry.
 *
 * `lead_activities.summary` for a finished follow-up is the fixed string
 * "Follow-up completed", which merely restates the "Activity completed" title
 * while the outcome and the client's own words sit unused in `metadata`. This
 * reads them instead — no new persistence, no backfill, no schema change.
 *
 * Metadata shape has varied across migrations, so every field is optional and
 * every read fails soft:
 *
 *   current  { outcomeCode, outcomeDisplay, note, wasPrimary, resolution }
 *   legacy   { outcome }
 *   on-hold  { reason }
 *
 * Returns null when nothing better than the generic summary is available, so a
 * finished activity shows one clean line rather than a duplicated one.
 */
export function formatTimelineActivityDetail(
  activityType: string,
  summary: string | null,
  metadata: unknown
): string | null {
  const isFinished = (FINISHED_ACTIVITY_TYPES as readonly string[]).includes(
    activityType
  );

  if (!isFinished) {
    const fallback = summary?.trim();
    return fallback ? clampDetail(fallback) : null;
  }

  const data =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};

  // `outcomeDisplay` and the legacy `outcome` are already human text. The raw
  // `outcomeCode` is a machine code and is only ever shown humanized.
  const outcome =
    readTextField(data, "outcomeDisplay") ??
    readTextField(data, "outcome") ??
    humanizeCrmUnderscoreCode(readTextField(data, "outcomeCode"));

  const note = readTextField(data, "note");

  if (outcome && note) {
    return clampDetail(`${outcome} · “${note}”`);
  }
  if (outcome) {
    return clampDetail(outcome);
  }
  if (note) {
    return clampDetail(`“${note}”`);
  }

  return null;
}

/** Asia/Kolkata display, matching every other CRM timestamp surface. */
export function formatTimelineTimestamp(value: string): string {
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return "—";
  }
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(parsed));
}
