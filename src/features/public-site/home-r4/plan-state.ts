/**
 * Pure interior-plan helpers for the production homepage planner. No React.
 */
import type {
  PmPropertyId,
  PmRoomId,
  PmServiceId,
  PmStep,
  PmTimelineId,
} from "./content.ts";
import type { BudgetComfortId } from "./budget-config.ts";
import {
  isBudgetRangeForScope,
  serviceForProjectScope,
  type LeadProjectScopeCode,
} from "../../lead-intake/project-scope.ts";
import { v4RequiresScope } from "../../lead-intake/contracts.ts";

export interface PlanEstimateSummary {
  readonly serviceLabel: string;
  readonly sizeLabel: string;
  readonly finishLabel: string;
  readonly rangeLabel: string;
}

export interface PlanSnapshot {
  readonly service: PmServiceId | null;
  /**
   * The `public-consult-v4` home question: which size of home the work is for,
   * and which band from THAT scope's ladder. Both are null for
   * `custom-wardrobes`, which asks neither — see `homeStepComplete`.
   */
  readonly projectScope: LeadProjectScopeCode | null;
  readonly budgetRange: string | null;
  readonly property: PmPropertyId | null;
  readonly timeline: PmTimelineId | null;
  readonly rooms: readonly PmRoomId[];
  readonly budgetComfort: BudgetComfortId | null;
  readonly estimateSummary: PlanEstimateSummary | null;
  readonly name: string;
  readonly mobile: string;
  readonly locality: string;
  readonly message: string;
  readonly whatsappConsent: boolean;
  readonly privacyConsent: boolean;
}

/** Clipboard-ready interior brief. Uses plan ids; no contact submission fields. */
export function formatInteriorBrief(
  snapshot: PlanSnapshot,
  budgetLabel?: string | null
): string {
  const rooms =
    snapshot.rooms.length > 0 ? snapshot.rooms.join(", ") : "Not selected";

  const estimate = snapshot.estimateSummary;
  const estimateLines = estimate
    ? [
        `Indicative estimate: ${estimate.rangeLabel}`,
        `Estimate basis: ${estimate.serviceLabel} · ${estimate.sizeLabel} · ${estimate.finishLabel}`,
        "Planning estimate only — not a final quotation.",
      ]
    : [];

  return [
    "ONEDECORE — My Interior Brief",
    `Service: ${snapshot.service ?? "Not selected"}`,
    `Home: ${snapshot.projectScope ?? "Not selected"}`,
    `Budget: ${snapshot.budgetRange ?? "Not selected"}`,
    `Timeline: ${snapshot.timeline ?? "Not selected"}`,
    `Rooms: ${rooms}`,
    snapshot.budgetComfort && budgetLabel
      ? `Budget comfort: ${budgetLabel}`
      : null,
    ...estimateLines,
    `Locality: ${snapshot.locality.trim() || "Not selected"}`,
    snapshot.message.trim() ? `Notes: ${snapshot.message.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * Is the HOME step answered?
 *
 * `custom-wardrobes` asks nothing here — there is no scope list that describes
 * a wardrobe job and no owner-approved wardrobe budget ladder — so for that
 * service the step is complete as soon as the service is chosen. For the other
 * two, both answers are required AND the pair must agree: the budget has to
 * come from this scope's ladder, and the scope has to belong to this service.
 *
 * This is the same rule `unifiedLeadToRequest` and the SQL enforce. It is
 * stated here in terms of step completion so the rail, the resume CTA and the
 * submission cannot disagree about whether the visitor has answered.
 */
export function homeStepComplete(snapshot: PlanSnapshot): boolean {
  if (!snapshot.service) return false;
  if (!v4RequiresScope(snapshot.service)) return true;
  if (!snapshot.projectScope) return false;
  if (serviceForProjectScope(snapshot.projectScope) !== snapshot.service) {
    return false;
  }
  return isBudgetRangeForScope(snapshot.projectScope, snapshot.budgetRange);
}

/**
 * First incomplete step: no service → 1, home unanswered → 2, no timeline → 3,
 * otherwise the brief step where the enquiry is actually sent.
 */
export function getNextIncompleteStep(snapshot: PlanSnapshot): PmStep {
  if (!snapshot.service) return 1;
  if (!homeStepComplete(snapshot)) return 2;
  if (!snapshot.timeline) return 3;
  return 4;
}

/** Steps whose required choice is already made — drives the progress rail. */
export function completedStepCount(snapshot: PlanSnapshot): 0 | 1 | 2 | 3 | 4 {
  let count = 0;
  const home = homeStepComplete(snapshot);
  if (snapshot.service) count += 1;
  if (home) count += 1;
  if (snapshot.timeline) count += 1;
  if (snapshot.service && home && snapshot.timeline) count += 1;
  return count as 0 | 1 | 2 | 3 | 4;
}

export function planProgressPercent(snapshot: PlanSnapshot): number {
  return Math.round((completedStepCount(snapshot) / 4) * 100);
}

export function toggleRoom(
  rooms: readonly PmRoomId[],
  room: PmRoomId
): readonly PmRoomId[] {
  return rooms.includes(room)
    ? rooms.filter((entry) => entry !== room)
    : [...rooms, room];
}

/** Add a room without removing an existing selection. */
export function ensureRoom(
  rooms: readonly PmRoomId[],
  room: PmRoomId
): readonly PmRoomId[] {
  return rooms.includes(room) ? rooms : [...rooms, room];
}

export type ReadinessState = "exploring" | "planning" | "brief-ready";

/**
 * Neutral readiness from plan answers — not a score, AI rating, or lead status.
 * Core answers counted: service, the home step, timeline, ≥1 room, non-empty
 * locality.
 */
export function computeReadinessState(snapshot: PlanSnapshot): ReadinessState {
  if (snapshot.service && homeStepComplete(snapshot) && snapshot.timeline) {
    return "brief-ready";
  }

  let core = 0;
  if (snapshot.service) core += 1;
  if (homeStepComplete(snapshot)) core += 1;
  if (snapshot.timeline) core += 1;
  if (snapshot.rooms.length > 0) core += 1;
  if (snapshot.locality.trim()) core += 1;

  if (core <= 1) return "exploring";
  return "planning";
}
