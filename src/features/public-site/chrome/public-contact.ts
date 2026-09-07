/**
 * Public contact channels for the marketing site.
 *
 * THE WHATSAPP NUMBER IS CONFIGURATION, NOT CODE
 *
 * It used to be a hard-coded `null` with a comment saying not to invent one.
 * That was the right instinct and the wrong mechanism: turning the button on
 * meant editing and redeploying the application, which is not how a phone
 * number should be published.
 *
 * `NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164` supplies it now, and the value is
 * VALIDATED rather than trusted. Anything that is not a plausible E.164 number
 * yields `null`, and a `null` href means the button is not rendered at all.
 * There is no in-between state where a WhatsApp button exists and does nothing:
 * a dead CTA on a conversion surface is worse than no CTA.
 *
 * Nothing here invents a number. With the variable unset — which is the state
 * today — every consumer sees exactly what it saw before.
 */

/** The prefilled first message. Service enquiry, never marketing. */
export const PUBLIC_WHATSAPP = {
  label: "WhatsApp",
  ariaLabel: "Chat with ONEDECORE on WhatsApp (opens in a new tab)",
  prefilledMessage: "Hi ONEDECORE, I'd like to discuss my home interiors.",
} as const;

export const PUBLIC_WHATSAPP_E164_ENV = "NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164";

/**
 * The digits of a valid E.164 number, or `null`.
 *
 * E.164 is `+` then 8–15 digits, first digit non-zero. `wa.me` wants the digits
 * without the `+`, so the check happens on the configured form and the
 * normalisation happens once, here, rather than at each call site.
 */
export function normalizeWhatsAppE164(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") {
    return null;
  }
  // Tolerate the spacing and dashes a human copying a number will include.
  const trimmed = raw.trim().replace(/[\s()-]/g, "");
  if (!/^\+[1-9]\d{7,14}$/.test(trimmed)) {
    return null;
  }
  return trimmed.slice(1);
}

/**
 * The approved `wa.me` URL, or `null` when no valid number is configured.
 *
 * Reading `process.env` directly is required: `NEXT_PUBLIC_*` values are
 * inlined at build time by static replacement, so an indexed lookup would not
 * be substituted and the button would never appear.
 */
export function getPublicWhatsAppHref(
  configured: string | null | undefined = process.env
    .NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164
): string | null {
  const digits = normalizeWhatsAppE164(configured);
  if (!digits) {
    return null;
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(
    PUBLIC_WHATSAPP.prefilledMessage
  )}`;
}

/** True when a valid number is configured. */
export function isPublicWhatsAppConfigured(
  configured?: string | null
): boolean {
  return getPublicWhatsAppHref(configured) !== null;
}
