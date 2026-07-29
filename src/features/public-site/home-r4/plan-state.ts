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

export interface PlanSnapshot {
  readonly service: PmServiceId | null;
  readonly property: PmPropertyId | null;
  readonly timeline: PmTimelineId | null;
  readonly rooms: readonly PmRoomId[];
  readonly budgetComfort: BudgetComfortId | null;
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

  return [
    "ONEDECORE — My Interior Brief",
    `Service: ${snapshot.service ?? "Not selected"}`,
    `Property: ${snapshot.property ?? "Not selected"}`,
    `Timeline: ${snapshot.timeline ?? "Not selected"}`,
    `Rooms: ${rooms}`,
    snapshot.budgetComfort && budgetLabel
      ? `Budget comfort: ${budgetLabel}`
      : null,
    `Locality: ${snapshot.locality.trim() || "Not selected"}`,
    snapshot.message.trim() ? `Notes: ${snapshot.message.trim()}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

/**
 * First incomplete step: no service → 1, no property → 2, no timeline → 3,
 * otherwise the brief/locality step.
 */
export function getNextIncompleteStep(snapshot: PlanSnapshot): PmStep {
  if (!snapshot.service) return 1;
  if (!snapshot.property) return 2;
  if (!snapshot.timeline) return 3;
  return 4;
}

/** Steps whose required choice is already made — drives the progress rail. */
export function completedStepCount(snapshot: PlanSnapshot): 0 | 1 | 2 | 3 | 4 {
  let count = 0;
  if (snapshot.service) count += 1;
  if (snapshot.property) count += 1;
  if (snapshot.timeline) count += 1;
  if (snapshot.service && snapshot.property && snapshot.timeline) count += 1;
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
 * Core answers counted: service, property, timeline, ≥1 room, non-empty locality.
 */
export function computeReadinessState(snapshot: PlanSnapshot): ReadinessState {
  if (snapshot.service && snapshot.property && snapshot.timeline) {
    return "brief-ready";
  }

  let core = 0;
  if (snapshot.service) core += 1;
  if (snapshot.property) core += 1;
  if (snapshot.timeline) core += 1;
  if (snapshot.rooms.length > 0) core += 1;
  if (snapshot.locality.trim()) core += 1;

  if (core <= 1) return "exploring";
  return "planning";
}
