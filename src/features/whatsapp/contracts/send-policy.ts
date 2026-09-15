/**
 * WM-3 — the versioned WhatsApp marketing send policy.
 *
 * Every save appends a new version (the table is append-only). There are no
 * default caps or quiet hours in code: no policy, or a policy this parser does
 * not recognise, reads as "not configured" and campaign execution stays
 * blocked. The execution gate defaults to off and turning it on needs an
 * explicit confirmation in the same submission.
 */

import type { Json } from "../../../types/database.ts";

/*
 * Restated from the WM-0 preferences contract
 * because the channel core may not import the marketing module. The WM-3 suite
 * checks this validator against the WM-0 one on the same inputs, and both
 * against the ranges in `set_whatsapp_marketing_send_policy`.
 */
export const WHATSAPP_MARKETING_DEFAULT_TIMEZONE = "Asia/Kolkata" as const;

export interface WhatsappMarketingFrequencyRule {
  readonly windowHours: number;
  readonly maxMessages: number;
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateWhatsappSendPolicyValues(policy: {
  readonly frequencyRules: readonly WhatsappMarketingFrequencyRule[];
  readonly quietHours: { readonly timezone: string; readonly startLocal: string; readonly endLocal: string };
}): { readonly ok: true } | { readonly ok: false; readonly problems: readonly string[] } {
  const problems: string[] = [];
  if (policy.frequencyRules.length === 0) problems.push("at least one frequency rule is required");
  for (const rule of policy.frequencyRules) {
    if (!Number.isInteger(rule.windowHours) || rule.windowHours < 1 || rule.windowHours > 24 * 90) {
      problems.push("frequency windowHours must be an integer between 1 and 2160");
    }
    if (!Number.isInteger(rule.maxMessages) || rule.maxMessages < 1 || rule.maxMessages > 100) {
      problems.push("frequency maxMessages must be an integer between 1 and 100");
    }
  }
  if (!HH_MM.test(policy.quietHours.startLocal) || !HH_MM.test(policy.quietHours.endLocal)) {
    problems.push("quiet hours must be HH:MM");
  }
  if (policy.quietHours.startLocal === policy.quietHours.endLocal) {
    problems.push("quiet hours start and end must differ");
  }
  try {
    new Intl.DateTimeFormat("en-IN", { timeZone: policy.quietHours.timezone });
  } catch {
    problems.push("quiet hours timezone is not a valid IANA zone");
  }
  return problems.length === 0 ? { ok: true } : { ok: false, problems };
}

export const WHATSAPP_SEND_POLICY_MAX_RULES = 8;

export interface WhatsappSendPolicyView {
  readonly id: string;
  readonly version: number;
  readonly executionEnabled: boolean;
  readonly frequencyRules: readonly WhatsappMarketingFrequencyRule[];
  readonly startLocal: string;
  readonly endLocal: string;
  readonly timezone: string;
  readonly effectiveFrom: string;
}

export type WhatsappSendPolicyRead =
  | { readonly kind: "configured"; readonly policy: WhatsappSendPolicyView }
  | { readonly kind: "not_configured" }
  | { readonly kind: "unreadable" };

function int(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isInteger(n) ? n : null;
}

export function parseWhatsappSendPolicyPayload(payload: unknown): WhatsappSendPolicyRead {
  if (payload === null || payload === undefined) return { kind: "not_configured" };
  if (typeof payload !== "object" || Array.isArray(payload)) return { kind: "unreadable" };
  const p = payload as Record<string, unknown>;
  const version = int(p.version);
  const quiet = p.quiet_hours as Record<string, unknown> | null;
  if (
    typeof p.id !== "string" ||
    version === null ||
    typeof p.execution_enabled !== "boolean" ||
    !Array.isArray(p.frequency_rules) ||
    !quiet ||
    typeof quiet !== "object" ||
    typeof quiet.startLocal !== "string" ||
    typeof quiet.endLocal !== "string" ||
    typeof p.timezone !== "string" ||
    typeof p.effective_from !== "string"
  ) {
    return { kind: "unreadable" };
  }
  const frequencyRules: WhatsappMarketingFrequencyRule[] = [];
  for (const rule of p.frequency_rules) {
    if (!rule || typeof rule !== "object") return { kind: "unreadable" };
    const windowHours = int((rule as Record<string, unknown>).windowHours);
    const maxMessages = int((rule as Record<string, unknown>).maxMessages);
    if (windowHours === null || maxMessages === null) return { kind: "unreadable" };
    frequencyRules.push({ windowHours, maxMessages });
  }
  return {
    kind: "configured",
    policy: {
      id: p.id,
      version,
      executionEnabled: p.execution_enabled,
      frequencyRules,
      startLocal: quiet.startLocal,
      endLocal: quiet.endLocal,
      timezone: p.timezone,
      effectiveFrom: p.effective_from,
    },
  };
}

export interface WhatsappSendPolicyFormInput {
  readonly windowHours: readonly string[];
  readonly maxMessages: readonly string[];
  readonly startLocal: string;
  readonly endLocal: string;
  readonly timezone: string;
  readonly executionEnabled: boolean;
  readonly confirmExecution: boolean;
}

export interface WhatsappSendPolicySubmission {
  readonly frequencyRules: Json;
  readonly quietHours: Json;
  readonly timezone: string;
  readonly executionEnabled: boolean;
}

function wholeNumber(raw: string): number {
  const trimmed = raw.trim();
  return /^\d{1,6}$/.test(trimmed) ? Number(trimmed) : Number.NaN;
}

export function buildWhatsappSendPolicySubmission(
  input: WhatsappSendPolicyFormInput
):
  | { readonly ok: true; readonly submission: WhatsappSendPolicySubmission }
  | { readonly ok: false; readonly field: string; readonly message: string } {
  const rules: WhatsappMarketingFrequencyRule[] = [];
  const rows = Math.max(input.windowHours.length, input.maxMessages.length);
  for (let index = 0; index < rows; index += 1) {
    const windowRaw = input.windowHours[index] ?? "";
    const maxRaw = input.maxMessages[index] ?? "";
    if (windowRaw.trim() === "" && maxRaw.trim() === "") continue;
    rules.push({ windowHours: wholeNumber(windowRaw), maxMessages: wholeNumber(maxRaw) });
  }
  if (rules.length === 0) return { ok: false, field: "frequency", message: "Add at least one frequency rule." };
  if (rules.length > WHATSAPP_SEND_POLICY_MAX_RULES) {
    return { ok: false, field: "frequency", message: `At most ${WHATSAPP_SEND_POLICY_MAX_RULES} frequency rules.` };
  }
  const timezone = input.timezone.trim() || WHATSAPP_MARKETING_DEFAULT_TIMEZONE;
  if (timezone.length > 80) return { ok: false, field: "timezone", message: "Timezone is not valid." };
  const quietHours = { timezone, startLocal: input.startLocal.trim(), endLocal: input.endLocal.trim() };
  const validation = validateWhatsappSendPolicyValues({ frequencyRules: rules, quietHours });
  if (!validation.ok) {
    const problem = validation.problems[0] ?? "policy is not valid";
    const field = problem.startsWith("frequency") || problem.startsWith("at least") ? "frequency" : problem.includes("timezone") ? "timezone" : "quietHours";
    return { ok: false, field, message: problem.charAt(0).toUpperCase() + problem.slice(1) + "." };
  }
  if (input.executionEnabled && !input.confirmExecution) {
    return {
      ok: false,
      field: "confirmExecution",
      message: "Confirm that campaign execution may start before turning the gate on.",
    };
  }
  return {
    ok: true,
    submission: {
      frequencyRules: rules.map((rule) => ({ windowHours: rule.windowHours, maxMessages: rule.maxMessages })),
      quietHours,
      timezone,
      executionEnabled: input.executionEnabled,
    },
  };
}

export function describeWhatsappFrequencyRule(rule: WhatsappMarketingFrequencyRule): string {
  const window =
    rule.windowHours % 24 === 0
      ? `${rule.windowHours / 24} day${rule.windowHours === 24 ? "" : "s"}`
      : `${rule.windowHours} hour${rule.windowHours === 1 ? "" : "s"}`;
  return `At most ${rule.maxMessages} marketing message${rule.maxMessages === 1 ? "" : "s"} per contact in ${window}`;
}
