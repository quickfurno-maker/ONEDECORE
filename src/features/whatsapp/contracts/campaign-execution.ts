/**
 * WM-4 — WhatsApp campaign execution contracts.
 *
 * Authoritative database half:
 *   supabase/migrations/20260915100000_whatsapp_campaign_execution.sql
 *   supabase/migrations/20260916100000_whatsapp_control_plane_runtime_hardening.sql
 *   supabase/migrations/20260917100000_whatsapp_analytics_attribution.sql (tracked buttons)
 *   supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql (Flow buttons)
 *
 * Pure (no server imports). Shared by the caller-session campaign
 * queries/actions, the admin Campaigns page, the service-role dispatch worker
 * and the WM-4/WM-7 tests.
 *
 *   campaigns.draft + whatsapp.templates.read   Super Admin: author the spec
 *                                               of a draft WhatsApp version
 *   whatsapp.campaigns.execute                  Super Admin, Sales Manager:
 *                                               preview, run, start, pause,
 *                                               resume (SQL also refuses a
 *                                               Sales Manager who approved
 *                                               the version)
 *   whatsapp.campaigns.test_send                Super Admin, Sales Manager
 *   whatsapp.campaigns.cancel                   Super Admin: cancel, resolve
 *                                               ambiguous outcomes
 *
 * Sales Executive and legacy roles hold none of these. Approval is the
 * existing generic campaign approval; WM-4 reads it and never records one.
 * The worker runs as service role only, claims at most 50 jobs and gives each
 * at most 3 attempts. An ambiguous provider result is `needs_reconcile` and is
 * never retried.
 */

export { WHATSAPP_ADMIN_CAMPAIGNS_PATH } from "./control-plane.ts";

/** Caller-session RPCs. Every one re-checks its permission in SQL. */
export const WHATSAPP_CAMPAIGN_EXECUTION_RPC = {
  listVersions: "list_whatsapp_campaign_versions",
  listSchedulerRuns: "list_whatsapp_campaign_scheduler_runs",
  getVersion: "get_whatsapp_campaign_version",
  listTemplateOptions: "list_whatsapp_campaign_template_options",
  saveSpec: "save_whatsapp_campaign_spec",
  setButtonBindings: "set_whatsapp_campaign_spec_button_bindings",
  previewAudience: "preview_whatsapp_campaign_audience",
  listTestDestinations: "list_whatsapp_campaign_test_destinations",
  createTestSend: "create_whatsapp_campaign_test_send",
  createRun: "create_whatsapp_campaign_run",
  rescheduleRun: "reschedule_whatsapp_campaign_run",
  startRun: "start_whatsapp_campaign_run",
  pauseRun: "pause_whatsapp_campaign_run",
  resumeRun: "resume_whatsapp_campaign_run",
  cancelRun: "cancel_whatsapp_campaign_run",
  runBreakdown: "get_whatsapp_campaign_run_breakdown",
  resolveReconcile: "resolve_whatsapp_campaign_reconcile",
  listClickDestinations: "list_whatsapp_click_destinations",
} as const;

/** Service-role-only RPCs, called by the internal worker. */
export const WHATSAPP_CAMPAIGN_WORKER_RPC = {
  materializeDueRuns: "materialize_due_whatsapp_campaign_runs",
  claimJobs: "claim_whatsapp_campaign_dispatch_jobs",
  markProviderRequestStarted: "mark_whatsapp_campaign_provider_request_started",
  completeSuccess: "complete_whatsapp_campaign_dispatch_success",
  completeFailure: "complete_whatsapp_campaign_dispatch_failure",
  claimTestSends: "claim_whatsapp_campaign_test_sends",
  markTestSendStarted: "mark_whatsapp_campaign_test_send_started",
  completeTestSend: "complete_whatsapp_campaign_test_send",
} as const;

export const WHATSAPP_CAMPAIGN_PERMISSION_CODES = [
  "whatsapp.campaigns.execute",
  "whatsapp.campaigns.test_send",
  "whatsapp.campaigns.cancel",
] as const;

export type WhatsappCampaignPermissionCode = (typeof WHATSAPP_CAMPAIGN_PERMISSION_CODES)[number];

/** Mirror of the migration's grants, for display and tests. It grants nothing. */
export const WHATSAPP_CAMPAIGN_ROLE_GRANTS: Readonly<Record<string, readonly WhatsappCampaignPermissionCode[]>> = {
  super_admin: ["whatsapp.campaigns.execute", "whatsapp.campaigns.test_send", "whatsapp.campaigns.cancel"],
  sales_manager: ["whatsapp.campaigns.execute", "whatsapp.campaigns.test_send"],
  sales_executive: [],
};

export const WHATSAPP_CAMPAIGN_WORKER_MAX_BATCH = 50;
export const WHATSAPP_CAMPAIGN_WORKER_DEFAULT_BATCH = 25;
export const WHATSAPP_CAMPAIGN_MAX_ATTEMPTS = 3;

export function clampWhatsappCampaignWorkerBatch(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed) || parsed < 1) return WHATSAPP_CAMPAIGN_WORKER_DEFAULT_BATCH;
  return Math.min(Math.floor(parsed), WHATSAPP_CAMPAIGN_WORKER_MAX_BATCH);
}

/* ------------------------------------------------------------------ */
/* Run lifecycle                                                       */
/* ------------------------------------------------------------------ */

/**
 * `start` materialises a still-scheduled run first, in the same RPC; the
 * worker materialises due runs on its own. There is no separate staff
 * materialise step.
 */
export const WHATSAPP_CAMPAIGN_RUN_OPERATIONS = ["start", "pause", "resume", "cancel"] as const;

export type WhatsappCampaignRunOperation = (typeof WHATSAPP_CAMPAIGN_RUN_OPERATIONS)[number];

export const WHATSAPP_CAMPAIGN_RUN_OPERATION_RPC = {
  start: WHATSAPP_CAMPAIGN_EXECUTION_RPC.startRun,
  pause: WHATSAPP_CAMPAIGN_EXECUTION_RPC.pauseRun,
  resume: WHATSAPP_CAMPAIGN_EXECUTION_RPC.resumeRun,
  cancel: WHATSAPP_CAMPAIGN_EXECUTION_RPC.cancelRun,
} as const satisfies Readonly<Record<WhatsappCampaignRunOperation, string>>;

export const WHATSAPP_CAMPAIGN_RUN_OPERATION_PERMISSION: Readonly<
  Record<WhatsappCampaignRunOperation, WhatsappCampaignPermissionCode>
> = {
  start: "whatsapp.campaigns.execute",
  pause: "whatsapp.campaigns.execute",
  resume: "whatsapp.campaigns.execute",
  cancel: "whatsapp.campaigns.cancel",
};

export const WHATSAPP_CAMPAIGN_RUN_OPERATION_LABEL: Readonly<Record<WhatsappCampaignRunOperation, string>> = {
  start: "Start now",
  pause: "Pause",
  resume: "Resume",
  cancel: "Cancel run",
};

export function isWhatsappCampaignRunOperation(value: unknown): value is WhatsappCampaignRunOperation {
  return typeof value === "string" && (WHATSAPP_CAMPAIGN_RUN_OPERATIONS as readonly string[]).includes(value);
}

/** `chk_whatsapp_campaign_runs_status`. */
export const WHATSAPP_CAMPAIGN_RUN_STATUSES = [
  "scheduled",
  "materializing",
  "ready",
  "dispatching",
  "paused",
  "reconciling",
  "completed",
  "cancelled",
  "failed",
] as const;

/**
 * Which lifecycle buttons to show for a run. A hint only: every transition is
 * decided again by its RPC, which refuses anything illegal (for example a
 * cancel while any job is claimed or needs reconciliation). Pause is never
 * hidden behind a sending gate.
 */
export function availableWhatsappCampaignRunOperations(
  status: string,
  permissions: Readonly<Record<WhatsappCampaignPermissionCode, boolean>>
): readonly WhatsappCampaignRunOperation[] {
  const candidates: WhatsappCampaignRunOperation[] = [];
  if (status === "scheduled" || status === "ready") candidates.push("start");
  if (status === "dispatching") candidates.push("pause");
  if (status === "paused") candidates.push("resume");
  if (["scheduled", "ready", "dispatching", "paused"].includes(status)) candidates.push("cancel");
  return candidates.filter((op) => permissions[WHATSAPP_CAMPAIGN_RUN_OPERATION_PERMISSION[op]]);
}

export function whatsappCampaignRunTone(status: string): "positive" | "negative" | "warning" | undefined {
  if (status === "completed" || status === "dispatching") return "positive";
  if (status === "failed" || status === "cancelled") return "negative";
  if (status === "reconciling" || status === "paused") return "warning";
  return undefined;
}

/** The generic campaign approval, as the Campaigns page presents it. */
export function presentWhatsappCampaignApproval(
  decision: string | null
): { readonly label: string; readonly tone: "positive" | "negative" | undefined; readonly approved: boolean } {
  if (decision === "approved") return { label: "Approved", tone: "positive", approved: true };
  if (decision === "rejected") return { label: "Rejected", tone: "negative", approved: false };
  if (decision) return { label: decision.replace(/_/g, " "), tone: undefined, approved: false };
  return { label: "Awaiting approval", tone: undefined, approved: false };
}

/** Why the database says this operator may not run the version, in words. */
export function describeWhatsappCampaignOperatorDenial(denial: string | null): string | null {
  switch (denial) {
    case null:
      return null;
    case "approved_by_actor":
      return "You approved this version, so a different operator must run it.";
    case "missing_permission":
      return "You do not hold WhatsApp campaign execution.";
    default:
      return "Your role cannot operate WhatsApp campaign runs.";
  }
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

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export interface WhatsappCampaignRunView {
  readonly id: string;
  readonly status: string;
  readonly scheduledFor: string | null;
  readonly autoStart: boolean;
  readonly requestedByMe: boolean;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly failureCode: string | null;
  readonly totalCount: number;
  readonly eligibleCount: number;
  readonly excludedCount: number;
  readonly sentCount: number;
  readonly skippedCount: number;
  readonly failedCount: number;
  readonly reconcileCount: number;
  readonly createdAt: string | null;
}

export function parseWhatsappCampaignRun(value: unknown): WhatsappCampaignRunView | null {
  const row = asRecord(value);
  const id = str(row?.id);
  if (!row || !id) return null;
  return {
    id,
    status: str(row.status) ?? "unknown",
    scheduledFor: str(row.scheduled_for),
    autoStart: row.auto_start === true,
    requestedByMe: row.requested_by_me === true,
    startedAt: str(row.started_at),
    completedAt: str(row.completed_at),
    failureCode: str(row.failure_code),
    totalCount: num(row.total_count),
    eligibleCount: num(row.eligible_count),
    excludedCount: num(row.excluded_count),
    sentCount: num(row.sent_count),
    skippedCount: num(row.skipped_count),
    failedCount: num(row.failed_count),
    reconcileCount: num(row.reconcile_count),
    createdAt: str(row.created_at),
  };
}

export interface WhatsappCampaignVersionSummary {
  readonly versionId: string;
  readonly campaignId: string;
  readonly campaignName: string;
  readonly campaignReference: string | null;
  readonly versionNumber: number;
  readonly title: string;
  readonly status: string;
  readonly updatedAt: string | null;
  readonly specState: string | null;
  readonly templateName: string | null;
  readonly segmentName: string | null;
  readonly latestRun: WhatsappCampaignRunView | null;
}

/** `list_whatsapp_campaign_versions`: WhatsApp-only versions this caller may see. */
export function parseWhatsappCampaignVersionList(data: unknown): readonly WhatsappCampaignVersionSummary[] {
  if (!Array.isArray(data)) return [];
  const out: WhatsappCampaignVersionSummary[] = [];
  for (const item of data) {
    const row = asRecord(item);
    const versionId = str(row?.version_id);
    const campaignId = str(row?.campaign_id);
    if (!row || !versionId || !campaignId) continue;
    out.push({
      versionId,
      campaignId,
      campaignName: str(row.campaign_name) ?? "Untitled campaign",
      campaignReference: str(row.campaign_reference),
      versionNumber: num(row.version_number),
      title: str(row.title) ?? "",
      status: str(row.status) ?? "unknown",
      updatedAt: str(row.updated_at),
      specState: str(row.spec_state),
      templateName: str(row.template_name),
      segmentName: str(row.segment_name),
      latestRun: parseWhatsappCampaignRun(row.latest_run),
    });
  }
  return out;
}

export type WhatsappCampaignTemplateParameters = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface WhatsappCampaignSpecView {
  readonly id: string;
  readonly state: string;
  readonly templateSnapshotId: string;
  readonly templateName: string | null;
  readonly templateLanguage: string | null;
  readonly components: unknown;
  readonly defaultParameters: WhatsappCampaignTemplateParameters;
  readonly parameterBindings: WhatsappCampaignTemplateParameters;
  readonly preferenceCategory: string;
  readonly segmentId: string | null;
  readonly segmentName: string | null;
  readonly frozenAt: string | null;
  readonly templateProblem: string | null;
}

export interface WhatsappCampaignVersionDetail {
  readonly campaignId: string;
  readonly campaignName: string;
  readonly versionId: string;
  readonly versionNumber: number;
  readonly title: string;
  readonly status: string;
  readonly audienceFrozen: boolean;
  readonly approval: { readonly decision: string; readonly decidedAt: string | null; readonly decidedByMe: boolean } | null;
  readonly spec: WhatsappCampaignSpecView | null;
  readonly previousSpec: { readonly templateSnapshotId: string | null; readonly preferenceCategory: string | null } | null;
  readonly operatorDenial: string | null;
  readonly runs: readonly WhatsappCampaignRunView[];
}

function parseParameterObject(value: unknown): WhatsappCampaignTemplateParameters {
  const record = asRecord(value);
  if (!record) return {};
  const out: Record<string, Record<string, string>> = {};
  for (const component of ["header", "body"] as const) {
    const part = asRecord(record[component]);
    if (!part) continue;
    const values: Record<string, string> = {};
    for (const [key, entry] of Object.entries(part)) {
      if (typeof entry === "string") values[key] = entry;
    }
    out[component] = values;
  }
  return out;
}

/** `get_whatsapp_campaign_version`. Invisible and missing versions both raise, so null means "not found". */
export function parseWhatsappCampaignVersionDetail(data: unknown): WhatsappCampaignVersionDetail | null {
  const root = asRecord(data);
  const campaign = asRecord(root?.campaign);
  const version = asRecord(root?.version);
  const versionId = str(version?.id);
  const campaignId = str(campaign?.id);
  if (!root || !campaign || !version || !versionId || !campaignId) return null;
  const approval = asRecord(root.approval);
  const spec = asRecord(root.spec);
  const previous = asRecord(root.previous_spec);
  const specId = str(spec?.id);
  const snapshotId = str(spec?.template_snapshot_id);
  return {
    campaignId,
    campaignName: str(campaign.name) ?? "Untitled campaign",
    versionId,
    versionNumber: num(version.number),
    title: str(version.title) ?? "",
    status: str(version.status) ?? "unknown",
    audienceFrozen: asRecord(root.audience)?.frozen === true,
    approval: approval && str(approval.decision)
      ? { decision: str(approval.decision)!, decidedAt: str(approval.decided_at), decidedByMe: approval.decided_by_me === true }
      : null,
    spec:
      spec && specId && snapshotId
        ? {
            id: specId,
            state: str(spec.state) ?? "draft",
            templateSnapshotId: snapshotId,
            templateName: str(spec.template_name),
            templateLanguage: str(spec.template_language),
            components: spec.components ?? [],
            defaultParameters: parseParameterObject(spec.default_parameters),
            parameterBindings: parseParameterObject(spec.parameter_bindings),
            preferenceCategory: str(spec.preference_category) ?? "",
            segmentId: str(spec.segment_id),
            segmentName: str(spec.segment_name),
            frozenAt: str(spec.frozen_at),
            templateProblem: str(spec.template_problem),
          }
        : null,
    previousSpec: previous
      ? { templateSnapshotId: str(previous.template_snapshot_id), preferenceCategory: str(previous.preference_category) }
      : null,
    operatorDenial: str(root.operator_denial),
    runs: Array.isArray(root.runs)
      ? root.runs.map(parseWhatsappCampaignRun).filter((run): run is WhatsappCampaignRunView => run !== null)
      : [],
  };
}

export interface WhatsappCampaignTemplateOption {
  readonly snapshotId: string;
  readonly templateId: string | null;
  readonly name: string;
  readonly language: string;
  readonly parameterFormat: string;
  readonly components: unknown;
  readonly qualityRating: string | null;
}

/** `list_whatsapp_campaign_template_options`: sendable APPROVED MARKETING snapshots only. */
export function parseWhatsappCampaignTemplateOptions(data: unknown): readonly WhatsappCampaignTemplateOption[] {
  if (!Array.isArray(data)) return [];
  const out: WhatsappCampaignTemplateOption[] = [];
  for (const item of data) {
    const row = asRecord(item);
    const snapshotId = str(row?.snapshot_id);
    if (!row || !snapshotId) continue;
    out.push({
      snapshotId,
      templateId: str(row.template_id),
      name: str(row.name) ?? "template",
      language: str(row.language) ?? "",
      parameterFormat: str(row.parameter_format) ?? "POSITIONAL",
      components: row.components ?? [],
      qualityRating: str(row.quality_rating),
    });
  }
  return out;
}

export interface WhatsappCampaignTestDestination {
  readonly profileId: string;
  readonly label: string;
  readonly phoneLast4: string | null;
  readonly isSelf: boolean;
}

export function parseWhatsappCampaignTestDestinations(data: unknown): readonly WhatsappCampaignTestDestination[] {
  if (!Array.isArray(data)) return [];
  return data
    .map((item) => {
      const row = asRecord(item);
      const profileId = str(row?.profile_id);
      if (!row || !profileId) return null;
      return {
        profileId,
        label: str(row.label) ?? "Internal staff",
        phoneLast4: str(row.phone_last4),
        isSelf: row.is_self === true,
      };
    })
    .filter((row): row is WhatsappCampaignTestDestination => row !== null);
}

export interface WhatsappCampaignPreview {
  readonly totalMatched: number;
  readonly eligible: number;
  readonly reasons: readonly { readonly code: string; readonly count: number }[];
  readonly templateProblem: string | null;
  readonly buttonBindingsProblem: string | null;
  readonly policyConfigured: boolean;
  readonly policyVersion: number | null;
  readonly executionEnabled: boolean;
  readonly quietUntil: string | null;
  readonly segmentChangedSinceSaved: boolean;
  readonly audienceRuleFrozen: boolean;
}

/** `preview_whatsapp_campaign_audience`: counts in first-failing precedence, never a recipient list. */
export function parseWhatsappCampaignPreview(data: unknown): WhatsappCampaignPreview | null {
  const row = asRecord(data);
  if (!row || typeof row.total_matched !== "number") return null;
  const reasons = Object.entries(asRecord(row.reasons) ?? {})
    .filter(([, count]) => typeof count === "number")
    .map(([code, count]) => ({ code, count: count as number }))
    .sort((a, b) => b.count - a.count || a.code.localeCompare(b.code));
  return {
    totalMatched: num(row.total_matched),
    eligible: num(row.eligible),
    reasons,
    templateProblem: str(row.template_problem),
    buttonBindingsProblem: str(row.button_bindings_problem),
    policyConfigured: row.policy_configured === true,
    policyVersion: typeof row.policy_version === "number" ? row.policy_version : null,
    executionEnabled: row.execution_enabled === true,
    quietUntil: str(row.quiet_until),
    segmentChangedSinceSaved: row.segment_changed_since_saved === true,
    audienceRuleFrozen: row.audience_rule_frozen === true,
  };
}

export interface WhatsappCampaignRunBreakdown {
  readonly recipientStates: Readonly<Record<string, number>>;
  readonly reasons: readonly { readonly code: string; readonly count: number }[];
  readonly jobStates: Readonly<Record<string, number>>;
  readonly deferredCount: number;
  readonly retryingCount: number;
  readonly nextNotBefore: string | null;
  readonly reconcileJobIds: readonly string[];
}

function countMap(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, count] of Object.entries(asRecord(value) ?? {})) {
    if (typeof count === "number") out[key] = count;
  }
  return out;
}

export function parseWhatsappCampaignRunBreakdown(data: unknown): WhatsappCampaignRunBreakdown | null {
  const row = asRecord(data);
  if (!row || !str(row.run_id)) return null;
  return {
    recipientStates: countMap(row.recipient_states),
    reasons: Object.entries(countMap(row.reasons))
      .map(([code, count]) => ({ code, count }))
      .sort((a, b) => b.count - a.count),
    jobStates: countMap(row.job_states),
    deferredCount: num(row.deferred_count),
    retryingCount: num(row.retrying_count),
    nextNotBefore: str(row.next_not_before),
    reconcileJobIds: Array.isArray(row.reconcile_job_ids)
      ? row.reconcile_job_ids.filter((id): id is string => typeof id === "string")
      : [],
  };
}

/** First-failing reason codes (WM-0 §8.1) plus claim-time button reasons, in staff words. */
export const WHATSAPP_CAMPAIGN_REASON_LABELS: Readonly<Record<string, string>> = {
  run_not_active: "Run not dispatching",
  template_not_approved: "Template no longer approved",
  template_category_not_marketing: "Template is not MARKETING",
  already_sent: "Already sent",
  contact_missing: "Contact missing",
  contact_do_not_contact: "Do not contact",
  contact_inactive: "Contact inactive",
  whatsapp_channel_missing: "No WhatsApp number",
  channel_suppressed: "Number suppressed",
  channel_invalid: "Number invalid",
  channel_inactive: "Number inactive",
  marketing_consent_missing: "No marketing consent",
  marketing_consent_withdrawn: "Marketing consent withdrawn",
  marketing_consent_suppressed: "Marketing consent suppressed",
  marketing_consent_expired: "Marketing consent expired",
  preference_opted_out: "Opted out of this category",
  variables_missing: "Template values missing",
  variables_invalid: "Template values invalid",
  send_policy_unconfigured: "Send policy off or unconfigured",
  frequency_capped: "Frequency cap reached",
  quiet_hours: "Deferred for quiet hours",
  click_destination_unavailable: "Tracked link destination inactive",
  button_binding_missing: "Template button not mapped",
  flow_unavailable: "Flow not published",
  business_phone_unavailable: "No active business number",
  attempts_exhausted: "Retries exhausted",
  provider_outcome_unknown: "Provider outcome unknown",
  reconciled_not_sent: "Resolved as not sent",
  run_cancelled: "Run cancelled",
};

export function describeWhatsappCampaignReason(code: string): string {
  return WHATSAPP_CAMPAIGN_REASON_LABELS[code] ?? code.replace(/_/g, " ");
}

/**
 * `claim_whatsapp_campaign_dispatch_jobs` returns a jsonb array of
 * {job_id, claim_token, attempt, phone_number_id (Meta's id), recipient_e164,
 * template_name, template_language, template_components}.
 */
export type WhatsappCampaignClaimedJob = {
  readonly jobId: string;
  readonly claimToken: string;
  readonly attempt: number;
  readonly phoneNumberId: string | null;
  readonly recipientE164: string | null;
  readonly templateName: string | null;
  readonly templateLanguage: string | null;
  readonly components: readonly unknown[] | null;
};

/** Parses any claim list whose id lives under `idKey` (job_id, test_send_id, enrollment_id). */
export function parseWhatsappMarketingClaims(
  data: unknown,
  idKey: "job_id" | "test_send_id" | "enrollment_id"
): readonly WhatsappCampaignClaimedJob[] {
  const list = Array.isArray(data) ? data : (asRecord(data)?.jobs ?? []);
  if (!Array.isArray(list)) return [];
  const jobs: WhatsappCampaignClaimedJob[] = [];
  for (const item of list) {
    const row = asRecord(item);
    if (!row) continue;
    const jobId = str(row[idKey]);
    const claimToken = str(row.claim_token);
    if (!jobId || !claimToken) continue;
    const attemptRaw = row.attempt;
    const components = row.template_components;
    jobs.push({
      jobId,
      claimToken,
      attempt: typeof attemptRaw === "number" && Number.isFinite(attemptRaw) ? attemptRaw : 1,
      phoneNumberId: str(row.phone_number_id),
      recipientE164: str(row.recipient_e164),
      templateName: str(row.template_name),
      templateLanguage: str(row.template_language),
      components: Array.isArray(components) ? components : null,
    });
    if (jobs.length >= WHATSAPP_CAMPAIGN_WORKER_MAX_BATCH) break;
  }
  return jobs;
}

export function parseWhatsappCampaignClaimedJobs(data: unknown): readonly WhatsappCampaignClaimedJob[] {
  return parseWhatsappMarketingClaims(data, "job_id");
}

/* ------------------------------------------------------------------ */
/* Spec form                                                           */
/* ------------------------------------------------------------------ */

/** Per-recipient CRM values SQL accepts in `parameter_bindings` (whatsapp_campaign_bindings_problem). */
export const WHATSAPP_CAMPAIGN_BINDING_SOURCES = ["contact_first_name", "contact_display_name"] as const;

export type WhatsappCampaignBindingSource = (typeof WHATSAPP_CAMPAIGN_BINDING_SOURCES)[number];

export const WHATSAPP_CAMPAIGN_BINDING_LABELS: Readonly<Record<WhatsappCampaignBindingSource, string>> = {
  contact_first_name: "Contact first name",
  contact_display_name: "Contact full name",
};

export function whatsappCampaignParameterFieldName(component: "header" | "body", key: string, part: "value" | "source"): string {
  return `${part === "value" ? "param" : "bind"}:${component}:${key}`;
}

/**
 * Reads the spec form: for every template variable either a static value or
 * an allowlisted CRM binding. Unknown field names are ignored, so a crafted
 * form cannot add components; SQL validates the result against the snapshot.
 */
export function readWhatsappCampaignSpecParameters(
  entries: Iterable<[string, FormDataEntryValue | string]>
): { readonly defaults: Record<string, Record<string, string>>; readonly bindings: Record<string, Record<string, string>> } {
  const defaults: Record<string, Record<string, string>> = {};
  const bindings: Record<string, Record<string, string>> = {};
  const sources = new Map<string, string>();
  const values = new Map<string, string>();
  for (const [name, raw] of entries) {
    if (typeof raw !== "string") continue;
    const match = /^(param|bind):(header|body):([A-Za-z0-9_]{1,64})$/.exec(name);
    if (!match) continue;
    const slot = `${match[2]}:${match[3]}`;
    if (match[1] === "bind") sources.set(slot, raw.trim());
    else values.set(slot, raw);
  }
  for (const slot of new Set([...sources.keys(), ...values.keys()])) {
    const [component, key] = slot.split(":") as ["header" | "body", string];
    const source = sources.get(slot) ?? "";
    if ((WHATSAPP_CAMPAIGN_BINDING_SOURCES as readonly string[]).includes(source)) {
      (bindings[component] ??= {})[key] = source;
      continue;
    }
    const value = (values.get(slot) ?? "").trim();
    if (value !== "") (defaults[component] ??= {})[key] = value;
  }
  return { defaults, bindings };
}

/** A template button the database fills per recipient: tracked URL suffix or official Flow. */
export interface WhatsappTemplateButtonSlot {
  readonly index: number;
  readonly kind: "url" | "flow";
  readonly text: string;
  readonly url: string | null;
  readonly providerFlowId: string | null;
}

/** Mirrors private.whatsapp_template_dynamic_url_buttons / whatsapp_template_flow_buttons. */
export function whatsappTemplateButtonSlots(components: unknown): readonly WhatsappTemplateButtonSlot[] {
  if (!Array.isArray(components)) return [];
  const slots: WhatsappTemplateButtonSlot[] = [];
  for (const component of components) {
    const record = asRecord(component);
    if (!record || String(record.type ?? "").toUpperCase() !== "BUTTONS" || !Array.isArray(record.buttons)) continue;
    record.buttons.forEach((button, index) => {
      const b = asRecord(button);
      if (!b) return;
      const type = String(b.type ?? "").toUpperCase();
      const url = typeof b.url === "string" ? b.url : null;
      if (type === "URL" && url && url.includes("{{")) {
        slots.push({ index, kind: "url", text: str(b.text) ?? "Link", url, providerFlowId: null });
      } else if (type === "FLOW") {
        slots.push({ index, kind: "flow", text: str(b.text) ?? "Form", url: null, providerFlowId: str(b.flow_id) });
      }
    });
  }
  return slots.sort((a, b) => a.index - b.index);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `button:<index>` → {kind, destination_id|flow_id}. Only slots the template actually has are kept. */
export function readWhatsappCampaignButtonBindings(
  entries: Iterable<[string, FormDataEntryValue | string]>,
  slots: readonly WhatsappTemplateButtonSlot[]
): Record<string, { readonly kind: "click_destination"; readonly destination_id: string } | { readonly kind: "flow"; readonly flow_id: string }> {
  const out: Record<string, { kind: "click_destination"; destination_id: string } | { kind: "flow"; flow_id: string }> = {};
  for (const [name, raw] of entries) {
    const match = /^button:([0-9])$/.exec(name);
    if (!match || typeof raw !== "string" || !UUID.test(raw.trim())) continue;
    const slot = slots.find((candidate) => candidate.index === Number(match[1]));
    if (!slot) continue;
    out[match[1]!] = slot.kind === "url" ? { kind: "click_destination", destination_id: raw.trim() } : { kind: "flow", flow_id: raw.trim() };
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Caller input                                                        */
/* ------------------------------------------------------------------ */

/** `scheduled_for` arrives as an ISO instant; empty means "now". */
export function parseWhatsappCampaignScheduledFor(
  raw: string,
  now: Date = new Date()
): { readonly ok: true; readonly value: string | null } | { readonly ok: false; readonly message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return { ok: false, message: "Choose a valid schedule time." };
  if (date.getTime() < now.getTime() - 60_000) return { ok: false, message: "The schedule time is in the past." };
  if (date.getTime() > now.getTime() + 90 * 86_400_000) return { ok: false, message: "Schedule within the next 90 days." };
  return { ok: true, value: date.toISOString() };
}

/* ------------------------------------------------------------------ */
/* Provider result → completion                                        */
/* ------------------------------------------------------------------ */

/**
 * `complete_whatsapp_campaign_dispatch_failure` (and the automation twin)
 * accept exactly these. SQL owns the consequence: ambiguous → needs_reconcile
 * (never retried); transient → pending with backoff while attempt_count < 3,
 * else failed; terminal → failed.
 */
export const WHATSAPP_CAMPAIGN_FAILURE_OUTCOMES = ["transient", "terminal", "ambiguous"] as const;

export type WhatsappCampaignFailureOutcome = (typeof WHATSAPP_CAMPAIGN_FAILURE_OUTCOMES)[number];

export type WhatsappCampaignCompletionDecision =
  | { readonly rpc: "success" }
  | { readonly rpc: "failure"; readonly outcome: WhatsappCampaignFailureOutcome; readonly errorCode: string };

/**
 * Success binds. Ambiguous is parked for reconciliation. A transient failure
 * on the last allowed attempt is reported terminal, so the app never asks for
 * a retry SQL would refuse anyway.
 */
export function decideWhatsappCampaignCompletion(
  result:
    | { readonly kind: "success" }
    | { readonly kind: "ambiguous"; readonly code: string }
    | { readonly kind: "failed"; readonly errorClass: "transient" | "terminal"; readonly code: string },
  attempt: number
): WhatsappCampaignCompletionDecision {
  if (result.kind === "success") return { rpc: "success" };
  const errorCode = result.code.slice(0, 64) || "provider_error";
  if (result.kind === "ambiguous") return { rpc: "failure", outcome: "ambiguous", errorCode };
  if (result.errorClass === "transient" && attempt < WHATSAPP_CAMPAIGN_MAX_ATTEMPTS) {
    return { rpc: "failure", outcome: "transient", errorCode };
  }
  return { rpc: "failure", outcome: "terminal", errorCode };
}

/** Failure RPC reply → worker tally. */
export function classifyWhatsappCampaignFailureReply(
  data: unknown,
  requested: WhatsappCampaignFailureOutcome
): "retry_scheduled" | "needs_reconcile" | "failed_terminal" {
  const outcome = asRecord(data)?.outcome;
  if (outcome === "retry_scheduled" || outcome === "needs_reconcile" || outcome === "failed_terminal") return outcome;
  return requested === "ambiguous" ? "needs_reconcile" : requested === "transient" ? "retry_scheduled" : "failed_terminal";
}

/** `create_whatsapp_campaign_test_send` registers a pending test to a staff phone. */
export function parseWhatsappCampaignTestSendPayload(data: unknown): { readonly testSendId: string; readonly outcome: string } | null {
  const row = asRecord(data);
  const testSendId = str(row?.test_send_id);
  if (!row || !testSendId) return null;
  return { testSendId, outcome: str(row.outcome) ?? "pending" };
}

/** Postgres errors the WM-4 RPCs raise, mapped to what staff can act on. */
export function describeWhatsappCampaignRpcError(error: {
  readonly code?: string | null;
  readonly message?: string | null;
}): { readonly code: string; readonly message: string } {
  const message = error.message ?? "";
  if (message.includes("WHATSAPP_CAMPAIGN_APPROVER_CANNOT_EXECUTE")) {
    return { code: "APPROVER_CANNOT_EXECUTE", message: "You approved this version, so a different operator must run it." };
  }
  if (message.includes("WHATSAPP_MARKETING_EXECUTION_DISABLED")) {
    return { code: "EXECUTION_DISABLED", message: "Marketing execution is off in Settings & Compliance." };
  }
  if (message.includes("WHATSAPP_CAMPAIGN_CANCEL_UNSAFE")) {
    return { code: "CANCEL_UNSAFE", message: "A send is in flight or awaiting reconciliation, so the run cannot be cancelled yet." };
  }
  if (message.includes("WHATSAPP_CAMPAIGN_VERSION_ALREADY_EXECUTED")) {
    return { code: "ALREADY_EXECUTED", message: "This approved version already has a run. A new delivery needs a new version." };
  }
  if (message.includes("WHATSAPP_CAMPAIGN_TEST_RATE_LIMITED")) {
    return { code: "RATE_LIMITED", message: "Test send limit reached for this version. Try again later." };
  }
  if (message.includes("WHATSAPP_CAMPAIGN_SPEC_FROZEN")) {
    return { code: "SPEC_FROZEN", message: "The spec is frozen. Create a new campaign version to change it." };
  }
  if (message.includes("WHATSAPP_RECONCILE_NOTE_REQUIRED")) {
    return { code: "VALIDATION", message: "Write a note of at least 8 characters describing the evidence." };
  }
  const invalid = /WHATSAPP_CAMPAIGN_(?:SPEC_INVALID|TEMPLATE_NOT_SENDABLE|TEST_PARAMETERS_INVALID): ([a-z_]+)/.exec(message);
  if (invalid) {
    return { code: "REFUSED", message: `The database refused this spec: ${describeWhatsappCampaignReason(invalid[1]!)}.` };
  }
  switch (error.code ?? "") {
    case "42501":
      return { code: "ACCESS_DENIED", message: "You do not have permission for this campaign action." };
    case "22023":
      return {
        code: "REFUSED",
        message: "The database refused this action. Check the approval, the WhatsApp-only channel, the template, the send policy and the run status.",
      };
    case "P0002":
      return { code: "NOT_FOUND", message: "That campaign or run does not exist or is not visible to you." };
    case "23505":
      return { code: "CONFLICT", message: "That action was already recorded." };
    default:
      return { code: "RPC_FAILED", message: "The campaign action could not be completed. Try again." };
  }
}
