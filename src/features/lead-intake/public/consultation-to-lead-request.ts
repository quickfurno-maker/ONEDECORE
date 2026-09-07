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
 * `public-consult-v1` is a DISCRIMINATOR, not a loosening: the server keeps
 * `home-r4-v1` strict about property, timeline and rooms, and holds this variant
 * strict about the qualifier instead.
 */

import {
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_SERVICE_CODES,
  PUBLIC_CONSULT_PLANNER_VERSION,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
  isAllowedLeadQualifier,
  LEAD_QUALIFIER_KIND_BY_SERVICE,
  type LeadQualifierCode,
  type LeadQualifierKind,
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

  // The kind is DERIVED from the service, never supplied by the browser, so a
  // wardrobe enquiry cannot carry a home-size answer even if the DOM is tampered
  // with. The server re-derives it identically.
  const kind: LeadQualifierKind | null = isService
    ? LEAD_QUALIFIER_KIND_BY_SERVICE[service as LeadServiceCode]
    : null;

  /*
   * THE QUALIFIER IS OPTIONAL (L1.1).
   *
   * The homepage form is a single compact card: one service dropdown, a name, a
   * number and an optional locality. It no longer asks a service-specific
   * question, so there is usually nothing to send.
   *
   * Optional does NOT mean unvalidated. If a qualifier does arrive — from the
   * interiors planner, or a deep link that preselects one — it must still be a
   * real code for the kind this service implies. An answer nobody was asked for
   * is rejected rather than stored, exactly as before.
   */
  const code = input.qualifierCode?.trim() ?? "";
  const hasQualifier = code.length > 0;
  if (hasQualifier && (!kind || !isAllowedLeadQualifier(kind, code))) {
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
    plannerVersion: PUBLIC_CONSULT_PLANNER_VERSION,
    contact: {
      name: input.name.trim(),
      mobile: input.mobile.trim(),
    },
    requirements: {
      service: service as LeadServiceCode,
      // Absent when unasked. Never a placeholder, never a guessed default.
      ...(hasQualifier
        ? { qualifier: { kind: kind!, code: code as LeadQualifierCode } }
        : {}),
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
