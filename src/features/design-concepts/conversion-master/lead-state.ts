/**
 * Pure lead-state helpers — unit-testable without React.
 */
import type {
  CmPlannerStep,
  CmPropertyId,
  CmRoomId,
  CmServiceId,
  CmTimelineId,
} from "./content";

export interface LeadSnapshot {
  service: CmServiceId | null;
  property: CmPropertyId | null;
  timeline: CmTimelineId | null;
  rooms: readonly CmRoomId[];
  name: string;
  mobile: string;
  locality: string;
  message: string;
  whatsappConsent: boolean;
  privacyConsent: boolean;
}

const INDIAN_MOBILE = /^[6-9]\d{9}$/;

export function isValidIndianMobile(value: string): boolean {
  return INDIAN_MOBILE.test(value.trim());
}

export function hasRequiredContact(snapshot: LeadSnapshot): boolean {
  return (
    snapshot.name.trim().length > 0 &&
    isValidIndianMobile(snapshot.mobile) &&
    snapshot.locality.trim().length > 0 &&
    snapshot.privacyConsent === true
  );
}

/**
 * Returns the first incomplete planner step.
 * No service → 1; no property → 2; no timeline → 3;
 * missing required contact/privacy → 4; everything complete → 4.
 */
export function getNextIncompleteStep(snapshot: LeadSnapshot): CmPlannerStep {
  if (!snapshot.service) return 1;
  if (!snapshot.property) return 2;
  if (!snapshot.timeline) return 3;
  return 4;
}

export function buildPlanSummary(snapshot: LeadSnapshot): {
  serviceLabel: string | null;
  propertyLabel: string | null;
  timelineLabel: string | null;
  roomsLabel: string | null;
  locality: string | null;
} {
  return {
    serviceLabel: snapshot.service,
    propertyLabel: snapshot.property,
    timelineLabel: snapshot.timeline,
    roomsLabel: snapshot.rooms.length ? snapshot.rooms.join(", ") : null,
    locality: snapshot.locality.trim() || null,
  };
}
