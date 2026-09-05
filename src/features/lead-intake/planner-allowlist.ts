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
  "immediate",
  "within-1-month",
  "within-2-months",
  "after-2-months",
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

/* -------------------------------------------------------------------------- */
/* Service-specific qualifier (public consultation form)                       */
/* -------------------------------------------------------------------------- */

/**
 * ONE relevant question per service, instead of one questionnaire for everyone.
 *
 * The public form used to ask every visitor for BHK and a timeline. That is a
 * sensible question for a complete-home enquiry and a nonsensical one for a
 * kitchen or a wardrobe — "how many BHK is your kitchen?" is the kind of
 * question that makes a serious visitor close the tab.
 *
 * The qualifier is a (kind, code) PAIR. The kind is derived from the chosen
 * service and validated server-side, so a code can never be attached to a
 * service it does not belong to.
 */
export const LEAD_QUALIFIER_KINDS = [
  "home-size",
  "kitchen-scope",
  "wardrobe-count",
] as const;

/** Complete home interiors — the one service where property size is relevant. */
export const LEAD_HOME_SIZE_CODES = [
  "apartment-1bhk",
  "apartment-2bhk",
  "apartment-3bhk",
  "apartment-4bhk-plus",
  "villa-rowhouse",
  "unsure",
] as const;

/** Modular kitchens. Customer language, not cabinetry jargon. */
export const LEAD_KITCHEN_SCOPE_CODES = [
  "new-kitchen",
  "renovate-existing",
  "kitchen-with-utility",
  "unsure",
] as const;

/** Custom wardrobes. */
export const LEAD_WARDROBE_COUNT_CODES = [
  "one",
  "two",
  "three",
  "four-plus",
  "unsure",
] as const;

export type LeadQualifierKind = (typeof LEAD_QUALIFIER_KINDS)[number];
export type LeadHomeSizeCode = (typeof LEAD_HOME_SIZE_CODES)[number];
export type LeadKitchenScopeCode = (typeof LEAD_KITCHEN_SCOPE_CODES)[number];
export type LeadWardrobeCountCode = (typeof LEAD_WARDROBE_COUNT_CODES)[number];

export type LeadQualifierCode =
  | LeadHomeSizeCode
  | LeadKitchenScopeCode
  | LeadWardrobeCountCode;

/** Exactly one qualifier kind per service. */
export const LEAD_QUALIFIER_KIND_BY_SERVICE: Readonly<
  Record<LeadServiceCode, LeadQualifierKind>
> = {
  "complete-home-interiors": "home-size",
  "modular-kitchens": "kitchen-scope",
  "custom-wardrobes": "wardrobe-count",
};

export const LEAD_QUALIFIER_CODES_BY_KIND: Readonly<
  Record<LeadQualifierKind, readonly string[]>
> = {
  "home-size": LEAD_HOME_SIZE_CODES,
  "kitchen-scope": LEAD_KITCHEN_SCOPE_CODES,
  "wardrobe-count": LEAD_WARDROBE_COUNT_CODES,
};

/**
 * True when the (kind, code) pair is one this system recognises.
 *
 * Both halves are checked together: `wardrobe-count` + `apartment-2bhk` is
 * rejected even though each token is individually valid.
 */
export function isAllowedLeadQualifier(
  kind: string,
  code: string
): kind is LeadQualifierKind {
  const allowed =
    LEAD_QUALIFIER_CODES_BY_KIND[kind as LeadQualifierKind] ?? null;
  return allowed !== null && allowed.includes(code);
}

/**
 * The property code a qualifier genuinely implies, or null.
 *
 * ONLY a complete-home answer names a property, and only when the customer
 * actually chose one. A kitchen scope, a wardrobe count and every "unsure"
 * answer return null — inventing an `apartment-2bhk` to satisfy a NOT NULL
 * column is exactly the CRM pollution this contract exists to prevent.
 */
export function propertyCodeFromQualifier(
  kind: string,
  code: string
): LeadPropertyCode | null {
  if (kind !== "home-size" || code === "unsure") {
    return null;
  }
  return (LEAD_PROPERTY_CODES as readonly string[]).includes(code)
    ? (code as LeadPropertyCode)
    : null;
}
