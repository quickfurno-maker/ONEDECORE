/**
 * WM-5 — WhatsApp analytics and attribution contracts.
 *
 * Authoritative database half:
 *   supabase/migrations/20260917100000_whatsapp_analytics_attribution.sql
 *   supabase/migrations/20260918100000_whatsapp_automations_flows_referrals.sql
 *
 *   whatsapp.analytics.read   Super Admin, Sales Manager (aggregates only)
 *   whatsapp.reports.export   Super Admin (minimised per-recipient CSV, audited)
 *
 * Every stage is canonical evidence: bound messages, provider status events,
 * non-bot clicks on opaque tokens, reply attributions (exact context first,
 * labelled inference second) and CRM lead events, finalized quotations and
 * acceptances inside a 30-day window. Nothing here invents a status. Pure.
 */

export const WHATSAPP_ANALYTICS_RPC = {
  overview: "get_whatsapp_analytics_overview",
  runAnalytics: "get_whatsapp_campaign_run_analytics",
  automationAnalytics: "get_whatsapp_automation_analytics",
  referralAnalytics: "get_whatsapp_referral_analytics",
  exportRunReport: "export_whatsapp_campaign_run_report",
} as const;

export const WHATSAPP_ANALYTICS_RANGES = [
  { key: "7d", label: "7 days", days: 7 },
  { key: "30d", label: "30 days", days: 30 },
  { key: "90d", label: "90 days", days: 90 },
  { key: "365d", label: "12 months", days: 365 },
] as const;

export type WhatsappAnalyticsRangeKey = (typeof WHATSAPP_ANALYTICS_RANGES)[number]["key"];

export function resolveWhatsappAnalyticsRange(
  raw: unknown,
  now: Date = new Date()
): { readonly key: WhatsappAnalyticsRangeKey; readonly from: string; readonly to: string } {
  const match = WHATSAPP_ANALYTICS_RANGES.find((range) => range.key === raw) ?? WHATSAPP_ANALYTICS_RANGES[1];
  return { key: match.key, from: new Date(now.getTime() - match.days * 86_400_000).toISOString(), to: now.toISOString() };
}

/** The canonical funnel, in order. `key` is the SQL summary field. */
export const WHATSAPP_FUNNEL_STAGES = [
  { key: "sent", label: "Sent", evidence: "Canonical outbound message bound to the recipient" },
  { key: "delivered", label: "Delivered", evidence: "Provider status delivered or read" },
  { key: "read", label: "Read", evidence: "Provider status read" },
  { key: "clicked", label: "Clicked", evidence: "Non-bot click on the recipient's opaque token" },
  { key: "replied", label: "Replied", evidence: "Exact reply context, or first reply within 72h (inferred)" },
  { key: "consultation", label: "Consultation", evidence: "Lead moved to consultation scheduled within 30 days" },
  { key: "quotation", label: "Quotation", evidence: "Quotation finalized within 30 days" },
  { key: "booking", label: "Booking", evidence: "Quotation accepted within 30 days" },
] as const;

export type WhatsappFunnelStageKey = (typeof WHATSAPP_FUNNEL_STAGES)[number]["key"];

export type WhatsappFunnelSummary = Readonly<Record<string, number>>;

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function counts(value: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, entry] of Object.entries(asRecord(value) ?? {})) {
    if (typeof entry === "number" && Number.isFinite(entry)) out[key] = entry;
  }
  return out;
}

/** Stage-to-stage conversion from the stage before it; null when the base is empty. */
export function whatsappFunnelRate(summary: WhatsappFunnelSummary, stage: WhatsappFunnelStageKey): number | null {
  const index = WHATSAPP_FUNNEL_STAGES.findIndex((entry) => entry.key === stage);
  const base = index <= 0 ? summary.targeted ?? 0 : summary[WHATSAPP_FUNNEL_STAGES[index - 1]!.key] ?? 0;
  if (!base) return null;
  return (summary[stage] ?? 0) / base;
}

export function formatWhatsappRate(rate: number | null): string {
  return rate === null ? "—" : `${(rate * 100).toFixed(rate >= 0.1 ? 0 : 1)}%`;
}

export interface WhatsappAnalyticsRunRow {
  readonly runId: string;
  readonly status: string;
  readonly createdAt: string | null;
  readonly campaignName: string;
  readonly versionNumber: number;
  readonly templateName: string | null;
  readonly funnel: WhatsappFunnelSummary;
}

export interface WhatsappAnalyticsOverview {
  readonly from: string | null;
  readonly to: string | null;
  readonly attributionWindowDays: number;
  readonly channel: WhatsappFunnelSummary;
  readonly campaignFunnel: WhatsappFunnelSummary;
  readonly runs: readonly WhatsappAnalyticsRunRow[];
}

export function parseWhatsappAnalyticsOverview(data: unknown): WhatsappAnalyticsOverview | null {
  const row = asRecord(data);
  if (!row || !asRecord(row.channel)) return null;
  const range = asRecord(row.range);
  return {
    from: str(range?.from),
    to: str(range?.to),
    attributionWindowDays: typeof row.attribution_window_days === "number" ? row.attribution_window_days : 30,
    channel: counts(row.channel),
    campaignFunnel: counts(row.campaign_funnel),
    runs: (Array.isArray(row.runs) ? row.runs : []).flatMap((item) => {
      const run = asRecord(item);
      const runId = str(run?.run_id);
      return run && runId
        ? [
            {
              runId,
              status: str(run.status) ?? "unknown",
              createdAt: str(run.created_at),
              campaignName: str(run.campaign_name) ?? "Campaign",
              versionNumber: typeof run.version_number === "number" ? run.version_number : 0,
              templateName: str(run.template_name),
              funnel: counts(run.funnel),
            },
          ]
        : [];
    }),
  };
}

export interface WhatsappRunAnalytics {
  readonly runId: string;
  readonly campaignName: string;
  readonly versionNumber: number;
  readonly status: string;
  readonly funnel: WhatsappFunnelSummary;
  readonly clicksByDestination: readonly { readonly label: string; readonly clicks: number; readonly recipients: number }[];
  readonly botClicks: number;
  readonly replyLag: WhatsappFunnelSummary;
  readonly reasons: WhatsappFunnelSummary;
}

export function parseWhatsappRunAnalytics(data: unknown): WhatsappRunAnalytics | null {
  const row = asRecord(data);
  const runId = str(row?.run_id);
  if (!row || !runId) return null;
  return {
    runId,
    campaignName: str(row.campaign_name) ?? "Campaign",
    versionNumber: typeof row.version_number === "number" ? row.version_number : 0,
    status: str(row.status) ?? "unknown",
    funnel: counts(row.funnel),
    clicksByDestination: (Array.isArray(row.clicks_by_destination) ? row.clicks_by_destination : []).flatMap((item) => {
      const entry = asRecord(item);
      return entry && str(entry.label)
        ? [{ label: str(entry.label)!, clicks: Number(entry.clicks) || 0, recipients: Number(entry.recipients) || 0 }]
        : [];
    }),
    botClicks: typeof row.bot_clicks === "number" ? row.bot_clicks : 0,
    replyLag: counts(row.reply_lag),
    reasons: counts(row.reasons),
  };
}

export interface WhatsappAutomationAnalyticsRow {
  readonly automationId: string;
  readonly name: string;
  readonly status: string;
  readonly triggerType: string;
  readonly funnel: WhatsappFunnelSummary;
}

export function parseWhatsappAutomationAnalytics(data: unknown): readonly WhatsappAutomationAnalyticsRow[] {
  const row = asRecord(data);
  return (Array.isArray(row?.automations) ? row.automations : []).flatMap((item) => {
    const entry = asRecord(item);
    const automationId = str(entry?.automation_id);
    return entry && automationId
      ? [
          {
            automationId,
            name: str(entry.name) ?? "Automation",
            status: str(entry.status) ?? "unknown",
            triggerType: str(entry.trigger_type) ?? "",
            funnel: counts(entry),
          },
        ]
      : [];
  });
}

export interface WhatsappReferralAnalytics {
  readonly totalReferrals: number;
  readonly sources: readonly {
    readonly sourceId: string | null;
    readonly sourceType: string | null;
    readonly headline: string | null;
    readonly sourceUrlHost: string | null;
    readonly funnel: WhatsappFunnelSummary;
  }[];
}

export function parseWhatsappReferralAnalytics(data: unknown): WhatsappReferralAnalytics | null {
  const row = asRecord(data);
  if (!row) return null;
  return {
    totalReferrals: typeof row.total_referrals === "number" ? row.total_referrals : 0,
    sources: (Array.isArray(row.sources) ? row.sources : []).flatMap((item) => {
      const entry = asRecord(item);
      return entry
        ? [
            {
              sourceId: str(entry.source_id),
              sourceType: str(entry.source_type),
              headline: str(entry.headline),
              sourceUrlHost: str(entry.source_url_host),
              funnel: counts(entry),
            },
          ]
        : [];
    }),
  };
}

/* ------------------------------------------------------------------ */
/* Export                                                              */
/* ------------------------------------------------------------------ */

/** The minimised export columns, exactly. No name, no full number, no message text. */
export const WHATSAPP_RUN_REPORT_COLUMNS = [
  "recipient_ref",
  "contact_id",
  "phone_last4",
  "state",
  "reason_code",
  "sent_at",
  "delivered_at",
  "read_at",
  "provider_failed_at",
  "first_click_at",
  "click_count",
  "replied_at",
  "reply_method",
  "consultation",
  "quotation",
  "booking",
  "opted_out",
] as const;

/** CSV-escapes a cell and neutralises spreadsheet formula injection. */
export function escapeWhatsappCsvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "string" ? value : typeof value === "number" || typeof value === "boolean" ? String(value) : JSON.stringify(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildWhatsappRunReportCsv(data: unknown): { readonly csv: string; readonly rows: number; readonly truncated: boolean } | null {
  const row = asRecord(data);
  if (!row || !Array.isArray(row.rows)) return null;
  const lines = [WHATSAPP_RUN_REPORT_COLUMNS.join(",")];
  for (const item of row.rows) {
    const record = asRecord(item);
    if (!record) continue;
    lines.push(WHATSAPP_RUN_REPORT_COLUMNS.map((column) => escapeWhatsappCsvCell(record[column])).join(","));
  }
  return { csv: `${lines.join("\r\n")}\r\n`, rows: lines.length - 1, truncated: row.truncated === true };
}
