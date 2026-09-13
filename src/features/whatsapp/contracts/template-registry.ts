/**
 * WM-0 (ADR-0034) — Meta message template registry contracts. Migration-independent.
 *
 * `public.whatsapp_templates` (M18) already exists as metadata-only and has never
 * been synced. WM-2 extends it forward-only and adds immutable snapshots; it
 * does not create a competing registry.
 *
 * Provider vocabularies are open-ended: Meta adds categories, statuses and
 * component types over time. Every normaliser here keeps the raw value
 * (bounded) and maps anything unrecognised to `unknown`, and `unknown` is never
 * sendable. The Graph API version is configuration
 * (`META_WHATSAPP_GRAPH_API_VERSION`), never a constant in this file.
 */

export const WHATSAPP_TEMPLATE_CATEGORIES = [
  "MARKETING",
  "UTILITY",
  "AUTHENTICATION",
] as const;

export type WhatsappTemplateCategory =
  (typeof WHATSAPP_TEMPLATE_CATEGORIES)[number];

export const WHATSAPP_TEMPLATE_STATUSES = [
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
] as const;

export type WhatsappTemplateStatus = (typeof WHATSAPP_TEMPLATE_STATUSES)[number];

export const WHATSAPP_TEMPLATE_QUALITY_RATINGS = ["GREEN", "YELLOW", "RED"] as const;

export type WhatsappTemplateQualityRating =
  (typeof WHATSAPP_TEMPLATE_QUALITY_RATINGS)[number];

export const WHATSAPP_TEMPLATE_HEADER_FORMATS = [
  "TEXT",
  "IMAGE",
  "VIDEO",
  "DOCUMENT",
  "LOCATION",
] as const;

export type WhatsappTemplateHeaderFormat =
  (typeof WHATSAPP_TEMPLATE_HEADER_FORMATS)[number];

export const WHATSAPP_TEMPLATE_BUTTON_TYPES = [
  "QUICK_REPLY",
  "URL",
  "PHONE_NUMBER",
  "FLOW",
  "COPY_CODE",
] as const;

export type WhatsappTemplateButtonType =
  (typeof WHATSAPP_TEMPLATE_BUTTON_TYPES)[number];

export const WHATSAPP_TEMPLATE_PARAMETER_FORMATS = ["POSITIONAL", "NAMED"] as const;

export type WhatsappTemplateParameterFormat =
  (typeof WHATSAPP_TEMPLATE_PARAMETER_FORMATS)[number];

/** Longest raw provider string retained next to a normalised value. */
export const WHATSAPP_TEMPLATE_RAW_VALUE_MAX_LENGTH = 64;

export type RawSafe<T extends string> =
  | { readonly value: T; readonly raw: string }
  | { readonly value: "unknown"; readonly raw: string };

function normalizeOpen<T extends string>(
  known: readonly T[],
  raw: unknown
): RawSafe<T> {
  const text =
    typeof raw === "string"
      ? raw.trim().slice(0, WHATSAPP_TEMPLATE_RAW_VALUE_MAX_LENGTH)
      : "";
  const upper = text.toUpperCase();
  const match = known.find((candidate) => candidate === upper);
  return match ? { value: match, raw: text } : { value: "unknown", raw: text };
}

export function normalizeWhatsappTemplateCategory(
  raw: unknown
): RawSafe<WhatsappTemplateCategory> {
  return normalizeOpen(WHATSAPP_TEMPLATE_CATEGORIES, raw);
}

export function normalizeWhatsappTemplateStatus(
  raw: unknown
): RawSafe<WhatsappTemplateStatus> {
  return normalizeOpen(WHATSAPP_TEMPLATE_STATUSES, raw);
}

export function normalizeWhatsappTemplateQualityRating(
  raw: unknown
): RawSafe<WhatsappTemplateQualityRating> {
  return normalizeOpen(WHATSAPP_TEMPLATE_QUALITY_RATINGS, raw);
}

/** Only APPROVED is sendable. PAUSED, unknown and everything else fail closed. */
export function isWhatsappTemplateStatusSendable(
  status: RawSafe<WhatsappTemplateStatus>
): boolean {
  return status.value === "APPROVED";
}

/**
 * Which governed path a template send belongs to, by category *at send time*.
 *
 * MARKETING templates never go through the WHATSAPP_SERVICE send intent, even
 * one-to-one. AUTHENTICATION templates are system-originated (one-time codes)
 * and are not staff-sendable. Meta can recategorise an approved template, so
 * the category is re-read from the latest registry state immediately before
 * dispatch, not trusted from the snapshot alone.
 */
export type WhatsappTemplateSendPath =
  | {
      readonly allowed: true;
      readonly purposeCode: "WHATSAPP_SERVICE" | "MARKETING";
    }
  | {
      readonly allowed: false;
      readonly reason:
        | "template_category_not_staff_sendable"
        | "template_category_unknown";
    };

export function resolveWhatsappTemplateSendPath(
  category: RawSafe<WhatsappTemplateCategory>
): WhatsappTemplateSendPath {
  switch (category.value) {
    case "UTILITY":
      return { allowed: true, purposeCode: "WHATSAPP_SERVICE" };
    case "MARKETING":
      return { allowed: true, purposeCode: "MARKETING" };
    case "AUTHENTICATION":
      return { allowed: false, reason: "template_category_not_staff_sendable" };
    default:
      return { allowed: false, reason: "template_category_unknown" };
  }
}

export interface WhatsappTemplateVariableDefinition {
  /** "1", "2" … for POSITIONAL; a snake_case name for NAMED. */
  readonly key: string;
  readonly component: "HEADER" | "BODY" | "BUTTON";
  /** Button index when component is BUTTON. */
  readonly buttonIndex?: number;
  readonly maxLength: number;
}

export interface WhatsappTemplateVariableSchema {
  readonly parameterFormat: WhatsappTemplateParameterFormat;
  readonly variables: readonly WhatsappTemplateVariableDefinition[];
}

export type WhatsappTemplateVariableValidation =
  | { readonly ok: true }
  | {
      readonly ok: false;
      readonly missing: readonly string[];
      readonly invalid: readonly string[];
      readonly unexpected: readonly string[];
    };

/**
 * Fail closed on any missing, blank, over-long or unexpected variable. There is
 * no default substitution: a template is never sent with an empty placeholder.
 * Newlines, tabs and runs of spaces are rejected because Meta rejects them in
 * body parameters, and a rejection after queueing is a wasted attempt.
 */
export function validateWhatsappTemplateVariables(
  schema: WhatsappTemplateVariableSchema,
  values: Readonly<Record<string, string | null | undefined>>
): WhatsappTemplateVariableValidation {
  const missing: string[] = [];
  const invalid: string[] = [];
  const expected = new Set<string>();

  for (const variable of schema.variables) {
    expected.add(variable.key);
    const value = values[variable.key];
    if (value === null || value === undefined || value.trim().length === 0) {
      missing.push(variable.key);
      continue;
    }
    if (value.length > variable.maxLength || /[\n\t]| {5,}/.test(value)) {
      invalid.push(variable.key);
    }
  }

  const unexpected = Object.keys(values).filter((key) => !expected.has(key));

  if (missing.length === 0 && invalid.length === 0 && unexpected.length === 0) {
    return { ok: true };
  }
  return { ok: false, missing, invalid, unexpected };
}

/**
 * An immutable, content-addressed copy of a template as approved. Campaign
 * specs and one-to-one sends bind to a snapshot, never to the mutable registry
 * row; the registry row is re-read only to prove the snapshot is still approved
 * and still in the same category.
 */
export interface WhatsappTemplateSnapshotRef {
  readonly templateId: string;
  readonly snapshotId: string;
  readonly providerTemplateId: string;
  readonly name: string;
  readonly language: string;
  readonly category: WhatsappTemplateCategory;
  /** sha256 hex of the canonical components JSON at snapshot time. */
  readonly componentsHash: string;
  readonly variableSchema: WhatsappTemplateVariableSchema;
  readonly capturedAt: string;
}
