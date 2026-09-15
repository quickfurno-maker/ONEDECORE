/**
 * Whole-message marketing opt-out signals on inbound WhatsApp messages.
 *
 * Channel core, so the webhook never imports the marketing control plane; the
 * WM-0 marketing contracts re-export these. Mirrored in SQL by
 * `private.whatsapp_is_inbound_opt_out` and
 * `private.whatsapp_inbound_opt_out_candidate`
 * (20260916100000_whatsapp_control_plane_runtime_hardening.sql), which decides
 * again before any consent evidence is written.
 *
 * A phrase inside a longer message ("I can't stop smiling", "don't remove me")
 * is NOT an opt-out; those are left to a human. Meta's marketing-template
 * opt-out quick reply arrives as a button reply and counts by its label.
 * Recording is restrictive only: nothing here can grant consent.
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

/** Meta's default label on the marketing opt-out quick-reply button. */
export const WHATSAPP_META_MARKETING_OPT_OUT_BUTTON_LABELS = ["stop promotions"] as const;

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
 * at the persistence layer.
 */
export function classifyWhatsappOptOutSignal(text: string | null | undefined): WhatsappOptOutSignal {
  if (typeof text !== "string") return "none";
  if (text.length === 0 || text.length > WHATSAPP_OPT_OUT_MESSAGE_MAX_LENGTH) return "none";
  const normalized = normalizeWhatsappOptOutCandidate(text);
  return (WHATSAPP_OPT_OUT_PHRASES as readonly string[]).includes(normalized) ? "explicit_opt_out" : "none";
}

/** The text an inbound message offers for classification: typed text or a tapped button label. */
export function whatsappInboundOptOutCandidate(message: {
  readonly providerMessageType: string;
  readonly bodyText: string | null;
  readonly content: Readonly<Record<string, unknown>>;
}): { readonly text: string | null; readonly source: "text" | "button" | "none" } {
  if (message.providerMessageType === "text") return { text: message.bodyText, source: "text" };
  if (message.providerMessageType === "button" && typeof message.content.text === "string") {
    return { text: message.content.text, source: "button" };
  }
  const reply = message.content.button_reply;
  if (message.providerMessageType === "interactive" && typeof reply === "object" && reply !== null && typeof (reply as Record<string, unknown>).title === "string") {
    return { text: (reply as Record<string, unknown>).title as string, source: "button" };
  }
  return { text: null, source: "none" };
}

export function classifyWhatsappInboundOptOut(message: {
  readonly providerMessageType: string;
  readonly bodyText: string | null;
  readonly content: Readonly<Record<string, unknown>>;
}): WhatsappOptOutSignal {
  const candidate = whatsappInboundOptOutCandidate(message);
  if (candidate.text === null) return "none";
  if (classifyWhatsappOptOutSignal(candidate.text) === "explicit_opt_out") return "explicit_opt_out";
  if (candidate.source !== "button" || candidate.text.length > WHATSAPP_OPT_OUT_MESSAGE_MAX_LENGTH) return "none";
  return (WHATSAPP_META_MARKETING_OPT_OUT_BUTTON_LABELS as readonly string[]).includes(normalizeWhatsappOptOutCandidate(candidate.text))
    ? "explicit_opt_out"
    : "none";
}
