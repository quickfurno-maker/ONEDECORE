/**
 * Pure adapter: planner snapshot + form fields → LeadIntakeRequestBody.
 * Browser must not supply source, actor, timestamps, internal IDs, hashes, status, or assignment.
 */

import type { PlanSnapshot } from "../../public-site/home-r4/plan-state.ts";
import type { LeadIntakeRequestBody } from "../contracts.ts";
import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_INTAKE_NOTICE_VERSION,
  LEAD_INTAKE_PLANNER_VERSION,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
  SERVICE_COMMUNICATION_COPY_VERSION,
  SERVICE_ENQUIRY_COPY_VERSION,
  WHATSAPP_COPY_VERSION,
  type LeadBudgetComfortCode,
  type LeadPropertyCode,
  type LeadRoomCode,
  type LeadServiceCode,
  type LeadTimelineCode,
} from "../contracts.ts";
import type { LeadFormAttribution } from "./lead-form-attribution.ts";

export interface PlanToLeadFormInput {
  readonly plan: PlanSnapshot;
  readonly name: string;
  readonly mobile: string;
  readonly email?: string;
  readonly locality?: string;
  readonly message?: string;
  readonly consent: {
    readonly serviceEnquiry: true;
    readonly servicePhone: true;
    readonly serviceEmail?: true;
    readonly whatsappService?: boolean;
  };
  readonly attribution: LeadFormAttribution;
  readonly antiBot: {
    readonly website: string;
    readonly formStartedAt: string;
  };
  readonly idempotencyKey: string;
}

export type PlanToLeadRequestResult =
  | { readonly ok: true; readonly body: LeadIntakeRequestBody }
  | { readonly ok: false; readonly fields: readonly string[] };

function isAllowed<T extends string>(
  value: string | null | undefined,
  allowlist: readonly T[]
): value is T {
  return value != null && (allowlist as readonly string[]).includes(value);
}

export function planToLeadRequest(
  input: PlanToLeadFormInput
): PlanToLeadRequestResult {
  const fields: string[] = [];

  if (!isAllowed(input.plan.service, LEAD_SERVICE_CODES)) {
    fields.push("requirements.service");
  }
  if (!isAllowed(input.plan.property, LEAD_PROPERTY_CODES)) {
    fields.push("requirements.property");
  }
  if (!isAllowed(input.plan.timeline, LEAD_TIMELINE_CODES)) {
    fields.push("requirements.timeline");
  }

  const rooms: LeadRoomCode[] = [];
  for (const room of input.plan.rooms) {
    if (!isAllowed(room, LEAD_ROOM_CODES)) {
      fields.push("requirements.rooms");
      break;
    }
    if (!rooms.includes(room as LeadRoomCode)) {
      rooms.push(room as LeadRoomCode);
    }
  }
  if (rooms.length > 6) {
    fields.push("requirements.rooms");
  }

  let budgetComfort: LeadBudgetComfortCode | undefined;
  if (input.plan.budgetComfort != null) {
    if (isAllowed(input.plan.budgetComfort, LEAD_BUDGET_COMFORT_CODES)) {
      budgetComfort = input.plan.budgetComfort;
    } else {
      fields.push("requirements.budgetComfort");
    }
  }

  const trimmedEmail = input.email?.trim();
  const hasEmail = Boolean(trimmedEmail);
  const emailConsent = input.consent.serviceEmail === true;

  if (hasEmail && !emailConsent) {
    fields.push("consent.serviceChannels.email");
    fields.push("contact.email");
  }
  if (!hasEmail && emailConsent) {
    fields.push("consent.serviceChannels.email");
  }

  if (fields.length > 0) {
    return { ok: false, fields: [...new Set(fields)] };
  }

  const whatsappService = input.consent.whatsappService === true;

  const body: LeadIntakeRequestBody = {
    idempotencyKey: input.idempotencyKey,
    plannerVersion: LEAD_INTAKE_PLANNER_VERSION,
    contact: {
      name: input.name.trim(),
      mobile: input.mobile.trim(),
      ...(hasEmail ? { email: trimmedEmail!.toLowerCase() } : {}),
    },
    requirements: {
      service: input.plan.service as LeadServiceCode,
      property: input.plan.property as LeadPropertyCode,
      timeline: input.plan.timeline as LeadTimelineCode,
      rooms,
      ...(budgetComfort ? { budgetComfort } : {}),
      ...(input.locality?.trim()
        ? { locality: input.locality.trim() }
        : {}),
      ...(input.message?.trim() ? { message: input.message.trim() } : {}),
    },
    consent: {
      serviceEnquiry: true,
      serviceChannels: {
        phone: true,
        ...(hasEmail && emailConsent ? { email: true as const } : {}),
      },
      ...(whatsappService ? { whatsappService: true } : {}),
      serviceEnquiryCopyVersion: SERVICE_ENQUIRY_COPY_VERSION,
      serviceCommunicationCopyVersion: SERVICE_COMMUNICATION_COPY_VERSION,
      ...(whatsappService
        ? { whatsappCopyVersion: WHATSAPP_COPY_VERSION }
        : {}),
      noticeVersion: LEAD_INTAKE_NOTICE_VERSION,
    },
    attribution: input.attribution,
    antiBot: input.antiBot,
  };

  return { ok: true, body };
}
