/**
 * CRM — the sales conversation & activity log.
 *
 * A READ INTERPRETATION of `lead_follow_ups`. It creates no persistence, no
 * projection and no second history: every value here is already stored on the
 * canonical activity row that the governed completion/cancellation RPCs wrote.
 *
 * The business question this answers is "what actually happened with this
 * client, and who did it?" — which is NOT the question the open-activity list
 * answers ("what should happen next?"). The two are deliberately different
 * shapes over the same table:
 *
 *   scheduled -> dueAt,       ownerLabel         (a plan)
 *   happened  -> completedAt, completedByLabel   (a record)
 *
 * Conflating them is the specific failure this module exists to prevent: a
 * transferred activity has an owner who never made the call, and a late one was
 * completed hours after it was due.
 */

import { formatCrmCodeLabel } from "./crm-labels.ts";
import type { CrmLeadDetailFollowUp } from "./lead-detail-dtos.ts";

/* -------------------------------------------------------------------------- */
/* Labels — no raw snake_case code ever reaches the UI                         */
/* -------------------------------------------------------------------------- */

/**
 * `formatCrmCodeLabel` splits on "-" only, so an underscore code like
 * `site_visit` survives it unchanged as "Site_visit". Activity types and
 * outcome codes are underscore-cased, so they need a separator-aware humanizer.
 */
export function humanizeCrmUnderscoreCode(
  code: string | null | undefined
): string | null {
  if (!code) {
    return null;
  }

  const words = code
    .split(/[-_\s]+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (words.length === 0) {
    return null;
  }

  return words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

const CONVERSATION_ACTIVITY_TYPE_LABELS: Readonly<Record<string, string>> = {
  call: "Call",
  whatsapp: "WhatsApp",
  consultation: "Consultation",
  site_visit: "Site visit",
  quotation_follow_up: "Quotation follow-up",
  internal_task: "Internal task",
};

/** Never returns a raw code. Unknown types fall through to the humanizer. */
export function formatConversationActivityType(activityType: string): string {
  return (
    CONVERSATION_ACTIVITY_TYPE_LABELS[activityType] ??
    humanizeCrmUnderscoreCode(activityType) ??
    "Activity"
  );
}

/**
 * The human outcome for a finished activity.
 *
 * `outcome` is the display text the completion RPC already resolved from the
 * outcome catalogue, so it is preferred. `outcomeCode` is the machine code
 * (`no_answer`) and is only ever shown humanized, never raw — the previous log
 * rendered `outcomeCode.replace(/_/g, " ")`, which printed "no answer"
 * lower-cased mid-sentence.
 */
export function formatConversationOutcome(
  activity: Pick<CrmLeadDetailFollowUp, "outcome" | "outcomeCode">
): string | null {
  const display = activity.outcome?.trim();
  if (display) {
    return display;
  }
  return humanizeCrmUnderscoreCode(activity.outcomeCode);
}

/** "Completed" / "Cancelled" — the shared CRM status vocabulary. */
export function formatConversationStatus(status: string): string {
  return formatCrmCodeLabel(status);
}

/* -------------------------------------------------------------------------- */
/* Client-facing types — completion note wording                               */
/* -------------------------------------------------------------------------- */

/**
 * Activity types where the completion note records what the CLIENT said, so the
 * dialog asks for a conversation note rather than a generic completion note.
 * `internal_task` is deliberately absent: no client is involved.
 */
export const CRM_CLIENT_FACING_ACTIVITY_TYPES = [
  "call",
  "whatsapp",
  "consultation",
  "site_visit",
  "quotation_follow_up",
] as const;

export function isClientFacingActivityType(activityType: string): boolean {
  return (CRM_CLIENT_FACING_ACTIVITY_TYPES as readonly string[]).includes(
    activityType
  );
}

/**
 * The note stays OPTIONAL in every wording. The owner has not locked a
 * mandatory-note policy, and the DB constraint allows null, so the label says
 * "(optional)" rather than implying a requirement the system does not enforce.
 */
export const CRM_CLIENT_CONVERSATION_NOTE_LABEL =
  "Client response / conversation note (optional)";

export const CRM_INTERNAL_COMPLETION_NOTE_LABEL = "Completion note (optional)";

export const CRM_CLIENT_CONVERSATION_NOTE_HELP =
  "What did the client say? Capture commitments, objections, callback requests or next-step context.";

export function completionNoteLabelForActivityType(
  activityType: string
): string {
  return isClientFacingActivityType(activityType)
    ? CRM_CLIENT_CONVERSATION_NOTE_LABEL
    : CRM_INTERNAL_COMPLETION_NOTE_LABEL;
}

/* -------------------------------------------------------------------------- */
/* Occurrence time — when it ACTUALLY happened                                 */
/* -------------------------------------------------------------------------- */

/**
 * The instant the interaction actually happened.
 *
 * NEVER `dueAt`. Due time is when the activity was scheduled for, and treating
 * it as the conversation time misdates every activity completed early or late.
 *
 * `updatedAt`/`createdAt` are fallbacks for historical rows written before the
 * governed RPCs stamped completion/cancellation times — they keep old rows in a
 * sane position instead of collapsing them all to the bottom.
 */
export function resolveActivityOccurredAt(
  activity: Pick<
    CrmLeadDetailFollowUp,
    "status" | "completedAt" | "cancelledAt" | "updatedAt" | "createdAt"
  >
): string | null {
  const preferred =
    activity.status === "cancelled"
      ? activity.cancelledAt
      : activity.status === "completed"
        ? activity.completedAt
        : (activity.completedAt ?? activity.cancelledAt);

  return preferred ?? activity.updatedAt ?? activity.createdAt ?? null;
}

/**
 * Who actually finished it — never the scheduled owner.
 *
 * Returns null when the actor is unknown (legacy rows carry a null
 * `completed_by`) so the UI omits the line rather than attributing the work to
 * someone who did not do it.
 */
export function resolveActivityActorLabel(
  activity: Pick<
    CrmLeadDetailFollowUp,
    "status" | "completedByLabel" | "cancelledByLabel"
  >
): string | null {
  const label =
    activity.status === "cancelled"
      ? activity.cancelledByLabel
      : activity.status === "completed"
        ? activity.completedByLabel
        : (activity.completedByLabel ?? activity.cancelledByLabel);

  const trimmed = label?.trim();
  return trimmed ? trimmed : null;
}

/* -------------------------------------------------------------------------- */
/* Ordering — newest actual interaction first                                  */
/* -------------------------------------------------------------------------- */

/**
 * Total order: actual occurrence DESC, then id ASC.
 *
 * The repository reads follow-ups `due_at asc` because that is right for the
 * OPEN queue. Letting that order reach the history put the oldest scheduled
 * item at the top of the conversation log and interleaved completions by when
 * they were PLANNED rather than when they happened.
 *
 * Never returns 0 for two distinct rows, so the sort is stable regardless of
 * input order or engine. Unparseable/absent timestamps sort last rather than
 * throwing.
 */
export function compareActivityHistoryEntries(
  left: CrmLeadDetailFollowUp,
  right: CrmLeadDetailFollowUp
): number {
  const leftAt = resolveActivityOccurredAt(left);
  const rightAt = resolveActivityOccurredAt(right);

  const leftMs = leftAt ? Date.parse(leftAt) : Number.NaN;
  const rightMs = rightAt ? Date.parse(rightAt) : Number.NaN;

  const leftValid = Number.isNaN(leftMs) ? Number.NEGATIVE_INFINITY : leftMs;
  const rightValid = Number.isNaN(rightMs) ? Number.NEGATIVE_INFINITY : rightMs;

  if (leftValid !== rightValid) {
    return leftValid > rightValid ? -1 : 1;
  }

  return left.id.localeCompare(right.id);
}

export function sortActivityHistory(
  activities: readonly CrmLeadDetailFollowUp[]
): readonly CrmLeadDetailFollowUp[] {
  return [...activities].sort(compareActivityHistoryEntries);
}
