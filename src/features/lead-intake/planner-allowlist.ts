/**
 * Lead-intake planner allowlists.
 * Must match PM_PLANNER / BUDGET_COMFORT_OPTIONS (enforced by source invariant tests).
 * Kept separate from home-r4/content.ts so Node tests do not load Next path aliases.
 */

export const LEAD_SERVICE_CODES = [
  "complete-home-interiors",
  "modular-kitchens",
  "custom-wardrobes",
] as const;

export const LEAD_PROPERTY_CODES = [
  "apartment-1bhk",
  "apartment-2bhk",
  "apartment-3bhk",
  "apartment-4bhk-plus",
  "villa-rowhouse",
  "single-room",
] as const;

export const LEAD_TIMELINE_CODES = [
  "ready-now",
  "within-3-months",
  "3-6-months",
  "more-than-6-months",
  "exploring",
] as const;

export const LEAD_ROOM_CODES = [
  "living",
  "kitchen",
  "bedrooms",
  "wardrobes",
  "dining",
  "other",
] as const;

export const LEAD_BUDGET_COMFORT_CODES = [
  "under-3l",
  "3-6l",
  "6-12l",
  "12-20l",
  "20-30l",
  "30l-plus",
] as const;

export type LeadServiceCode = (typeof LEAD_SERVICE_CODES)[number];
export type LeadPropertyCode = (typeof LEAD_PROPERTY_CODES)[number];
export type LeadTimelineCode = (typeof LEAD_TIMELINE_CODES)[number];
export type LeadRoomCode = (typeof LEAD_ROOM_CODES)[number];
export type LeadBudgetComfortCode = (typeof LEAD_BUDGET_COMFORT_CODES)[number];
