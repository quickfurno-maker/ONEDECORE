/**
 * WM-0 (ADR-0034) — marketing preferences, opt-out signals, frequency caps and
 * quiet hours. Migration-independent.
 *
 * MARKETING consent itself stays in append-only `public.consent_events`
 * (purpose_code = 'MARKETING'). Preference categories narrow a granted consent;
 * they never widen a missing one. Service consent (SERVICE_COMMUNICATION,
 * WHATSAPP_SERVICE) never implies MARKETING.
 */

export const WHATSAPP_MARKETING_PREFERENCE_CATEGORIES = [
  "design_inspiration",
  "offers",
  "project_updates",
  "referral",
  "educational_content",
] as const;

export type WhatsappMarketingPreferenceCategory =
  (typeof WHATSAPP_MARKETING_PREFERENCE_CATEGORIES)[number];

export function isWhatsappMarketingPreferenceCategory(
  value: string
): value is WhatsappMarketingPreferenceCategory {
  return (WHATSAPP_MARKETING_PREFERENCE_CATEGORIES as readonly string[]).includes(
    value
  );
}

/**
 * Whole-message opt-out phrases, compared after normalisation. A phrase inside
 * a longer message ("I can't stop smiling", "don't remove me") is NOT an
 * opt-out; those are left to a human. Meta's own marketing-template opt-out
 * button arrives as a button reply and is handled by payload, not by text.
 */
export const WHATSAPP_OPT_OUT_PHRASES = [
  "stop",
  "unsubscribe",
  "remove me",
  "no marketing",
  "stop marketing",
  "opt out",
  "optout",
] as const;

export const WHATSAPP_OPT_OUT_MESSAGE_MAX_LENGTH = 40;

export function normalizeWhatsappOptOutCandidate(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\s ]+/g, " ")
    .trim()
    .replace(/^[\p{P}\p{S}\s]+|[\p{P}\p{S}\s]+$/gu, "")
    .replace(/-/g, " ")
    .replace(/ +/g, " ");
}

export type WhatsappOptOutSignal = "explicit_opt_out" | "none";

/**
 * Deterministic and idempotent: the same text always yields the same answer,
 * and recording a second opt-out for an already opted-out contact is a no-op
 * at the persistence layer (WM-3).
 */
export function classifyWhatsappOptOutSignal(
  text: string | null | undefined
): WhatsappOptOutSignal {
  if (typeof text !== "string") return "none";
  if (text.length === 0 || text.length > WHATSAPP_OPT_OUT_MESSAGE_MAX_LENGTH) {
    return "none";
  }
  const normalized = normalizeWhatsappOptOutCandidate(text);
  return (WHATSAPP_OPT_OUT_PHRASES as readonly string[]).includes(normalized)
    ? "explicit_opt_out"
    : "none";
}

/** Default business timezone for quiet hours when the policy names none. */
export const WHATSAPP_MARKETING_DEFAULT_TIMEZONE = "Asia/Kolkata" as const;

export interface WhatsappMarketingFrequencyRule {
  /** Rolling window length. */
  readonly windowHours: number;
  /** Marketing messages allowed per contact within the window. */
  readonly maxMessages: number;
}

export interface WhatsappMarketingQuietHours {
  readonly timezone: string;
  /** "HH:MM", 24h, local to `timezone`. Start may be after end (overnight). */
  readonly startLocal: string;
  readonly endLocal: string;
}

/**
 * Configured by an authorised admin (WM-3). There are deliberately no default
 * cap numbers or quiet-hour times in code: an unconfigured policy fails closed.
 */
export interface WhatsappMarketingSendPolicy {
  readonly frequencyRules: readonly WhatsappMarketingFrequencyRule[];
  readonly quietHours: WhatsappMarketingQuietHours;
}

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function validateWhatsappMarketingSendPolicy(
  policy: WhatsappMarketingSendPolicy
): { readonly ok: true } | { readonly ok: false; readonly problems: readonly string[] } {
  const problems: string[] = [];
  if (policy.frequencyRules.length === 0) {
    problems.push("at least one frequency rule is required");
  }
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

function localMinutes(instant: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((part) => part.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/** True when `instant` falls inside quiet hours. Start inclusive, end exclusive. */
export function isWithinWhatsappQuietHours(
  instant: Date,
  quietHours: WhatsappMarketingQuietHours
): boolean {
  const now = localMinutes(instant, quietHours.timezone);
  const start = toMinutes(quietHours.startLocal);
  const end = toMinutes(quietHours.endLocal);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/**
 * Rolling-window cap check. `priorSendInstants` are this contact's governed
 * marketing sends (bound messages), across every run and one-to-one marketing
 * template send, never only the current run.
 */
export function isWhatsappFrequencyCapped(
  instant: Date,
  priorSendInstants: readonly Date[],
  rules: readonly WhatsappMarketingFrequencyRule[]
): boolean {
  return rules.some((rule) => {
    const windowStart = instant.getTime() - rule.windowHours * 3_600_000;
    const inWindow = priorSendInstants.filter(
      (sent) => sent.getTime() > windowStart && sent.getTime() <= instant.getTime()
    ).length;
    return inWindow >= rule.maxMessages;
  });
}
