/**
 * WM-6 — official WhatsApp Flows (Forms / Flows) contracts.
 *
 * Authoritative database half:
 *   supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql
 *
 *   whatsapp.flows.read    Super Admin, Sales Manager
 *   whatsapp.flows.manage  Super Admin, Sales Manager
 *
 * A Flow is a local draft until Meta answers. Staff record a decision
 * (create / update_json / publish / deprecate / sync); only a service-role
 * outcome relayed from the official Graph API may set a provider Flow id or
 * status. Pure: no server imports.
 */

export const WHATSAPP_FLOW_RPC = {
  list: "list_whatsapp_flows",
  get: "get_whatsapp_flow",
  saveDraft: "save_whatsapp_flow_draft",
  requestProviderAction: "request_whatsapp_flow_provider_action",
} as const;

export const WHATSAPP_FLOW_SERVICE_RPC = {
  recordOutcome: "record_whatsapp_flow_provider_outcome",
} as const;

export const WHATSAPP_FLOW_CATEGORIES = [
  "SIGN_UP",
  "SIGN_IN",
  "APPOINTMENT_BOOKING",
  "LEAD_GENERATION",
  "CONTACT_US",
  "CUSTOMER_SUPPORT",
  "SURVEY",
  "OTHER",
] as const;
export type WhatsappFlowCategory = (typeof WHATSAPP_FLOW_CATEGORIES)[number];

export const WHATSAPP_FLOW_PURPOSES = ["lead_qualification", "consultation_request", "feedback", "other"] as const;
export type WhatsappFlowPurpose = (typeof WHATSAPP_FLOW_PURPOSES)[number];

/** CRM-facing targets a Flow answer may map to (private.whatsapp_flow_mappings_valid). */
export const WHATSAPP_FLOW_FIELD_TARGETS = [
  "service_interest",
  "property_type",
  "budget",
  "locality",
  "timeline",
  "consultation_preference",
  "design_preference",
  "feedback_score",
  "feedback_text",
] as const;
export type WhatsappFlowFieldTarget = (typeof WHATSAPP_FLOW_FIELD_TARGETS)[number];

/** Only these fill an EMPTY lead column; everything else stays response evidence. */
export const WHATSAPP_FLOW_CRM_FILLABLE_FIELDS = ["locality", "budget_comfort_code"] as const;

export const WHATSAPP_FLOW_PROVIDER_ACTIONS = ["create", "update_json", "publish", "deprecate", "sync"] as const;
export type WhatsappFlowProviderAction = (typeof WHATSAPP_FLOW_PROVIDER_ACTIONS)[number];

export const WHATSAPP_FLOW_STATUSES = ["local_draft", "DRAFT", "PUBLISHED", "DEPRECATED", "BLOCKED", "THROTTLED", "unknown"] as const;
export type WhatsappFlowStatus = (typeof WHATSAPP_FLOW_STATUSES)[number];

export const WHATSAPP_FLOW_JSON_MAX_BYTES = 60_000;

export function isWhatsappFlowProviderAction(value: unknown): value is WhatsappFlowProviderAction {
  return typeof value === "string" && (WHATSAPP_FLOW_PROVIDER_ACTIONS as readonly string[]).includes(value);
}

/** Mirrors private.whatsapp_normalize_flow_status: anything unrecognised stays `unknown`, never PUBLISHED. */
export function normalizeWhatsappFlowStatus(raw: unknown): Exclude<WhatsappFlowStatus, "local_draft"> {
  const value = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return value === "DRAFT" || value === "PUBLISHED" || value === "DEPRECATED" || value === "BLOCKED" || value === "THROTTLED"
    ? value
    : "unknown";
}

/**
 * Which provider actions to offer. A hint: request_whatsapp_flow_provider_action
 * re-checks each rule, including "publish only JSON Meta has accepted".
 */
export function availableWhatsappFlowActions(flow: {
  readonly providerStatus: string;
  readonly providerFlowId: string | null;
  readonly hasJson: boolean;
  readonly validationErrorCount: number;
}): readonly WhatsappFlowProviderAction[] {
  const actions: WhatsappFlowProviderAction[] = [];
  if (!flow.providerFlowId) {
    if (flow.hasJson) actions.push("create");
    return actions;
  }
  if (flow.providerStatus === "DRAFT") {
    if (flow.hasJson) actions.push("update_json");
    if (flow.validationErrorCount === 0) actions.push("publish");
  }
  if (flow.providerStatus === "PUBLISHED") actions.push("deprecate");
  actions.push("sync");
  return actions;
}

export const WHATSAPP_FLOW_ACTION_LABELS: Readonly<Record<WhatsappFlowProviderAction, string>> = {
  create: "Create at Meta",
  update_json: "Upload Flow JSON",
  publish: "Publish",
  deprecate: "Deprecate",
  sync: "Sync status",
};

export type WhatsappFlowDraftResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly name: string;
        readonly categories: readonly WhatsappFlowCategory[];
        readonly purpose: WhatsappFlowPurpose;
        readonly fieldMappings: Readonly<Record<string, WhatsappFlowFieldTarget>>;
        readonly flowJson: Record<string, unknown> | null;
      };
    }
  | { readonly ok: false; readonly field: string; readonly message: string };

/**
 * Validates a Flow draft the way SQL will: bounded name, allowlisted
 * categories, purpose and mapping targets, and a Flow JSON object with a
 * `version` and 1–50 `screens`. Meta remains the final validator.
 */
export function buildWhatsappFlowDraft(input: {
  readonly name: string;
  readonly categories: readonly string[];
  readonly purpose: string;
  readonly mappingKeys: readonly string[];
  readonly mappingTargets: readonly string[];
  readonly flowJson: string;
}): WhatsappFlowDraftResult {
  const name = input.name.trim();
  if (name.length < 1 || name.length > 200) return { ok: false, field: "name", message: "Name the Flow (up to 200 characters)." };
  const categories = [...new Set(input.categories)].filter((c): c is WhatsappFlowCategory =>
    (WHATSAPP_FLOW_CATEGORIES as readonly string[]).includes(c)
  );
  if (categories.length === 0 || categories.length !== new Set(input.categories).size) {
    return { ok: false, field: "categories", message: "Choose at least one Meta Flow category." };
  }
  if (!(WHATSAPP_FLOW_PURPOSES as readonly string[]).includes(input.purpose)) {
    return { ok: false, field: "purpose", message: "Choose what the Flow is for." };
  }
  const fieldMappings: Record<string, WhatsappFlowFieldTarget> = {};
  for (let index = 0; index < input.mappingKeys.length; index += 1) {
    const key = (input.mappingKeys[index] ?? "").trim();
    const target = (input.mappingTargets[index] ?? "").trim();
    if (key === "" && target === "") continue;
    if (!/^[a-z][a-z0-9_]{0,63}$/.test(key) || key === "flow_token") {
      return { ok: false, field: "mappings", message: `"${key.slice(0, 40)}" is not a valid Flow field name.` };
    }
    if (!(WHATSAPP_FLOW_FIELD_TARGETS as readonly string[]).includes(target)) {
      return { ok: false, field: "mappings", message: `Choose a CRM field for "${key}".` };
    }
    fieldMappings[key] = target as WhatsappFlowFieldTarget;
  }
  if (Object.keys(fieldMappings).length > 30) return { ok: false, field: "mappings", message: "Map at most 30 fields." };

  const rawJson = input.flowJson.trim();
  let flowJson: Record<string, unknown> | null = null;
  if (rawJson !== "") {
    if (rawJson.length > WHATSAPP_FLOW_JSON_MAX_BYTES) return { ok: false, field: "flowJson", message: "Flow JSON is too large." };
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      return { ok: false, field: "flowJson", message: "Flow JSON is not valid JSON." };
    }
    const record = typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    const screens = record?.screens;
    if (!record || typeof record.version !== "string" || !/^\d{1,2}\.\d{1,2}$/.test(record.version) || !Array.isArray(screens) || screens.length < 1 || screens.length > 50) {
      return { ok: false, field: "flowJson", message: "Flow JSON needs a version like \"7.0\" and 1–50 screens." };
    }
    flowJson = record;
  }
  return { ok: true, value: { name, categories, purpose: input.purpose as WhatsappFlowPurpose, fieldMappings, flowJson } };
}

/* ------------------------------------------------------------------ */
/* Payload parsing                                                     */
/* ------------------------------------------------------------------ */

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === "string") : [];
}

export interface WhatsappFlowSummary {
  readonly id: string;
  readonly name: string;
  readonly categories: readonly string[];
  readonly purpose: string;
  readonly providerStatus: string;
  readonly providerStatusRaw: string | null;
  readonly providerFlowId: string | null;
  readonly hasJson: boolean;
  readonly validationErrorCount: number;
  readonly mappedFieldCount: number;
  readonly responseCount: number;
  readonly lastResponseAt: string | null;
  readonly updatedAt: string | null;
}

export function parseWhatsappFlowList(data: unknown): readonly WhatsappFlowSummary[] {
  if (!Array.isArray(data)) return [];
  return data.flatMap((item) => {
    const row = asRecord(item);
    const id = str(row?.id);
    if (!row || !id) return [];
    return [
      {
        id,
        name: str(row.name) ?? "Flow",
        categories: strings(row.categories),
        purpose: str(row.purpose) ?? "other",
        providerStatus: str(row.provider_status) ?? "unknown",
        providerStatusRaw: str(row.provider_status_raw),
        providerFlowId: str(row.provider_flow_id),
        hasJson: row.has_json === true,
        validationErrorCount: typeof row.validation_error_count === "number" ? row.validation_error_count : 0,
        mappedFieldCount: typeof row.mapped_field_count === "number" ? row.mapped_field_count : 0,
        responseCount: typeof row.response_count === "number" ? row.response_count : 0,
        lastResponseAt: str(row.last_response_at),
        updatedAt: str(row.updated_at),
      },
    ];
  });
}

export interface WhatsappFlowDetail extends WhatsappFlowSummary {
  readonly fieldMappings: Readonly<Record<string, string>>;
  readonly flowJson: unknown;
  readonly validationErrors: readonly unknown[];
  readonly providerSyncedAt: string | null;
  readonly requests: readonly {
    readonly id: string;
    readonly action: string;
    readonly createdAt: string | null;
    readonly outcome: string | null;
    readonly providerStatus: string | null;
    readonly errorCode: string | null;
  }[];
  readonly responses: readonly {
    readonly id: string;
    readonly receivedAt: string | null;
    readonly fields: Readonly<Record<string, string>>;
    readonly unmappedKeyCount: number;
    readonly crmApplyOutcome: string;
    readonly crmAppliedFields: readonly string[];
    readonly leadLinked: boolean;
  }[];
}

export function parseWhatsappFlowDetail(data: unknown): WhatsappFlowDetail | null {
  const row = asRecord(data);
  const id = str(row?.id);
  if (!row || !id) return null;
  const mappings: Record<string, string> = {};
  for (const [key, value] of Object.entries(asRecord(row.field_mappings) ?? {})) {
    if (typeof value === "string") mappings[key] = value;
  }
  const validationErrors = Array.isArray(row.validation_errors) ? row.validation_errors : [];
  return {
    id,
    name: str(row.name) ?? "Flow",
    categories: strings(row.categories),
    purpose: str(row.purpose) ?? "other",
    providerStatus: str(row.provider_status) ?? "unknown",
    providerStatusRaw: str(row.provider_status_raw),
    providerFlowId: str(row.provider_flow_id),
    hasJson: row.flow_json !== null && row.flow_json !== undefined,
    validationErrorCount: validationErrors.length,
    mappedFieldCount: Object.keys(mappings).length,
    responseCount: Array.isArray(row.responses) ? row.responses.length : 0,
    lastResponseAt: null,
    updatedAt: str(row.updated_at),
    fieldMappings: mappings,
    flowJson: row.flow_json ?? null,
    validationErrors,
    providerSyncedAt: str(row.provider_synced_at),
    requests: (Array.isArray(row.requests) ? row.requests : []).flatMap((item) => {
      const request = asRecord(item);
      const requestId = str(request?.id);
      return request && requestId
        ? [
            {
              id: requestId,
              action: str(request.action) ?? "sync",
              createdAt: str(request.created_at),
              outcome: str(request.outcome),
              providerStatus: str(request.provider_status),
              errorCode: str(request.error_code),
            },
          ]
        : [];
    }),
    responses: (Array.isArray(row.responses) ? row.responses : []).flatMap((item) => {
      const response = asRecord(item);
      const responseId = str(response?.id);
      if (!response || !responseId) return [];
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries(asRecord(response.response_fields) ?? {})) {
        if (typeof value === "string") fields[key] = value;
      }
      return [
        {
          id: responseId,
          receivedAt: str(response.received_at),
          fields,
          unmappedKeyCount: typeof response.unmapped_key_count === "number" ? response.unmapped_key_count : 0,
          crmApplyOutcome: str(response.crm_apply_outcome) ?? "nothing_to_apply",
          crmAppliedFields: strings(response.crm_applied_fields),
          leadLinked: response.lead_linked === true,
        },
      ];
    }),
  };
}

export interface WhatsappFlowProviderRequest {
  readonly requestId: string;
  readonly reused: boolean;
  readonly resolved: boolean;
  readonly action: WhatsappFlowProviderAction;
  readonly providerFlowId: string | null;
  readonly name: string;
  readonly categories: readonly string[];
  readonly flowJson: unknown;
}

export function parseWhatsappFlowProviderRequest(data: unknown): WhatsappFlowProviderRequest | null {
  const row = asRecord(data);
  const flow = asRecord(row?.flow);
  const requestId = str(row?.request_id);
  if (!row || !flow || !requestId || !isWhatsappFlowProviderAction(row.action)) return null;
  return {
    requestId,
    reused: row.reused === true,
    resolved: row.resolved === true,
    action: row.action,
    providerFlowId: str(flow.provider_flow_id),
    name: str(flow.name) ?? "Flow",
    categories: strings(flow.categories),
    flowJson: flow.flow_json ?? null,
  };
}

export function describeWhatsappFlowRpcError(error: { readonly code?: string | null; readonly message?: string | null }): {
  readonly code: string;
  readonly message: string;
} {
  const message = error.message ?? "";
  if (message.includes("WHATSAPP_FLOW_REQUEST_UNRESOLVED")) {
    return { code: "UNRESOLVED", message: "An earlier request to Meta has no recorded answer yet. Sync first or wait 15 minutes." };
  }
  if (message.includes("WHATSAPP_FLOW_ACTION_NOT_ALLOWED")) {
    return { code: "NOT_ALLOWED", message: "That action does not fit the Flow's current state at Meta." };
  }
  if (message.includes("WHATSAPP_FLOW_NOT_EDITABLE")) {
    return { code: "NOT_EDITABLE", message: "Only local or DRAFT Flows can change, and a Flow at Meta keeps its name and categories." };
  }
  if (message.includes("WHATSAPP_FLOW_JSON_INVALID")) return { code: "VALIDATION", message: "The Flow JSON is not a valid Flow document." };
  if (message.includes("WHATSAPP_BUSINESS_ACCOUNT_NOT_REGISTERED")) {
    return { code: "WABA_NOT_REGISTERED", message: "No single active WhatsApp Business Account is registered." };
  }
  switch (error.code ?? "") {
    case "42501":
      return { code: "ACCESS_DENIED", message: "You do not have permission to manage WhatsApp Flows." };
    case "22023":
      return { code: "VALIDATION", message: "The database rejected these values." };
    case "23505":
      return { code: "CONFLICT", message: "A Flow with this name already exists, or this request was already used." };
    case "P0002":
      return { code: "NOT_FOUND", message: "That Flow does not exist." };
    default:
      return { code: "RPC_FAILED", message: "The Flow change could not be saved." };
  }
}
