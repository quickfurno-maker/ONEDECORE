/**
 * The premium requirement form -> a `public-consult-v3` intake request.
 *
 * WHAT THIS FILE IS FOR
 *
 * It is the one place that knows how the form's four answers become a lead
 * request, and it refuses rather than repairs. If the scope is missing, or the
 * budget belongs to a different scope, or consent was not given, it returns the
 * field paths that are wrong — it does not pick a default, and it does not drop
 * the offending value and send the rest.
 *
 * WHY IT DERIVES THE SERVICE
 *
 * "2 BHK" is a project scope, not a service. The service is computed from the
 * scope by `serviceForProjectScope`, the same function the server validator and
 * the SQL both agree with, so the three cannot drift. Nothing here trusts a
 * service the caller supplies, because there is nowhere for the caller to
 * supply one.
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
  PUBLIC_CONSULT_V3_PLANNER_VERSION,
  SINGLE_CONSENT_SERVICE_COMMUNICATION_COPY_VERSION,
  SINGLE_CONSENT_SERVICE_ENQUIRY_COPY_VERSION,
  type LeadIntakeRequestBody,
} from "../contracts.ts";
import {
  isBudgetRangeForScope,
  isLeadProjectScopeCode,
  serviceForProjectScope,
} from "../project-scope.ts";
import { acceptIndianMobileInput } from "./indian-mobile.ts";
import { LEAD_FORM_FIELD_LIMITS } from "./lead-form-contract.ts";
import type { LeadFormAttribution } from "./lead-form-attribution.ts";

export interface RequirementFormInput {
  readonly projectScope: string;
  readonly budgetRange: string;
  readonly area: string;
  readonly name: string;
  readonly mobile: string;
  readonly consent: boolean;
  readonly attribution: LeadFormAttribution;
  readonly antiBot: { readonly website: string; readonly formStartedAt: string };
  readonly idempotencyKey: string;
}

export type RequirementToLeadResult =
  | { readonly ok: true; readonly body: LeadIntakeRequestBody }
  | { readonly ok: false; readonly fields: readonly string[] };

export function requirementToLeadRequest(
  input: RequirementFormInput
): RequirementToLeadResult {
  const fields: string[] = [];

  /*
   * Narrowed here rather than cast later. `scope` stays null when the value is
   * not one of the five, which is what makes the `service` lookup below total
   * instead of a cast that would launder a bad value into a typed one.
   */
  const scope = isLeadProjectScopeCode(input.projectScope)
    ? input.projectScope
    : null;
  if (scope === null) {
    fields.push("requirements.projectScope");
  }

  /*
   * The budget is checked AGAINST the scope, not merely for membership. Both
   * the 2 BHK and 3 BHK ladders end in "Above ₹16 Lakh"; only the pairing tells
   * them apart, and only the pairing catches a stale value left over from a
   * scope the visitor has since changed.
   */
  if (!isBudgetRangeForScope(scope, input.budgetRange)) {
    fields.push("requirements.budgetRange");
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

  if (fields.length > 0) {
    return { ok: false, fields };
  }

  const service = scope === null ? null : serviceForProjectScope(scope);
  if (scope === null || service === null) {
    // Unreachable: the guard above already returned. Kept because the compiler
    // is right that it cannot know that, and a cast here would be a lie.
    return { ok: false, fields: ["requirements.projectScope"] };
  }

  return {
    ok: true,
    body: {
      idempotencyKey: input.idempotencyKey,
      plannerVersion: PUBLIC_CONSULT_V3_PLANNER_VERSION,
      contact: { name, mobile: mobile.ok ? mobile.national : "" },
      requirements: {
        service,
        projectScope: scope,
        budgetRange: input.budgetRange,
        // Omitted rather than sent empty: a blank locality is not an answer of
        // "" , it is the absence of one.
        ...(area.length > 0 ? { locality: area } : {}),
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
