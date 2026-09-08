/**
 * The unified multi-step public form -> a `public-consult-v4` intake request.
 *
 * WHAT THIS FILE IS FOR
 *
 * The site has one lead form. Every CTA opens the same sheet, the sheet asks
 * Service -> Home -> Timeline -> Brief, and this is the one place that turns
 * those answers into a request body. Like its v3 predecessor it REFUSES rather
 * than repairs: a missing scope, a budget from the wrong ladder, a timeline
 * that is not in the vocabulary, or an ungiven consent comes back as a list of
 * field paths. It never picks a default and it never drops the offending value
 * and sends the rest.
 *
 * WHY THE SERVICE IS NOT ALWAYS DERIVED
 *
 * v3 derived the service from the scope, because the scope was the only thing
 * its form asked. This form asks for the service FIRST — that is step one — and
 * then asks a scope question shaped by it. So the service is taken from the
 * visitor, and the scope is checked against it with `serviceForProjectScope`,
 * the same function the server validator and the SQL agree with. Same
 * invariant, checked from the other end.
 *
 * THE WARDROBE EXCEPTION
 *
 * There is no scope list that describes a wardrobe job and no owner-approved
 * wardrobe budget ladder, so the form does not ask for either when the service
 * is `custom-wardrobes`. Their ABSENCE is then required, exactly as their
 * presence is required for the other two services. Sending an invented scope
 * would be worse than sending none: `v4RequiresScope` is the single predicate,
 * shared with the validator, so the UI and the contract cannot disagree about
 * which services ask.
 *
 * CONSENT
 *
 * One checkbox, two required purposes, and the copy versions recorded are the
 * combined ones the visitor actually read. WhatsApp is optional, is not on this
 * form, and is therefore never sent — not `false`, absent. An absent optional
 * consent is a consent nobody was asked for; a `false` one implies a question
 * that was declined.
 */

import {
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
  PUBLIC_CONSULT_V4_PLANNER_VERSION,
  SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
  SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
  v4RequiresScope,
  type LeadIntakeRequestBody,
  type LeadServiceCode,
  type LeadTimelineCode,
} from "../contracts.ts";
import {
  isBudgetRangeForScope,
  isLeadProjectScopeCode,
  serviceForProjectScope,
} from "../project-scope.ts";
import { acceptIndianMobileInput } from "./indian-mobile.ts";
import { LEAD_FORM_FIELD_LIMITS } from "./lead-form-contract.ts";
import type { LeadFormAttribution } from "./lead-form-attribution.ts";

export interface UnifiedLeadFormInput {
  readonly service: string | null;
  /** Absent for `custom-wardrobes`; required for the other two services. */
  readonly projectScope: string | null;
  readonly budgetRange: string | null;
  readonly timeline: string | null;
  readonly area: string;
  readonly message: string;
  readonly name: string;
  readonly mobile: string;
  readonly consent: boolean;
  readonly attribution: LeadFormAttribution;
  readonly antiBot: { readonly website: string; readonly formStartedAt: string };
  readonly idempotencyKey: string;
}

export type UnifiedLeadRequestResult =
  | { readonly ok: true; readonly body: LeadIntakeRequestBody }
  | { readonly ok: false; readonly fields: readonly string[] };

function isAllowed<T extends string>(
  value: string | null,
  allowlist: readonly T[]
): value is T {
  return value != null && (allowlist as readonly string[]).includes(value);
}

export function unifiedLeadToRequest(
  input: UnifiedLeadFormInput
): UnifiedLeadRequestResult {
  const fields: string[] = [];

  // Narrowed rather than cast: `service` stays null when the value is not one
  // of the three, which is what keeps the scope checks below honest.
  const service: LeadServiceCode | null = isAllowed(
    input.service,
    LEAD_SERVICE_CODES
  )
    ? input.service
    : null;
  if (service === null) {
    fields.push("requirements.service");
  }

  /*
   * `v4RequiresScope` — not a local list. Whether a service asks for a scope is
   * a contract fact, stated once in `contracts.ts` and consulted by the server
   * validator too. A second copy here is a second thing to forget to update.
   */
  const scopeAsked = service !== null && v4RequiresScope(service);

  const scope = isLeadProjectScopeCode(input.projectScope)
    ? input.projectScope
    : null;

  if (scopeAsked) {
    if (scope === null) {
      fields.push("requirements.projectScope");
    } else if (serviceForProjectScope(scope) !== service) {
      /*
       * A kitchen scope on a complete-home-interiors enquiry, or a 3 BHK on a
       * kitchen one. Both halves are individually valid; only the pair is
       * wrong, and only the pair catches a value left over from a service the
       * visitor has since changed.
       */
      fields.push("requirements.projectScope");
    }

    /*
     * The budget is checked AGAINST the scope, not merely for membership. Both
     * the 2 BHK and 3 BHK ladders end in "Above ₹16 Lakh"; only the pairing
     * tells them apart.
     */
    if (!isBudgetRangeForScope(scope, input.budgetRange)) {
      fields.push("requirements.budgetRange");
    }
  } else if (service !== null) {
    /*
     * Wardrobes. Absence is ENFORCED, not merely permitted — if a stale sheet
     * still holds a scope from a service the visitor switched away from, the
     * request is refused rather than quietly stripped. Stripping would send a
     * body that the visitor's answers do not support.
     */
    if (input.projectScope != null) fields.push("requirements.projectScope");
    if (input.budgetRange != null) fields.push("requirements.budgetRange");
  }

  /*
   * v4 is the one public version that ASKS for a timeline, and it takes the
   * vocabulary the legacy planner has always used rather than free text. v1,
   * v2 and v3 all forbid the field; that difference is the reason v4 exists.
   */
  const timeline: LeadTimelineCode | null = isAllowed(
    input.timeline,
    LEAD_TIMELINE_CODES
  )
    ? input.timeline
    : null;
  if (timeline === null) {
    fields.push("requirements.timeline");
  }

  const name = input.name.trim();
  if (name.length < 2 || name.length > LEAD_FORM_FIELD_LIMITS.nameMax) {
    fields.push("contact.name");
  }

  // The shared national-mobile helper, unchanged: this form does not get its
  // own idea of what an Indian mobile number is.
  const mobile = acceptIndianMobileInput(input.mobile);
  if (!mobile.ok) {
    fields.push("contact.mobile");
  }

  if (input.consent !== true) {
    fields.push("consent.serviceEnquiry");
  }

  const area = input.area.trim();
  if (area.length > LEAD_FORM_FIELD_LIMITS.localityMax) {
    fields.push("requirements.locality");
  }

  const message = input.message.trim();
  if (message.length > LEAD_FORM_FIELD_LIMITS.messageMax) {
    fields.push("requirements.message");
  }

  if (fields.length > 0) {
    return { ok: false, fields: [...new Set(fields)] };
  }

  if (service === null || timeline === null) {
    // Unreachable: the guard above already returned. Kept because the compiler
    // is right that it cannot know that, and a cast here would be a lie.
    return { ok: false, fields: ["requirements.service"] };
  }

  return {
    ok: true,
    body: {
      idempotencyKey: input.idempotencyKey,
      plannerVersion: PUBLIC_CONSULT_V4_PLANNER_VERSION,
      contact: { name, mobile: mobile.ok ? mobile.national : "" },
      requirements: {
        service,
        timeline,
        /*
         * Spread rather than sent as null. The contract distinguishes "this
         * service does not ask" from "asked and empty", and only omission says
         * the first.
         */
        ...(scopeAsked && scope !== null
          ? { projectScope: scope, budgetRange: input.budgetRange! }
          : {}),
        ...(area.length > 0 ? { locality: area } : {}),
        ...(message.length > 0 ? { message } : {}),
      },
      consent: {
        serviceEnquiry: true,
        serviceChannels: { phone: true },
        serviceEnquiryCopyVersion: SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
        serviceCommunicationCopyVersion:
          SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
        noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
      },
      attribution: input.attribution,
      antiBot: input.antiBot,
    },
  };
}
