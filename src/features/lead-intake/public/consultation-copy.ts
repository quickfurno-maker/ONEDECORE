/**
 * The public consultation form's questions — one per service, and no others.
 *
 * WHY THIS EXISTS
 *
 * The form used to ask every visitor for BHK and a timeline. That is a sensible
 * question for a complete-home enquiry and a nonsensical one for a kitchen:
 * "how many BHK is your kitchen?" is the kind of question that makes a serious
 * visitor close the tab, and it produced CRM rows full of answers nobody meant.
 *
 * So the qualifier is chosen BY SERVICE. Each entry below is the single
 * question that service actually needs, in customer language rather than
 * cabinetry jargon.
 */

import type {
  LeadQualifierKind,
  LeadServiceCode,
} from "../planner-allowlist.ts";

export interface ConsultationOption {
  readonly value: string;
  readonly label: string;
}

export interface ConsultationQualifier {
  readonly kind: LeadQualifierKind;
  readonly label: string;
  readonly placeholder: string;
  readonly options: readonly ConsultationOption[];
}

export const CONSULTATION_SERVICE_OPTIONS: readonly ConsultationOption[] = [
  { value: "complete-home-interiors", label: "Complete Home Interiors" },
  { value: "modular-kitchens", label: "Modular Kitchen" },
  { value: "custom-wardrobes", label: "Custom Wardrobe" },
];

/**
 * There is deliberately no "Not sure — help me choose" SERVICE option.
 *
 * `leads.service_code` is allowlisted to the three real services, and mapping
 * an unsure visitor onto "Complete Home Interiors" would put a service in CRM
 * that the customer never chose. Until a generic consultation service code
 * exists, the helper line below carries that reassurance instead — the "unsure"
 * escape hatch lives inside each QUALIFIER, where it can be recorded truthfully.
 */
export const CONSULTATION_SERVICE_LABEL = "What are you planning?";
export const CONSULTATION_SERVICE_PLACEHOLDER = "Choose a service";
export const CONSULTATION_SERVICE_HELP =
  "Not sure which one fits? Pick the closest — you can tell our designer more on the call.";

export const CONSULTATION_QUALIFIERS: Readonly<
  Record<LeadServiceCode, ConsultationQualifier>
> = {
  "complete-home-interiors": {
    kind: "home-size",
    // BHK belongs HERE and only here: it is a real property question for a
    // whole-home project.
    label: "What kind of home are we planning?",
    placeholder: "Choose your home type",
    options: [
      { value: "apartment-1bhk", label: "1 BHK apartment" },
      { value: "apartment-2bhk", label: "2 BHK apartment" },
      { value: "apartment-3bhk", label: "3 BHK apartment" },
      { value: "apartment-4bhk-plus", label: "4 BHK or larger" },
      { value: "villa-rowhouse", label: "Villa / row house" },
      { value: "unsure", label: "Not sure — need designer help" },
    ],
  },
  "modular-kitchens": {
    kind: "kitchen-scope",
    label: "What do you need for your kitchen?",
    placeholder: "Choose your kitchen requirement",
    options: [
      { value: "new-kitchen", label: "New modular kitchen" },
      { value: "renovate-existing", label: "Replace / renovate existing kitchen" },
      { value: "kitchen-with-utility", label: "Kitchen + utility" },
      { value: "unsure", label: "Not sure — need designer help" },
    ],
  },
  "custom-wardrobes": {
    kind: "wardrobe-count",
    label: "How many wardrobes are you planning?",
    placeholder: "Choose an option",
    options: [
      { value: "one", label: "1 wardrobe" },
      { value: "two", label: "2 wardrobes" },
      { value: "three", label: "3 wardrobes" },
      { value: "four-plus", label: "4 or more wardrobes" },
      { value: "unsure", label: "Not sure — need designer help" },
    ],
  },
};

export const CONSULTATION_INTRO_TITLE = "Tell us what you're planning";
export const CONSULTATION_INTRO_HELP =
  "Two quick choices, then your contact details.";

export const CONSULTATION_CONTACT_LABEL = "How can we reach you?";
export const CONSULTATION_NOTE_LABEL = "Add a note";
export const CONSULTATION_STEPS = ["Project", "Requirement", "Contact"] as const;

/** Resolves the one qualifier a service asks for, or null before a choice. */
export function qualifierForService(
  service: string | null
): ConsultationQualifier | null {
  if (!service) {
    return null;
  }
  return (
    CONSULTATION_QUALIFIERS[service as LeadServiceCode] ?? null
  );
}
