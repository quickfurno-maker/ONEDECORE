/**
 * WM-2 — Template Studio and template picker DTOs, action states and the
 * provider port shapes. Pure: no server import, no environment, no secret.
 *
 * The read models return `jsonb`, which the generated types can only call
 * `Json`. The parsers below are the one place those payloads are checked, so a
 * drift between SQL and UI fails loudly instead of rendering `undefined`.
 */

import {
  normalizeWhatsappTemplateCategory,
  normalizeWhatsappTemplateQualityRating,
  normalizeWhatsappTemplateStatus,
} from "./template-registry.ts";
import {
  readWhatsappTemplateTextParts,
  type WhatsappTemplateTextParts,
  type WhatsappTemplateVariable,
} from "./template-components.ts";

/* ----------------------------------------------------------------- modes */

export const WHATSAPP_TEMPLATE_MANAGEMENT_MODES = ["disabled", "local-test", "enabled"] as const;
export type WhatsappTemplateManagementMode = (typeof WHATSAPP_TEMPLATE_MANAGEMENT_MODES)[number];

/** How Template Studio reaches Meta here, in words. Never an account id. */
export type WhatsappTemplateManagementStatusView = {
  readonly mode: WhatsappTemplateManagementMode;
  readonly tone: "live" | "test" | "off";
  readonly label: string;
  readonly detail: string;
  /** True when sync/create actions can run in this environment. */
  readonly actionsAvailable: boolean;
};

/* -------------------------------------------------------------- registry */

export type WhatsappTemplateRegistryItem = {
  readonly id: string;
  readonly name: string;
  readonly language: string;
  readonly category: string;
  readonly rawCategory: string | null;
  readonly status: string;
  readonly rawStatus: string | null;
  readonly qualityRating: string | null;
  readonly rawQualityRating: string | null;
  readonly parameterFormat: string | null;
  readonly providerTemplateId: string | null;
  readonly origin: string;
  readonly rejectedReason: string | null;
  readonly syncedAt: string | null;
  readonly updatedAt: string | null;
  readonly bodyPreview: string | null;
  readonly variableCount: number;
  readonly sendProblem: string | null;
  readonly approvedSnapshotId: string | null;
  readonly oneToOneSendable: boolean;
};

export type WhatsappTemplateRegistryPage = {
  readonly items: readonly WhatsappTemplateRegistryItem[];
  readonly totalCount: number;
  readonly page: number;
  readonly pageSize: number;
};

export const WHATSAPP_TEMPLATE_REGISTRY_STATUS_FILTERS = [
  "APPROVED",
  "PENDING",
  "REJECTED",
  "PAUSED",
  "DISABLED",
  "IN_APPEAL",
  "PENDING_DELETION",
  "DELETED",
  "LIMIT_EXCEEDED",
  "ARCHIVED",
  "unknown",
] as const;

export const WHATSAPP_TEMPLATE_REGISTRY_CATEGORY_FILTERS = [
  "UTILITY",
  "MARKETING",
  "AUTHENTICATION",
  "unknown",
] as const;

export type WhatsappTemplateRegistryQuery = {
  readonly status: (typeof WHATSAPP_TEMPLATE_REGISTRY_STATUS_FILTERS)[number] | null;
  readonly category: (typeof WHATSAPP_TEMPLATE_REGISTRY_CATEGORY_FILTERS)[number] | null;
  readonly q: string | null;
  readonly page: number;
  readonly pageSize: number;
};

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseWhatsappTemplateRegistryQuery(
  params: Record<string, string | string[] | undefined>
): WhatsappTemplateRegistryQuery {
  const status = first(params.status);
  const category = first(params.category);
  const q = first(params.q)?.trim().slice(0, 128) ?? "";
  const page = Number.parseInt(first(params.page) ?? "1", 10);
  return {
    status: (WHATSAPP_TEMPLATE_REGISTRY_STATUS_FILTERS as readonly string[]).includes(status ?? "")
      ? (status as WhatsappTemplateRegistryQuery["status"])
      : null,
    category: (WHATSAPP_TEMPLATE_REGISTRY_CATEGORY_FILTERS as readonly string[]).includes(category ?? "")
      ? (category as WhatsappTemplateRegistryQuery["category"])
      : null,
    q: q.length > 0 ? q : null,
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    pageSize: 25,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function parseWhatsappTemplateRegistryPayload(payload: unknown): WhatsappTemplateRegistryPage {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error("template registry returned an unexpected payload");
  }
  const totalCount = Number(payload.total_count);
  if (!Number.isInteger(totalCount) || totalCount < 0) {
    throw new Error("template registry returned an invalid total_count");
  }
  const items = payload.items.map((row): WhatsappTemplateRegistryItem => {
    if (!isRecord(row) || typeof row.id !== "string" || typeof row.name !== "string") {
      throw new Error("template registry returned an invalid row");
    }
    return {
      id: row.id,
      name: row.name,
      language: str(row.language) ?? "",
      // Re-normalised on read: a value the UI does not know is shown as unknown.
      category: normalizeWhatsappTemplateCategory(row.category).value,
      rawCategory: str(row.raw_category),
      status: normalizeWhatsappTemplateStatus(row.status).value,
      rawStatus: str(row.raw_status),
      qualityRating: row.quality_rating == null ? null : normalizeWhatsappTemplateQualityRating(row.quality_rating).value,
      rawQualityRating: str(row.raw_quality_rating),
      parameterFormat: str(row.parameter_format),
      providerTemplateId: str(row.provider_template_id),
      origin: str(row.origin) ?? "provider_sync",
      rejectedReason: str(row.rejected_reason),
      syncedAt: str(row.synced_at),
      updatedAt: str(row.updated_at),
      bodyPreview: str(row.body_preview),
      variableCount: Number.isInteger(Number(row.variable_count)) ? Number(row.variable_count) : 0,
      sendProblem: str(row.send_problem),
      approvedSnapshotId: str(row.approved_snapshot_id),
      oneToOneSendable: row.one_to_one_sendable === true,
    };
  });
  return {
    items,
    totalCount,
    page: Number(payload.page) || 1,
    pageSize: Number(payload.page_size) || items.length,
  };
}

/* ---------------------------------------------------------------- picker */

export type WhatsappSendableTemplateView = {
  readonly snapshotId: string;
  readonly templateId: string;
  readonly name: string;
  readonly language: string;
  readonly parameterFormat: string | null;
  readonly components: readonly unknown[];
  readonly text: WhatsappTemplateTextParts;
  readonly variables: readonly WhatsappTemplateVariable[];
};

export function parseWhatsappSendableTemplatesPayload(payload: unknown): readonly WhatsappSendableTemplateView[] {
  if (!isRecord(payload) || !Array.isArray(payload.items)) {
    throw new Error("sendable templates returned an unexpected payload");
  }
  return payload.items.map((row): WhatsappSendableTemplateView => {
    if (
      !isRecord(row) ||
      typeof row.snapshot_id !== "string" ||
      typeof row.template_id !== "string" ||
      typeof row.name !== "string" ||
      !Array.isArray(row.components) ||
      !Array.isArray(row.variables)
    ) {
      throw new Error("sendable templates returned an invalid row");
    }
    const variables = row.variables.map((v): WhatsappTemplateVariable => {
      if (!isRecord(v) || (v.component !== "header" && v.component !== "body") || typeof v.key !== "string") {
        throw new Error("sendable templates returned an invalid variable");
      }
      return { component: v.component, key: v.key, maxLength: Number(v.max_length) || 60 };
    });
    return {
      snapshotId: row.snapshot_id,
      templateId: row.template_id,
      name: row.name,
      language: str(row.language) ?? "",
      parameterFormat: str(row.parameter_format),
      components: row.components,
      text: readWhatsappTemplateTextParts(row.components),
      variables,
    };
  });
}

/* --------------------------------------------------------- action states */

export type WhatsappTemplateSendActionState = {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly intentId?: string;
  readonly dispatchOutcome?: string;
};

export const INITIAL_WHATSAPP_TEMPLATE_SEND_ACTION_STATE: WhatsappTemplateSendActionState = {
  success: false,
  message: "",
};

export type WhatsappTemplateStudioActionState = {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly field?: string;
};

export const INITIAL_WHATSAPP_TEMPLATE_STUDIO_ACTION_STATE: WhatsappTemplateStudioActionState = {
  success: false,
  message: "",
};

/** Form field name for one picker variable: `param:body:1`. */
export function whatsappTemplateParameterFieldName(variable: WhatsappTemplateVariable): string {
  return `param:${variable.component}:${variable.key}`;
}

/* ------------------------------------------------ provider port payloads */

/** One template as the provider reports it, already bounded by the adapter. */
export type WhatsappProviderTemplateRecord = {
  readonly providerTemplateId: string;
  readonly name: string;
  readonly language: string;
  readonly rawStatus: string | null;
  readonly rawCategory: string | null;
  readonly rawQualityRating: string | null;
  readonly parameterFormat: string | null;
  readonly components: readonly unknown[];
  readonly rejectedReason: string | null;
};

export type WhatsappProviderCallFailure = {
  readonly kind: "failed";
  readonly errorClass: "transient" | "terminal";
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number | null;
};

export type WhatsappProviderCallAmbiguous = {
  readonly kind: "ambiguous";
  readonly code: string;
  readonly message: string;
  readonly httpStatus: number | null;
};

export type WhatsappTemplateListResult =
  | {
      readonly kind: "success";
      readonly templates: readonly WhatsappProviderTemplateRecord[];
      /** Provider rows dropped because they were malformed or over the size bound. */
      readonly skipped: number;
      /** True when paging stopped at the page bound before the provider ran out. */
      readonly truncated: boolean;
    }
  | WhatsappProviderCallFailure;

export type WhatsappTemplateGetResult =
  | { readonly kind: "success"; readonly template: WhatsappProviderTemplateRecord }
  | WhatsappProviderCallFailure;

export type WhatsappTemplateCreateResult =
  | {
      readonly kind: "success";
      readonly providerTemplateId: string;
      readonly rawStatus: string | null;
      readonly rawCategory: string | null;
      readonly httpStatus: number;
    }
  | WhatsappProviderCallFailure
  | WhatsappProviderCallAmbiguous;

export type WhatsappTemplateCreateRequest = {
  readonly wabaId: string;
  readonly name: string;
  readonly language: string;
  readonly category: string;
  readonly parameterFormat: string;
  readonly components: readonly unknown[];
};

export type WhatsappTemplateMessageDispatchRequest = {
  readonly phoneNumberId: string;
  readonly customerE164: string;
  readonly templateName: string;
  readonly templateLanguage: string;
  /** Built and validated in SQL; the adapter only wraps it. */
  readonly components: readonly unknown[];
  readonly providerAttemptKey: string;
};

/** A claim row from `public.claim_whatsapp_template_send_intent`. */
export type WhatsappTemplateClaimRow = {
  readonly outcome_code: string;
  readonly intent_id: string | null;
  readonly dispatch_attempt_id: string | null;
  readonly phone_number_id: string | null;
  readonly customer_e164: string | null;
  readonly template_name: string | null;
  readonly template_language: string | null;
  readonly send_components: unknown;
};

export type WhatsappTemplateDispatchServiceResult = {
  readonly outcome:
    | "disabled"
    | "bound"
    | "already_bound"
    | "in_flight"
    | "needs_reconcile"
    | "ineligible"
    | "not_claimable"
    | "failed"
    | "ambiguous";
  readonly intentId: string;
  readonly reason?: string;
  readonly providerMessageId?: string;
  readonly message: string;
};

/** Staff-facing words for a refusal code from the gate. Never a raw SQL error. */
export function describeWhatsappTemplateRefusal(code: string | null | undefined): string {
  switch (code) {
    case "denied_scope":
      return "This conversation is no longer yours to send in. It may have been reassigned or closed.";
    case "template_not_approved":
      return "This template is no longer approved by WhatsApp. Sync templates and try again.";
    case "template_content_changed":
      return "This template changed since you opened it. Reload the conversation to use the current version.";
    case "template_category_not_utility":
      return "Only UTILITY templates can be sent one-to-one. Marketing templates go through campaigns.";
    case "template_parameters_unsupported":
      return "This template needs media or button parameters, which the inbox cannot send yet.";
    case "template_parameters_invalid":
      return "The template values are not valid for this template.";
    case "template_snapshot_missing":
      return "This template has no approved version to send.";
    case "template_account_mismatch":
      return "This template belongs to a different WhatsApp Business Account.";
    case "denied_missing_consent":
      return "The customer has not given WhatsApp service consent.";
    case "denied_dnc":
      return "The customer is marked do-not-contact.";
    case "denied_channel_suppressed":
      return "This WhatsApp number is suppressed.";
    case "denied_lead_deleted":
      return "The lead for this conversation was deleted. History stays readable; nobody can send.";
    case "denied_missing_contact":
    case "denied_missing_whatsapp_channel":
    case "denied_channel_inactive":
    case "denied_contact_inactive":
      return "The customer's WhatsApp contact details are not active.";
    case "denied_sender_unresolvable":
      return "The business phone number is not configured with a valid E.164 number.";
    default:
      return "The template could not be sent.";
  }
}
