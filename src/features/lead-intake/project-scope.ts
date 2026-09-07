/**
 * Project scope and budget ladders — the shared domain for the public
 * requirement form.
 *
 * WHY THIS IS ONE MODULE, AND WHY IT SITS HERE
 *
 * Five scopes each have their own budget ladder, and each maps to one of the
 * three real service codes. Those are three facts about the same thing, and if
 * they live in three places they will eventually disagree: the dropdown will
 * offer a band the validator rejects, or the validator will accept a pairing
 * the form can never produce.
 *
 * It sits beside `planner-allowlist.ts` rather than under `public/` for the same
 * reason that file does: the server validator, the client form and the Node
 * tests all need it, and Node tests cannot resolve Next path aliases.
 *
 * SCOPE IS NOT SERVICE
 *
 * "2 BHK" is not a service ONEDECORE sells; it is the size of the home the
 * service is being bought for. `leads.service_code` stays allowlisted to the
 * three real services, and the scope is stored beside it in its own column. The
 * mapping below is the only place the two are joined, and the server derives the
 * service from the scope rather than believing a client that claims both.
 */

import { LEAD_SERVICE_CODES, type LeadServiceCode } from "./planner-allowlist.ts";

/* -------------------------------------------------------------------------- */
/* Scopes                                                                      */
/* -------------------------------------------------------------------------- */

export const LEAD_PROJECT_SCOPE_CODES = [
  "kitchen",
  "1-bhk",
  "2-bhk",
  "3-bhk",
  "villa",
] as const;

export type LeadProjectScopeCode = (typeof LEAD_PROJECT_SCOPE_CODES)[number];

export const PROJECT_SCOPE_LABELS: Readonly<
  Record<LeadProjectScopeCode, string>
> = {
  kitchen: "Kitchen",
  "1-bhk": "1 BHK",
  "2-bhk": "2 BHK",
  "3-bhk": "3 BHK",
  villa: "Villa",
};

/**
 * Scope -> service.
 *
 * A kitchen project is a modular kitchen. Every whole-home scope — 1/2/3 BHK and
 * villa — is complete home interiors, because the scope describes the property,
 * not a different product line. `custom-wardrobes` is deliberately absent: no
 * scope on this form maps to it, and inventing one would put a service in CRM
 * that nobody chose.
 */
export const SERVICE_BY_PROJECT_SCOPE: Readonly<
  Record<LeadProjectScopeCode, LeadServiceCode>
> = {
  kitchen: "modular-kitchens",
  "1-bhk": "complete-home-interiors",
  "2-bhk": "complete-home-interiors",
  "3-bhk": "complete-home-interiors",
  villa: "complete-home-interiors",
};

/* -------------------------------------------------------------------------- */
/* Budget ladders                                                              */
/* -------------------------------------------------------------------------- */

export interface LeadBudgetRangeOption {
  readonly code: string;
  readonly label: string;
}

/**
 * Owner-supplied ranges, verbatim.
 *
 * The 2 BHK and 3 BHK ladders both end in the LABEL "Above ₹16 Lakh" while the
 * bands beneath them differ, so the codes are namespaced by scope. That is what
 * lets `isBudgetRangeForScope` tell a 3 BHK answer apart from a 2 BHK one that
 * happens to read the same.
 */
export const BUDGET_RANGES_BY_PROJECT_SCOPE: Readonly<
  Record<LeadProjectScopeCode, readonly LeadBudgetRangeOption[]>
> = {
  kitchen: [
    { code: "kitchen-below-1l", label: "Below ₹1 Lakh" },
    { code: "kitchen-1-2l", label: "₹1–2 Lakh" },
    { code: "kitchen-2-3l", label: "₹2–3 Lakh" },
    { code: "kitchen-above-3l", label: "Above ₹3 Lakh" },
  ],
  "1-bhk": [
    { code: "1bhk-3-5l", label: "₹3–5 Lakh" },
    { code: "1bhk-5-7l", label: "₹5–7 Lakh" },
    { code: "1bhk-7-10l", label: "₹7–10 Lakh" },
    { code: "1bhk-above-10l", label: "Above ₹10 Lakh" },
  ],
  "2-bhk": [
    { code: "2bhk-4-8l", label: "₹4–8 Lakh" },
    { code: "2bhk-8-12l", label: "₹8–12 Lakh" },
    { code: "2bhk-12-16l", label: "₹12–16 Lakh" },
    { code: "2bhk-above-16l", label: "Above ₹16 Lakh" },
  ],
  "3-bhk": [
    { code: "3bhk-5-9l", label: "₹5–9 Lakh" },
    { code: "3bhk-9-13l", label: "₹9–13 Lakh" },
    { code: "3bhk-13-16l", label: "₹13–16 Lakh" },
    { code: "3bhk-above-16l", label: "Above ₹16 Lakh" },
  ],
  villa: [
    { code: "villa-5-10l", label: "₹5–10 Lakh" },
    { code: "villa-10-15l", label: "₹10–15 Lakh" },
    { code: "villa-15-20l", label: "₹15–20 Lakh" },
    { code: "villa-above-20l", label: "Above ₹20 Lakh" },
  ],
};

/** Every budget code the intake accepts, in scope order. */
export const LEAD_BUDGET_RANGE_CODES: readonly string[] =
  LEAD_PROJECT_SCOPE_CODES.flatMap((scope) =>
    BUDGET_RANGES_BY_PROJECT_SCOPE[scope].map((option) => option.code)
  );

/* -------------------------------------------------------------------------- */
/* Guards                                                                      */
/* -------------------------------------------------------------------------- */

export function isLeadProjectScopeCode(
  value: unknown
): value is LeadProjectScopeCode {
  return (
    typeof value === "string" &&
    (LEAD_PROJECT_SCOPE_CODES as readonly string[]).includes(value)
  );
}

/** The budget ladder for a scope, or an empty list for anything else. */
export function budgetRangesForProjectScope(
  scope: unknown
): readonly LeadBudgetRangeOption[] {
  return isLeadProjectScopeCode(scope)
    ? BUDGET_RANGES_BY_PROJECT_SCOPE[scope]
    : [];
}

/**
 * Whether a budget belongs to THAT scope.
 *
 * The pairing is the check, not the membership: `villa-above-20l` is a real
 * budget code and still nonsense on a kitchen enquiry. Both layers call this,
 * which is what stops a forged combination from being accepted anywhere.
 */
export function isBudgetRangeForScope(scope: unknown, budget: unknown): boolean {
  if (typeof budget !== "string" || budget === "") {
    return false;
  }
  return budgetRangesForProjectScope(scope).some(
    (option) => option.code === budget
  );
}

/** The one service a scope implies. Null for anything that is not a scope. */
export function serviceForProjectScope(scope: unknown): LeadServiceCode | null {
  return isLeadProjectScopeCode(scope)
    ? SERVICE_BY_PROJECT_SCOPE[scope]
    : null;
}

/**
 * The scope a `?service=` deep link implies — when it implies exactly one.
 *
 * `public-nav.ts` links each service to `/?service=<code>#consultation`, and
 * that preselection should survive the form change where it can do so
 * truthfully. It can for exactly one service:
 *
 *   modular-kitchens         -> kitchen          (one scope, unambiguous)
 *   complete-home-interiors  -> null             (1/2/3 BHK and villa all map
 *                                                 to it; picking one would be
 *                                                 answering for the visitor)
 *   custom-wardrobes         -> null             (no scope on this form)
 *
 * Returning null is the honest answer for the other two: the requirement stays
 * unselected and the visitor chooses. Guessing would put a project size in CRM
 * that nobody picked, which is the failure this whole contract exists to avoid.
 */
export function projectScopeForServiceDeepLink(
  service: string | null | undefined
): LeadProjectScopeCode | null {
  return service === "modular-kitchens" ? "kitchen" : null;
}

/** Display label for a stored budget code, for CRM and analytics surfaces. */
export function budgetRangeLabel(scope: unknown, budget: unknown): string | null {
  const match = budgetRangesForProjectScope(scope).find(
    (option) => option.code === budget
  );
  return match ? match.label : null;
}

/*
 * A cheap invariant, checked once at module load rather than trusted.
 *
 * Every service a scope maps to must be a real service code. If someone adds a
 * scope and mistypes its service, this throws at import — in a test, in the dev
 * server and in the build — instead of at the RPC on a real customer's lead.
 */
for (const scope of LEAD_PROJECT_SCOPE_CODES) {
  const service = SERVICE_BY_PROJECT_SCOPE[scope];
  if (!(LEAD_SERVICE_CODES as readonly string[]).includes(service)) {
    throw new Error(
      `[ONEDECORE lead-intake] Project scope "${scope}" maps to unknown service "${service}".`
    );
  }
  if (BUDGET_RANGES_BY_PROJECT_SCOPE[scope].length === 0) {
    throw new Error(
      `[ONEDECORE lead-intake] Project scope "${scope}" has no budget ladder.`
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Form copy                                                                   */
/* -------------------------------------------------------------------------- */

export const REQUIREMENT_LABEL = "What are you looking for?";
export const REQUIREMENT_PLACEHOLDER = "Select your requirement";

export const BUDGET_LABEL = "What's your approximate budget?";
/** Shown while the budget select is disabled — it explains the disabled state. */
export const BUDGET_LOCKED_PLACEHOLDER = "Select service first";
export const BUDGET_PLACEHOLDER = "Select your budget range";

export const AREA_LABEL = "Area in Pune";
export const AREA_OPTIONAL_SUFFIX = "Optional";
export const AREA_PLACEHOLDER = "e.g. Kharadi";

export const NAME_LABEL = "Your name";
export const NAME_PLACEHOLDER = "Enter your name";

export const MOBILE_LABEL = "Mobile number";
export const MOBILE_PLACEHOLDER = "Enter mobile number";

export const SUBMIT_LABEL = "Get Verified Quotes";
