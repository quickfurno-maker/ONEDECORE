/**
 * Public contact channels for the marketing site.
 * WhatsApp href is null until an approved business number is configured — do not invent one.
 */
export const PUBLIC_WHATSAPP_HREF: string | null = null;

export const PUBLIC_WHATSAPP = {
  label: "WhatsApp",
  ariaLabel: "Chat with ONEDECORE on WhatsApp (opens in a new tab)",
  prefilledMessage: "Hi ONEDECORE, I'd like to discuss my home interiors.",
} as const;

/** Returns an approved wa.me URL or null when no public WhatsApp target is configured. */
export function getPublicWhatsAppHref(): string | null {
  return PUBLIC_WHATSAPP_HREF;
}
