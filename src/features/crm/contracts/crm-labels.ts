/**
 * Human-readable CRM field labels for intake codes.
 */

import {
  budgetRangeLabel,
  isLeadProjectScopeCode,
  PROJECT_SCOPE_LABELS,
} from "../../lead-intake/project-scope.ts";

const CODE_LABELS: Readonly<Record<string, string>> = {
  "complete-home-interiors": "Complete Home Interiors",
  "modular-kitchens": "Modular Kitchens",
  "custom-wardrobes": "Custom Wardrobes",
  "apartment-1bhk": "Apartment — 1 BHK",
  "apartment-2bhk": "Apartment — 2 BHK",
  "apartment-3bhk": "Apartment — 3 BHK",
  "apartment-4bhk-plus": "Apartment — 4 BHK+",
  "villa-rowhouse": "Villa / Row House",
  "single-room": "Single Room",
  "immediate": "Immediate",
  "within-1-month": "Within 1 month",
  "within-2-months": "Within 2 months",
  "after-2-months": "After 2 months",
  living: "Living",
  kitchen: "Kitchen",
  bedrooms: "Bedrooms",
  wardrobes: "Wardrobes",
  dining: "Dining",
  other: "Other",
  "under-3l": "Under ₹3L",
  "3-6l": "₹3–6L",
  "6-12l": "₹6–12L",
  "12-20l": "₹12–20L",
  "20-30l": "₹20–30L",
  "30l-plus": "₹30L+",
  manual: "Manual",
  manager: "Manager",
  super_admin: "Super Admin",
  source_rule: "Source rule",
  system: "System",
  open: "Open",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function formatCrmCodeLabel(code: string | null | undefined): string {
  if (!code) {
    return "—";
  }

  if (Object.hasOwn(CODE_LABELS, code)) {
    return CODE_LABELS[code]!;
  }

  return code
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatCrmCodeList(codes: readonly string[]): string {
  if (codes.length === 0) {
    return "—";
  }

  return codes.map((code) => formatCrmCodeLabel(code)).join(", ");
}

/* ==========================================================================
   PUBLIC-CONSULT-V4 REQUIREMENT LABELS
   --------------------------------------------------------------------------
   The customer's own answers to "how big is the job" and "what are you
   comfortable spending". Both are stored on `public.leads` by the canonical v4
   intake and, until now, were shown to nobody: a salesperson picking up a
   kitchen enquiry could not see that the customer had already said
   "Kitchen, 2-3 Lakh".

   THESE DELEGATE. THEY DO NOT RE-DECLARE.

   `lead-intake/project-scope.ts` owns the scope vocabulary, the per-scope
   budget ladders and their display labels, and the public form renders from
   exactly those. A second copy here would let CRM and the form drift until
   they described the same stored code with two different amounts of money,
   which is the kind of disagreement nobody notices until a quotation is wrong.
   ========================================================================== */

/**
 * A stored project scope as a person reads it: `2-bhk` -> "2 BHK".
 *
 * Null means the customer was never asked — `custom-wardrobes` has no scope
 * list, so its absence is correct rather than missing data. An unrecognised
 * historical code keeps its raw fact through the generic formatter rather than
 * being hidden.
 */
export function formatProjectScopeLabel(
  code: string | null | undefined
): string {
  if (!code) {
    return "—";
  }
  return isLeadProjectScopeCode(code)
    ? PROJECT_SCOPE_LABELS[code]
    : formatCrmCodeLabel(code);
}

/**
 * A stored budget band as a person reads it: (`kitchen`, `kitchen-2-3l`) ->
 * "₹2–3 Lakh".
 *
 * A band only means anything inside the ladder it came from — `2bhk-8-12l` is
 * not a kitchen price — so the scope is required to resolve it. When the pair
 * does not resolve (an unknown code, or a historical row whose scope and band
 * disagree) the raw code is still shown through the generic formatter: a
 * salesperson seeing an odd label can ask, but cannot ask about a blank.
 */
export function formatBudgetRangeLabel(
  scopeCode: string | null | undefined,
  budgetCode: string | null | undefined
): string {
  if (!budgetCode) {
    return "—";
  }
  return budgetRangeLabel(scopeCode, budgetCode) ?? formatCrmCodeLabel(budgetCode);
}

/**
 * The compact "2 BHK · ₹8–12 Lakh" line the list surfaces put under the
 * service.
 *
 * Returns null when the customer answered neither, so the caller renders NO
 * line at all. A wardrobe enquiry legitimately has both absent, and a row
 * reading "— · —" would present that correct silence as missing data. One
 * answer present yields just that answer, never a half-empty pair.
 */
export function formatProjectRequirementMeta(
  scopeCode: string | null | undefined,
  budgetCode: string | null | undefined
): string | null {
  const parts: string[] = [];
  if (scopeCode) {
    parts.push(formatProjectScopeLabel(scopeCode));
  }
  if (budgetCode) {
    parts.push(formatBudgetRangeLabel(scopeCode, budgetCode));
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}
