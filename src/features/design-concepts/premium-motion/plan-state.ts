/**
 * Pure interior-plan helpers for the R4 concept. No React, unit-testable.
 */
import type {
  PmPropertyId,
  PmRoomId,
  PmServiceId,
  PmStep,
  PmTimelineId,
} from "./content";

export interface PlanSnapshot {
  readonly service: PmServiceId | null;
  readonly property: PmPropertyId | null;
  readonly timeline: PmTimelineId | null;
  readonly rooms: readonly PmRoomId[];
  readonly name: string;
  readonly mobile: string;
  readonly locality: string;
  readonly message: string;
  readonly whatsappConsent: boolean;
  readonly privacyConsent: boolean;
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function isValidIndianMobile(value: string): boolean {
  return INDIAN_MOBILE.test(value.trim());
}

export function hasRequiredContact(snapshot: PlanSnapshot): boolean {
  return (
    snapshot.name.trim().length > 0 &&
    isValidIndianMobile(snapshot.mobile) &&
    snapshot.locality.trim().length > 0 &&
    snapshot.privacyConsent === true
  );
}

/**
 * First incomplete step: no service → 1, no property → 2, no timeline → 3,
 * otherwise the contact step.
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
  if (hasRequiredContact(snapshot)) count += 1;
  return count as 0 | 1 | 2 | 3 | 4;
}

export function planProgressPercent(snapshot: PlanSnapshot): number {
  return Math.round((completedStepCount(snapshot) / 4) * 100);
}

export function validateContact(snapshot: PlanSnapshot): readonly string[] {
  const errors: string[] = [];
  if (!snapshot.name.trim()) errors.push("Name is required.");
  if (!isValidIndianMobile(snapshot.mobile)) {
    errors.push("Enter a valid 10-digit Indian mobile number.");
  }
  if (!snapshot.locality.trim()) errors.push("Pune locality is required.");
  if (!snapshot.privacyConsent) {
    errors.push("Privacy acknowledgement is required.");
  }
  return errors;
}

export function toggleRoom(
  rooms: readonly PmRoomId[],
  room: PmRoomId
): readonly PmRoomId[] {
  return rooms.includes(room)
    ? rooms.filter((entry) => entry !== room)
    : [...rooms, room];
}
