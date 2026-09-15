/**
 * WM-3 — the Contacts workspace read model and its presentation.
 *
 * CONSENT IS NOT INFERRED HERE.
 *
 * `marketing_consent` is the latest `public.consent_events.event_type` for
 * purpose MARKETING, computed in SQL. It is shown verbatim. WHATSAPP_SERVICE
 * (or any service-communication consent) is never read by this workspace, so
 * it cannot be mistaken for marketing permission on screen, and nothing here
 * can record a MARKETING grant: the only consent write is a withdrawal.
 *
 * Preference categories narrow a granted MARKETING consent; they never widen
 * a missing one. A category shown as "allowed" means only "not opted out".
 */

/*
 * The channel core does not import the marketing control-plane module (WM-0
 * boundary), so the category allowlist is restated here. The WM-3 suite
 * asserts it equals both the WM-0 contract and the migration's check
 * constraint, so it cannot drift silently.
 */
export const WHATSAPP_MARKETING_PREFERENCE_CATEGORIES = [
  "design_inspiration",
  "offers",
  "project_updates",
  "referral",
  "educational_content",
] as const;

export type WhatsappMarketingPreferenceCategory = (typeof WHATSAPP_MARKETING_PREFERENCE_CATEGORIES)[number];

export function isWhatsappMarketingPreferenceCategory(value: string): value is WhatsappMarketingPreferenceCategory {
  return (WHATSAPP_MARKETING_PREFERENCE_CATEGORIES as readonly string[]).includes(value);
}

export const WHATSAPP_CONTACTS_PAGE_SIZE = 25;
export const WHATSAPP_CONTACTS_SEARCH_MAX_LENGTH = 64;
const MAX_PAGE = 10_000;

export interface WhatsappContactsQuery {
  readonly q: string | null;
  readonly page: number;
  readonly pageSize: number;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function parseWhatsappContactsQuery(
  params: Readonly<Record<string, string | string[] | undefined>>
): WhatsappContactsQuery {
  const rawQ = (first(params.q) ?? "").replace(/\s+/g, " ").trim().slice(0, WHATSAPP_CONTACTS_SEARCH_MAX_LENGTH);
  const rawPage = Number.parseInt(first(params.page) ?? "1", 10);
  const page = Number.isInteger(rawPage) && rawPage >= 1 ? Math.min(rawPage, MAX_PAGE) : 1;
  return { q: rawQ.length > 0 ? rawQ : null, page, pageSize: WHATSAPP_CONTACTS_PAGE_SIZE };
}

export function buildWhatsappContactsHref(basePath: string, query: WhatsappContactsQuery, page = query.page): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

export type WhatsappMarketingConsentState = "granted" | "withdrawn" | "none" | "unknown";

export interface WhatsappContactRow {
  readonly contactId: string;
  readonly displayName: string;
  readonly contactStatus: string;
  readonly whatsappE164: string | null;
  readonly whatsappChannelStatus: string | null;
  readonly marketingConsent: WhatsappMarketingConsentState;
  readonly rawMarketingConsent: string | null;
  readonly leadId: string | null;
  readonly leadStage: string | null;
  readonly locality: string | null;
}

export interface WhatsappContactsPage {
  readonly totalCount: number;
  readonly items: readonly WhatsappContactRow[];
}

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

export function toWhatsappMarketingConsentState(raw: unknown): WhatsappMarketingConsentState {
  if (raw === null || raw === undefined) return "none";
  if (raw === "granted") return "granted";
  if (raw === "withdrawn") return "withdrawn";
  return "unknown";
}

/** Parses `list_whatsapp_contacts`. A malformed row is dropped, never guessed. */
export function parseWhatsappContactsPayload(payload: unknown): WhatsappContactsPage {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { totalCount: 0, items: [] };
  }
  const record = payload as Record<string, unknown>;
  const total = Number(record.total_count);
  const rawItems = Array.isArray(record.items) ? record.items : [];
  const items: WhatsappContactRow[] = [];
  for (const raw of rawItems) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const contactId = str(row.contact_id);
    if (!contactId) continue;
    items.push({
      contactId,
      displayName: str(row.display_name) ?? "Unnamed contact",
      contactStatus: str(row.contact_status) ?? "unknown",
      whatsappE164: str(row.whatsapp_e164),
      whatsappChannelStatus: str(row.whatsapp_channel_status),
      marketingConsent: toWhatsappMarketingConsentState(row.marketing_consent),
      rawMarketingConsent: str(row.marketing_consent),
      leadId: str(row.lead_id),
      leadStage: str(row.lead_stage),
      locality: str(row.locality),
    });
  }
  return { totalCount: Number.isFinite(total) && total >= 0 ? Math.trunc(total) : items.length, items };
}

export type Tone = "positive" | "warning" | "negative" | undefined;

export function presentWhatsappMarketingConsent(state: WhatsappMarketingConsentState): {
  readonly label: string;
  readonly tone: Tone;
} {
  switch (state) {
    case "granted":
      return { label: "Marketing opted in", tone: "positive" };
    case "withdrawn":
      return { label: "Marketing opted out", tone: "negative" };
    case "none":
      return { label: "No marketing consent", tone: "warning" };
    default:
      return { label: "Unrecognised consent", tone: "warning" };
  }
}

export function presentWhatsappContactStatus(status: string): { readonly label: string; readonly tone: Tone } {
  if (status === "active") return { label: "Active", tone: "positive" };
  if (status === "do_not_contact") return { label: "Do not contact", tone: "negative" };
  return { label: status.replace(/_/g, " "), tone: "warning" };
}

export function presentWhatsappChannel(e164: string | null, status: string | null): {
  readonly label: string;
  readonly tone: Tone;
} {
  if (!e164) return { label: "No WhatsApp number", tone: "warning" };
  if (status === "active") return { label: "Active", tone: "positive" };
  return { label: (status ?? "unknown").replace(/_/g, " "), tone: "warning" };
}

export const WHATSAPP_MARKETING_PREFERENCE_LABELS: Readonly<Record<WhatsappMarketingPreferenceCategory, string>> = {
  design_inspiration: "Design inspiration",
  offers: "Offers",
  project_updates: "Project updates",
  referral: "Referral",
  educational_content: "Educational content",
};

export interface WhatsappPreferenceEventRow {
  readonly contact_id: string;
  readonly category: string;
  readonly event_type: string;
  readonly occurred_at: string;
  readonly id: string;
}

export type WhatsappContactPreferenceState = Readonly<Record<WhatsappMarketingPreferenceCategory, "allowed" | "opted_out">>;

/**
 * Latest event per (contact, category), matching
 * `private.whatsapp_preference_opted_out`: ordered by occurred_at desc, id
 * desc, and no event means not opted out.
 */
export function deriveWhatsappContactPreferenceStates(
  events: readonly WhatsappPreferenceEventRow[]
): ReadonlyMap<string, WhatsappContactPreferenceState> {
  const sorted = [...events].sort((a, b) => {
    const byTime = Date.parse(b.occurred_at) - Date.parse(a.occurred_at);
    if (byTime !== 0) return byTime;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  const seen = new Set<string>();
  const out = new Map<string, Record<WhatsappMarketingPreferenceCategory, "allowed" | "opted_out">>();
  for (const event of sorted) {
    if (!(WHATSAPP_MARKETING_PREFERENCE_CATEGORIES as readonly string[]).includes(event.category)) continue;
    const key = `${event.contact_id}:${event.category}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const state = out.get(event.contact_id) ?? defaultPreferenceState();
    state[event.category as WhatsappMarketingPreferenceCategory] = event.event_type === "opted_out" ? "opted_out" : "allowed";
    out.set(event.contact_id, state);
  }
  return out;
}

function defaultPreferenceState(): Record<WhatsappMarketingPreferenceCategory, "allowed" | "opted_out"> {
  return Object.fromEntries(WHATSAPP_MARKETING_PREFERENCE_CATEGORIES.map((c) => [c, "allowed"])) as Record<
    WhatsappMarketingPreferenceCategory,
    "allowed" | "opted_out"
  >;
}

export function preferenceStateFor(
  states: ReadonlyMap<string, WhatsappContactPreferenceState>,
  contactId: string
): WhatsappContactPreferenceState {
  return states.get(contactId) ?? defaultPreferenceState();
}

export function optedOutCategories(state: WhatsappContactPreferenceState): readonly WhatsappMarketingPreferenceCategory[] {
  return WHATSAPP_MARKETING_PREFERENCE_CATEGORIES.filter((category) => state[category] === "opted_out");
}

/** Sources recorded on staff-written compliance events. Bounded, never free text. */
export const WHATSAPP_OPT_OUT_SOURCES = {
  contacts: "staff_contacts_workspace",
  inbox: "staff_inbox_conversation",
} as const;

export const WHATSAPP_PREFERENCE_SOURCE = "staff_contacts_workspace" as const;
