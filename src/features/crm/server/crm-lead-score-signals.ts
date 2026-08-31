import "server-only";

import type { CrmCommercialState } from "../contracts/deal-value-contracts.ts";
import type {
  CrmLeadDetailFollowUp,
  CrmLeadDetailNote,
  CrmLeadDetailSlaClock,
} from "../contracts/lead-detail-dtos.ts";
import type { CrmLeadTimelinePage } from "../contracts/lead-timeline-contracts.ts";
import {
  CRM_SCORE_MEANINGFUL_OUTCOME_CODES,
  type CrmLeadScoreSignals,
} from "../contracts/lead-score-contracts.ts";
import type { LeadStageCode } from "../contracts/lead-stages.ts";

const MEANINGFUL_OUTCOME_CODES: readonly string[] =
  CRM_SCORE_MEANINGFUL_OUTCOME_CODES;

/** MAX over ISO instants, ignoring nulls and unparseable values. */
export function latestIso(
  values: readonly (string | null)[]
): string | null {
  let latest: string | null = null;
  let latestMs = Number.NEGATIVE_INFINITY;
  for (const value of values) {
    if (value === null) {
      continue;
    }
    const ms = Date.parse(value);
    if (!Number.isNaN(ms) && ms > latestMs) {
      latestMs = ms;
      latest = value;
    }
  }
  return latest;
}

/**
 * Assembles score signals from the lead-detail read set.
 *
 * The pipeline board assembles the SAME shape from its own batched reads, so a
 * lead scores identically on both surfaces — which is why no signal here may
 * depend on a permission that varies between them, and why nothing sensitive
 * (name, email, phone, locality, declared budget) is ever read.
 */
export function buildLeadScoreSignalsFromDetail(input: {
  readonly status: LeadStageCode;
  readonly assignedTo: string | null;
  readonly receivedAt: string;
  readonly followUps: readonly CrmLeadDetailFollowUp[];
  readonly notes: readonly CrmLeadDetailNote[];
  /** Already-filtered client-visible quotation entries, newest first. */
  readonly timeline: CrmLeadTimelinePage;
  readonly slaClock: CrmLeadDetailSlaClock;
  readonly commercialState: CrmCommercialState;
}): CrmLeadScoreSignals {
  const primary =
    input.followUps.find(
      (entry) => entry.status === "open" && entry.isPrimaryNextAction
    ) ?? null;

  const completed = input.followUps.filter(
    (entry) => entry.status === "completed"
  );

  const hasMeaningfulOutcome = completed.some(
    (entry) =>
      entry.outcomeCode !== null &&
      MEANINGFUL_OUTCOME_CODES.includes(entry.outcomeCode)
  );

  // Q3: "non-cancelled" — an open consultation counts, a cancelled one does not.
  const hasConsultationOrSiteVisit = input.followUps.some(
    (entry) =>
      (entry.activityType === "consultation" ||
        entry.activityType === "site_visit") &&
      entry.status !== "cancelled"
  );

  let lastMeaningfulActivityAt: string | null = null;
  for (const entry of completed) {
    if (entry.activityType === "internal_task" || entry.completedAt === null) {
      continue;
    }
    if (
      lastMeaningfulActivityAt === null ||
      Date.parse(entry.completedAt) > Date.parse(lastMeaningfulActivityAt)
    ) {
      lastMeaningfulActivityAt = entry.completedAt;
    }
  }

  // Owner-locked STALE input: MAX(completed non-internal activity, note,
  // client-visible quotation event). The timeline already carries exactly the
  // six decision-grade quotation event types, newest first.
  const latestQuotationTouchAt =
    input.timeline.entries.find((entry) => entry.source === "quotation")
      ?.occurredAt ?? null;

  const latestNoteAt = input.notes.reduce<string | null>(
    (latest, note) =>
      latest === null || Date.parse(note.createdAt) > Date.parse(latest)
        ? note.createdAt
        : latest,
    null
  );

  const latestMeaningfulSalesTouchAt = latestIso([
    lastMeaningfulActivityAt,
    latestNoteAt,
    latestQuotationTouchAt,
  ]);

  return {
    status: input.status,
    isAssigned: input.assignedTo !== null,
    receivedAt: input.receivedAt,
    latestMeaningfulSalesTouchAt,
    hasFirstContactAttempt: input.slaClock.firstContactAttemptAt !== null,
    hasMeaningfulOutcome,
    hasConsultationOrSiteVisit,
    commercialState: input.commercialState,
    lastMeaningfulActivityAt,
    hasOpenPrimaryNextAction: primary !== null,
    primaryNextActionDueAt: primary?.dueAt ?? null,
    slaDueAt: input.slaClock.slaDueAt,
  };
}
