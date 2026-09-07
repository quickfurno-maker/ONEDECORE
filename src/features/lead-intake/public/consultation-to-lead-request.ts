/**
 * Pure adapter: the simplified public consultation form → LeadIntakeRequestBody.
 *
 * THE RULE THIS ENFORCES
 *
 * The body carries what the customer actually answered and nothing else. There
 * is no default BHK, no guessed timeline, no room checklist and no budget band,
 * because the form does not ask for any of them — and inventing one to satisfy
 * the older contract is precisely the CRM pollution this variant exists to
 * prevent.
 *
 * As of L1.1 the qualifier joins that list: the homepage form is one card with
 * one service dropdown, so the qualifier is usually absent. It stays strictly
 * validated when it IS present.
 *
 * `public-consult-v2` is a DISCRIMINATOR, not a loosening. `home-r4-v1` stays
 * strict about property, timeline and rooms; `public-consult-v1` stays strict
 * about the qualifier it asks for; and v2 — which asks for neither — is strict
 * about all of them being ABSENT.
 *
 * That last part is the reason v2 exists at all. The single-step form asks no
 * service-specific question, and the SQL for v1 raises `qualifier_required`. A
 * form that sent v1 without a qualifier would pass every TypeScript test and
 * fail every real lead at the database.
 */

import {
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_SERVICE_CODES,
  PUBLIC_CONSULT_V2_PLANNER_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
  type LeadServiceCode,
} from "../contracts.ts";
import type { LeadIntakeRequestBody } from "../contracts.ts";
import type { LeadFormAttribution } from "./lead-form-attribution.ts";

export interface ConsultationToLeadInput {
  readonly service: string | null;
  readonly qualifierCode: string | null;
  readonly name: string;
  readonly mobile: string;
  readonly locality?: string;
  readonly message?: string;
  readonly consent: {
    readonly serviceEnquiry: true;
    readonly servicePhone: true;
    readonly whatsappService?: boolean;
  };
  readonly attribution: LeadFormAttribution;
  readonly antiBot: {
    readonly website: string;
    readonly formStartedAt: string;
  };
  readonly idempotencyKey: string;
}

export type ConsultationToLeadResult =
  | { readonly ok: true; readonly body: LeadIntakeRequestBody }
  | { readonly ok: false; readonly fields: readonly string[] };

export function consultationToLeadRequest(
  input: ConsultationToLeadInput
): ConsultationToLeadResult {
  const fields: string[] = [];

  const service = input.service ?? "";
  const isService = (LEAD_SERVICE_CODES as readonly string[]).includes(service);
  if (!isService) {
    fields.push("requirements.service");
  }

  /*
   * UNDER v2 A QUALIFIER IS NOT OPTIONAL — IT IS FORBIDDEN.
   *
   * The single-step form asks no service-specific question, so a qualifier in
   * the payload was never on screen. Accepting it would store an answer no
   * customer gave; dropping it silently would let the caller believe it was
   * stored. Both are worse than refusing, and the SQL refuses it too.
   */
  const code = input.qualifierCode?.trim() ?? "";
  if (code.length > 0) {
    fields.push("requirements.qualifier");
  }

  if (fields.length > 0) {
    return { ok: false, fields: [...new Set(fields)] };
  }

  const whatsappService = input.consent.whatsappService === true;
  const locality = input.locality?.trim();
  const message = input.message?.trim();

  const body: LeadIntakeRequestBody = {
    idempotencyKey: input.idempotencyKey,
    plannerVersion: PUBLIC_CONSULT_V2_PLANNER_VERSION,
    contact: {
      name: input.name.trim(),
      mobile: input.mobile.trim(),
    },
    requirements: {
      service: service as LeadServiceCode,
      // NOTE what is absent: the qualifier, along with property, timeline,
      // rooms, budgetComfort and estimate. The form asked for none of them, so
      // the request claims none of them.
      // NOTE what is absent: property, timeline, rooms, budgetComfort and
      // estimate. The form never asked, so the request never claims.
      ...(locality ? { locality } : {}),
      ...(message ? { message } : {}),
    },
    consent: {
      serviceEnquiry: true,
      serviceChannels: { phone: true },
      ...(whatsappService ? { whatsappService: true } : {}),
      serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
      serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
      ...(whatsappService ? { whatsappCopyVersion: WHATSAPP_COPY_VERSION } : {}),
      noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
    },
    attribution: input.attribution,
    antiBot: input.antiBot,
  };

  return { ok: true, body };
}
