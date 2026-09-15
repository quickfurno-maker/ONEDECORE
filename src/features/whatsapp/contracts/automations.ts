/**
 * WM-6 — governed WhatsApp automations contracts.
 *
 * Authoritative database half:
 *   supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql
 *
 *   whatsapp.automations.read    Super Admin, Sales Manager
 *   whatsapp.automations.manage  Super Admin, Sales Manager
 *
 * An automation is one governed journey step bound to an APPROVED WhatsApp
 * campaign version: trigger → optional delay → one MARKETING template send,
 * re-proved just in time. Kriti has no role and no path here: it may draft
 * text for a human, never send, approve or mutate. Pure: no server imports.
 */

export const WHATSAPP_AUTOMATION_RPC = {
  list: "list_whatsapp_automations",
  get: "get_whatsapp_automation",
  save: "save_whatsapp_automation",
  setStatus: "set_whatsapp_automation_status",
  resolveReconcile: "resolve_whatsapp_automation_reconcile",
} as const;

export const WHATSAPP_AUTOMATION_WORKER_RPC = {
  enrollTriggers: "enroll_whatsapp_automation_triggers",
  claim: "claim_whatsapp_automation_enrollments",
  markProviderRequestStarted: "mark_whatsapp_automation_provider_request_started",
  completeSuccess: "complete_whatsapp_automation_dispatch_success",
  completeFailure: "complete_whatsapp_automation_dispatch_failure",
} as const;

export const WHATSAPP_AUTOMATION_TRIGGERS = [
  "lead_created",
  "lead_stage_changed",
  "campaign_reply",
  "flow_completed",
  "ctwa_referral",
] as const;
export type WhatsappAutomationTrigger = (typeof WHATSAPP_AUTOMATION_TRIGGERS)[number];

export const WHATSAPP_AUTOMATION_TRIGGER_LABELS: Readonly<Record<WhatsappAutomationTrigger, string>> = {
  lead_created: "Lead created",
  lead_stage_changed: "Lead reaches a stage",
  campaign_reply: "Customer replies to a campaign",
  flow_completed: "WhatsApp Flow completed",
  ctwa_referral: "Click-to-WhatsApp ad conversation",
};

export const WHATSAPP_AUTOMATION_STAGE_OPTIONS = [
  "assigned",
  "contacted",
  "qualified",
  "consultation_scheduled",
  "proposal_sent",
  "negotiation",
  "closed_won",
  "closed_lost",
  "on_hold",
] as const;

export const WHATSAPP_AUTOMATION_STOP_STATUSES = ["closed_won", "closed_lost", "on_hold"] as const;

export const WHATSAPP_AUTOMATION_ACTIONS = ["activate", "resume", "pause", "archive"] as const;
export type WhatsappAutomationAction = (typeof WHATSAPP_AUTOMATION_ACTIONS)[number];

export const WHATSAPP_AUTOMATION_MAX_DELAY_MINUTES = 43_200;

export function isWhatsappAutomationAction(value: unknown): value is WhatsappAutomationAction {
  return typeof value === "string" && (WHATSAPP_AUTOMATION_ACTIONS as readonly string[]).includes(value);
}

/**
 * Status buttons to show. Pause and archive are safety-increasing and never
 * hidden behind a gate; activate/resume are re-proved in SQL (approved
 * version, independent operator, sendable template, execution gate).
 */
export function availableWhatsappAutomationActions(status: string, canManage: boolean): readonly WhatsappAutomationAction[] {
  if (!canManage) return [];
  switch (status) {
    case "draft":
      return ["activate", "archive"];
    case "active":
      return ["pause", "archive"];
    case "paused":
      return ["resume", "archive"];
    default:
      return [];
  }
}

export const WHATSAPP_AUTOMATION_ACTION_LABELS: Readonly<Record<WhatsappAutomationAction, string>> = {
  activate: "Activate",
  resume: "Resume",
  pause: "Pause",
  archive: "Archive",
};

export type WhatsappAutomationDraftResult =
  | {
      readonly ok: true;
      readonly value: {
        readonly name: string;
        readonly description: string | null;
        readonly triggerType: WhatsappAutomationTrigger;
        readonly triggerConfig: Readonly<Record<string, string>>;
        readonly campaignVersionId: string;
        readonly delayMinutes: number;
        readonly stopOnLeadStatuses: readonly string[];
        readonly stopOnReply: boolean;
      };
    }
  | { readonly ok: false; readonly field: string; readonly message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function buildWhatsappAutomationDraft(input: {
  readonly name: string;
  readonly description: string;
  readonly triggerType: string;
  readonly toStage: string;
  readonly triggerCampaignVersionId: string;
  readonly flowId: string;
  readonly sourceId: string;
  readonly campaignVersionId: string;
  readonly delayMinutes: string;
  readonly stopOnLeadStatuses: readonly string[];
  readonly stopOnReply: boolean;
}): WhatsappAutomationDraftResult {
  const name = input.name.trim();
  if (name.length < 2 || name.length > 120) return { ok: false, field: "name", message: "Name the automation (2–120 characters)." };
  const description = input.description.trim();
  if (description.length > 500) return { ok: false, field: "description", message: "Keep the description under 500 characters." };
  if (!(WHATSAPP_AUTOMATION_TRIGGERS as readonly string[]).includes(input.triggerType)) {
    return { ok: false, field: "triggerType", message: "Choose a trigger." };
  }
  const triggerType = input.triggerType as WhatsappAutomationTrigger;
  const triggerConfig: Record<string, string> = {};
  if (triggerType === "lead_stage_changed") {
    if (!(WHATSAPP_AUTOMATION_STAGE_OPTIONS as readonly string[]).includes(input.toStage)) {
      return { ok: false, field: "toStage", message: "Choose the stage that triggers the send." };
    }
    triggerConfig.to_stage = input.toStage;
  }
  if (triggerType === "campaign_reply" && input.triggerCampaignVersionId.trim() !== "") {
    if (!UUID.test(input.triggerCampaignVersionId.trim())) return { ok: false, field: "triggerCampaignVersionId", message: "Unknown campaign." };
    triggerConfig.campaign_version_id = input.triggerCampaignVersionId.trim();
  }
  if (triggerType === "flow_completed") {
    if (!UUID.test(input.flowId.trim())) return { ok: false, field: "flowId", message: "Choose the Flow that triggers the send." };
    triggerConfig.flow_id = input.flowId.trim();
  }
  if (triggerType === "ctwa_referral" && input.sourceId.trim() !== "") {
    if (!/^[A-Za-z0-9_.:-]{1,128}$/.test(input.sourceId.trim())) return { ok: false, field: "sourceId", message: "The ad id looks invalid." };
    triggerConfig.source_id = input.sourceId.trim();
  }
  if (!UUID.test(input.campaignVersionId.trim())) {
    return { ok: false, field: "campaignVersionId", message: "Choose the approved campaign whose template is sent." };
  }
  const delay = Number(input.delayMinutes.trim() === "" ? "0" : input.delayMinutes);
  if (!Number.isInteger(delay) || delay < 0 || delay > WHATSAPP_AUTOMATION_MAX_DELAY_MINUTES) {
    return { ok: false, field: "delayMinutes", message: "Delay must be 0–43200 minutes (30 days)." };
  }
  const stops = [...new Set(input.stopOnLeadStatuses)];
  if (stops.some((status) => !(WHATSAPP_AUTOMATION_STOP_STATUSES as readonly string[]).includes(status))) {
    return { ok: false, field: "stopOnLeadStatuses", message: "Unknown stop status." };
  }
  return {
    ok: true,
    value: {
      name,
      description: description === "" ? null : description,
      triggerType,
      triggerConfig,
      campaignVersionId: input.campaignVersionId.trim(),
      delayMinutes: delay,
      stopOnLeadStatuses: stops,
      stopOnReply: input.stopOnReply,
    },
  };
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

export interface WhatsappAutomationView {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly triggerType: string;
  readonly triggerConfig: Readonly<Record<string, string>>;
  readonly campaignVersionId: string;
  readonly campaignName: string | null;
  readonly versionNumber: number | null;
  readonly templateName: string | null;
  readonly delayMinutes: number;
  readonly stopOnLeadStatuses: readonly string[];
  readonly stopOnReply: boolean;
  readonly status: string;
  readonly lockVersion: number;
  readonly activatedAt: string | null;
  readonly updatedAt: string | null;
  readonly enrollmentStates: Readonly<Record<string, number>>;
}

function parseAutomation(value: unknown): WhatsappAutomationView | null {
  const row = asRecord(value);
  const id = str(row?.id);
  const campaignVersionId = str(row?.campaign_version_id);
  if (!row || !id || !campaignVersionId) return null;
  const config: Record<string, string> = {};
  for (const [key, entry] of Object.entries(asRecord(row.trigger_config) ?? {})) {
    if (typeof entry === "string") config[key] = entry;
  }
  const states: Record<string, number> = {};
  for (const [key, entry] of Object.entries(asRecord(row.enrollment_states) ?? {})) {
    if (typeof entry === "number") states[key] = entry;
  }
  return {
    id,
    name: str(row.name) ?? "Automation",
    description: str(row.description),
    triggerType: str(row.trigger_type) ?? "lead_created",
    triggerConfig: config,
    campaignVersionId,
    campaignName: str(row.campaign_name),
    versionNumber: typeof row.version_number === "number" ? row.version_number : null,
    templateName: str(row.template_name),
    delayMinutes: typeof row.delay_minutes === "number" ? row.delay_minutes : 0,
    stopOnLeadStatuses: Array.isArray(row.stop_on_lead_statuses)
      ? row.stop_on_lead_statuses.filter((entry): entry is string => typeof entry === "string")
      : [],
    stopOnReply: row.stop_on_reply === true,
    status: str(row.status) ?? "draft",
    lockVersion: typeof row.lock_version === "number" ? row.lock_version : 1,
    activatedAt: str(row.activated_at),
    updatedAt: str(row.updated_at),
    enrollmentStates: states,
  };
}

export function parseWhatsappAutomationList(data: unknown): readonly WhatsappAutomationView[] {
  return Array.isArray(data) ? data.map(parseAutomation).filter((row): row is WhatsappAutomationView => row !== null) : [];
}

export interface WhatsappAutomationDetail extends WhatsappAutomationView {
  readonly sendProblem: string | null;
  readonly operatorDenial: string | null;
  readonly reasons: readonly { readonly code: string; readonly count: number }[];
  readonly nextNotBefore: string | null;
  readonly reconcileEnrollmentIds: readonly string[];
  readonly events: readonly {
    readonly eventType: string;
    readonly fromState: string | null;
    readonly toState: string | null;
    readonly actorType: string;
    readonly reason: string | null;
    readonly occurredAt: string | null;
  }[];
}

export function parseWhatsappAutomationDetail(data: unknown): WhatsappAutomationDetail | null {
  const base = parseAutomation(data);
  const row = asRecord(data);
  if (!base || !row) return null;
  return {
    ...base,
    sendProblem: str(row.send_problem),
    operatorDenial: str(row.operator_denial),
    reasons: Object.entries(asRecord(row.reasons) ?? {})
      .filter(([, count]) => typeof count === "number")
      .map(([code, count]) => ({ code, count: count as number }))
      .sort((a, b) => b.count - a.count),
    nextNotBefore: str(row.next_not_before),
    reconcileEnrollmentIds: Array.isArray(row.reconcile_enrollment_ids)
      ? row.reconcile_enrollment_ids.filter((id): id is string => typeof id === "string")
      : [],
    events: (Array.isArray(row.events) ? row.events : []).flatMap((item) => {
      const event = asRecord(item);
      return event
        ? [
            {
              eventType: str(event.event_type) ?? "event",
              fromState: str(event.from_state),
              toState: str(event.to_state),
              actorType: str(event.actor_type) ?? "system",
              reason: str(event.reason),
              occurredAt: str(event.occurred_at),
            },
          ]
        : [];
    }),
  };
}

export function describeWhatsappAutomationRpcError(error: { readonly code?: string | null; readonly message?: string | null }): {
  readonly code: string;
  readonly message: string;
} {
  const message = error.message ?? "";
  if (message.includes("WHATSAPP_CAMPAIGN_APPROVER_CANNOT_EXECUTE")) {
    return { code: "APPROVER_CANNOT_EXECUTE", message: "You approved the bound campaign version, so a different manager must activate this." };
  }
  if (message.includes("WHATSAPP_MARKETING_EXECUTION_DISABLED")) {
    return { code: "EXECUTION_DISABLED", message: "Marketing execution is off in Settings & Compliance." };
  }
  if (message.includes("WHATSAPP_AUTOMATION_STALE")) {
    return { code: "STALE", message: "Someone else changed this automation. Reload and try again." };
  }
  const notSendable = /WHATSAPP_AUTOMATION_(?:NOT_SENDABLE|INVALID): ([a-z_]+)/.exec(message);
  if (notSendable) return { code: "REFUSED", message: `Refused: ${notSendable[1]!.replace(/_/g, " ")}.` };
  if (message.includes("WHATSAPP_AUTOMATION_NOT_DRAFT")) {
    return { code: "NOT_DRAFT", message: "An activated automation cannot change. Archive it and create a new one." };
  }
  switch (error.code ?? "") {
    case "42501":
      return { code: "ACCESS_DENIED", message: "You do not have permission to manage WhatsApp automations." };
    case "22023":
      return { code: "VALIDATION", message: "The database rejected this automation." };
    case "23505":
      return { code: "CONFLICT", message: "An automation with this name already exists." };
    case "P0002":
      return { code: "NOT_FOUND", message: "That automation or campaign does not exist or is not visible to you." };
    default:
      return { code: "RPC_FAILED", message: "The automation change could not be saved." };
  }
}
