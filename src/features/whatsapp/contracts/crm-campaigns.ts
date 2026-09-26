import type { AudienceRule, AudienceRuleGroup } from "@/features/marketing/contracts/audience-rule";

export const WHATSAPP_CRM_SALES_TEMPERATURES = ["hot", "warm", "cold", "lost"] as const;
export type WhatsappCrmSalesTemperature = (typeof WHATSAPP_CRM_SALES_TEMPERATURES)[number];

export const WHATSAPP_CRM_TEMPERATURE_LABELS: Record<WhatsappCrmSalesTemperature, string> = {
  hot: "Hot leads",
  warm: "Warm leads",
  cold: "Cold leads",
  lost: "Lost leads",
};

export const WHATSAPP_CRM_STAGE_OPTIONS = [
  ["new", "New"],
  ["assigned", "Assigned"],
  ["contacted", "Contacted"],
  ["qualified", "Qualified"],
  ["consultation_scheduled", "Consultation scheduled"],
  ["site_visit_scheduled", "Site visit scheduled"],
  ["proposal_sent", "Quotation / proposal sent"],
  ["negotiation", "Negotiation"],
  ["on_hold", "On hold"],
  ["closed_won", "Closed won"],
  ["closed_lost", "Closed lost"],
] as const;

export const WHATSAPP_CRM_SERVICE_OPTIONS = [
  ["complete-home-interiors", "Complete home interiors"],
  ["modular-kitchens", "Modular kitchens"],
  ["custom-wardrobes", "Custom wardrobes"],
] as const;

export const WHATSAPP_CRM_BUDGET_OPTIONS = [
  ["under-3l", "Under ₹3L"],
  ["3-6l", "₹3L–₹6L"],
  ["6-12l", "₹6L–₹12L"],
  ["12-20l", "₹12L–₹20L"],
  ["20-30l", "₹20L–₹30L"],
  ["30l-plus", "₹30L+"],
  ["unspecified", "Budget not set"],
] as const;
export const WHATSAPP_CRM_ACTIVITY_AGE_OPTIONS = [
  ["0-7d", "Last 7 days"],
  ["8-14d", "8–14 days"],
  ["15-30d", "15–30 days"],
  ["31-60d", "31–60 days"],
  ["60d+", "60+ days"],
] as const;

export const WHATSAPP_CRM_MILESTONE_OPTIONS = [
  ["consultation", "Consultation reached"],
  ["site_visit", "Site visit reached"],
  ["quotation", "Quotation reached"],
] as const;

export const WHATSAPP_CRM_DORMANT_OPTIONS = [
  ["0-7d", "On hold ≤7 days"],
  ["8-14d", "On hold 8–14 days"],
  ["15-30d", "On hold 15–30 days"],
  ["31-60d", "On hold 31–60 days"],
  ["60d+", "On hold 60+ days"],
  ["not_dormant", "Not on hold"],
] as const;

export interface WhatsappCrmCampaignFilters {
  readonly stage?: string;
  readonly service?: string;
  readonly source?: string;
  readonly locality?: string;
  readonly owner?: string;
  readonly budget?: string;
  readonly lastInteractionAge?: string;
  readonly milestone?: string;
  readonly dormantDuration?: string;
}

export interface WhatsappCrmCampaignFilterOptions {
  readonly sources: readonly { readonly value: string; readonly label: string }[];
  readonly owners: readonly { readonly value: string; readonly label: string }[];
  readonly localities: readonly string[];
}

const MONTH_RE = /^[0-9]{4}-(0[1-9]|1[0-2])$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isWhatsappCrmLeadMonth(value: string | null | undefined): value is string {
  return typeof value === "string" && MONTH_RE.test(value);
}

function oneOf<T extends readonly (readonly [string, string])[]>(value: string | undefined, options: T): string | undefined {
  return value && options.some(([candidate]) => candidate === value) ? value : undefined;
}
export function sanitizeWhatsappCrmCampaignFilters(input: WhatsappCrmCampaignFilters): WhatsappCrmCampaignFilters {
  const locality = input.locality?.trim().slice(0, 120);
  const source = input.source?.trim().toLowerCase().slice(0, 120);
  const owner = input.owner === "unassigned" || (input.owner && UUID_RE.test(input.owner)) ? input.owner : undefined;
  return {
    stage: oneOf(input.stage, WHATSAPP_CRM_STAGE_OPTIONS),
    service: oneOf(input.service, WHATSAPP_CRM_SERVICE_OPTIONS),
    source: source || undefined,
    locality: locality || undefined,
    owner,
    budget: oneOf(input.budget, WHATSAPP_CRM_BUDGET_OPTIONS),
    lastInteractionAge: oneOf(input.lastInteractionAge, WHATSAPP_CRM_ACTIVITY_AGE_OPTIONS),
    milestone: oneOf(input.milestone, WHATSAPP_CRM_MILESTONE_OPTIONS),
    dormantDuration: oneOf(input.dormantDuration, WHATSAPP_CRM_DORMANT_OPTIONS),
  };
}

function istDateParts(now = new Date()): Record<string, string> {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(now)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
}

export function currentIstMonth(now = new Date()): string {
  const parts = istDateParts(now);
  return `${parts.year ?? "1970"}-${parts.month ?? "01"}`;
}

export function currentIstDate(now = new Date()): string {
  const parts = istDateParts(now);
  return `${parts.year ?? "1970"}-${parts.month ?? "01"}-${parts.day ?? "01"}`;
}

export function whatsappCrmMonthLabel(month: string): string {
  if (!isWhatsappCrmLeadMonth(month)) return month;
  const [year, rawMonth] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: "Asia/Kolkata",
  }).format(new Date(Date.UTC(year!, rawMonth! - 1, 15)));
}
export function buildWhatsappCrmAudienceRule(
  temperature: WhatsappCrmSalesTemperature,
  month: string,
  rawFilters: WhatsappCrmCampaignFilters = {}
): AudienceRuleGroup {
  if (!WHATSAPP_CRM_SALES_TEMPERATURES.includes(temperature)) {
    throw new Error("Invalid CRM sales temperature.");
  }
  if (!isWhatsappCrmLeadMonth(month)) {
    throw new Error("Invalid CRM lead month.");
  }

  const filters = sanitizeWhatsappCrmCampaignFilters(rawFilters);
  const rules: AudienceRule[] = [
    { field: "sales_temperature", operator: "equals", values: [temperature] },
    { field: "lead_created_month", operator: "equals", values: [month] },
  ];

  const add = (field: AudienceRule["field"], value: string | undefined) => {
    if (value) rules.push({ field, operator: "equals", values: [value] });
  };
  add("lead_stage", filters.stage);
  add("service_interest", filters.service);
  add("lead_source", filters.source);
  add("locality", filters.locality?.toLowerCase());
  add("owner", filters.owner);
  add("budget", filters.budget);
  add("last_interaction_age", filters.lastInteractionAge);
  add("milestone", filters.milestone);
  add("dormant_duration", filters.dormantDuration);

  return { logic: "and", rules };
}

export function resolveIstMonthWindow(month: string): { startIso: string; endIso: string } {
  if (!isWhatsappCrmLeadMonth(month)) throw new Error("Invalid CRM lead month.");
  const [year, rawMonth] = month.split("-").map(Number);
  const offsetMs = 5.5 * 60 * 60 * 1000;
  const startUtc = Date.UTC(year!, rawMonth! - 1, 1) - offsetMs;
  const endUtc = Date.UTC(year!, rawMonth!, 1) - offsetMs;
  return { startIso: new Date(startUtc).toISOString(), endIso: new Date(endUtc).toISOString() };
}

export interface WhatsappCrmAudienceCounts {
  readonly month: string;
  readonly hot: number;
  readonly warm: number;
  readonly cold: number;
  readonly lost: number;
  readonly total: number;
}
