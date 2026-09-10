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
 *
 * ACTIVATION IS A BUILD, NOT A RESTART
 *
 * `NEXT_PUBLIC_*` is INLINED AT BUILD TIME by static replacement. Setting the
 * variable on the VPS and restarting the process does nothing: the already-built
 * bundle still carries whatever the value was when it was compiled. Turning the
 * button on takes:
 *
 *   1. set NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164 in the production BUILD
 *      environment (not merely the runtime environment)
 *   2. npm run build
 *   3. systemctl restart pm2-onedecore
 *   4. verify the rendered href:
 *      curl -s https://onedecore.in/ | grep -o 'https://wa.me/[0-9]*'
 *
 * Step 4 is the one that matters. The other three can all appear to succeed
 * while the bundle is unchanged.
 *
 * The same three-step rule governs `NEXT_PUBLIC_ONEDECORE_PHONE_E164`, which
 * publishes the voice line further down this file.
 */

/** The prefilled first message. Service enquiry, never marketing. */
export const PUBLIC_WHATSAPP = {
  label: "WhatsApp",
  ariaLabel: "Chat with ONEDECORE on WhatsApp (opens in a new tab)",
  prefilledMessage: "Hi ONEDECORE, I'd like to discuss my interior requirement.",
} as const;

export const PUBLIC_WHATSAPP_E164_ENV = "NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164";

/**
 * The digits of a valid E.164 number, or `null`.
 *
 * E.164 is `+` then 8–15 digits, first digit non-zero. Consumers want the
 * digits in different shapes — `wa.me` takes them bare, `tel:` wants the `+`
 * back — so the validation happens once, here, and each caller re-assembles
 * what it needs rather than re-deriving the rule.
 */
export function normalizeE164Digits(raw: string | null | undefined): string | null {
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
 * The WhatsApp number's digits, or `null`.
 *
 * Kept as its own exported name because call sites and tests already use it.
 * It is now a thin alias over the shared validator rather than a second copy
 * of the rule.
 */
export function normalizeWhatsAppE164(raw: string | null | undefined): string | null {
  return normalizeE164Digits(raw);
}

/**
 * The approved `wa.me` URL, or `null` when no valid number is configured.
 *
 * Reading `process.env.NEXT_PUBLIC_ONEDECORE_WHATSAPP_E164` as a literal member
 * expression is required, not stylistic: the inlining is a textual substitution,
 * so `process.env[name]` would never be replaced and the button would never
 * appear however the VPS is configured.
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

/* -------------------------------------------------------------------------- */
/* Voice — a separate channel that happens to share a number today             */
/* -------------------------------------------------------------------------- */

/**
 * The call button's copy.
 *
 * "Call Now" rather than the number itself. A rendered number invites someone
 * to read and re-dial it on a second device, and it goes stale in a screenshot;
 * the label states the action and the anchor carries the destination.
 */
export const PUBLIC_PHONE = {
  label: "Call Now",
  ariaLabel: "Call ONEDECORE",
} as const;

export const PUBLIC_PHONE_E164_ENV = "NEXT_PUBLIC_ONEDECORE_PHONE_E164";

/**
 * The `tel:` URL for the published phone line, or `null`.
 *
 * DELIBERATELY NOT DERIVED FROM THE WHATSAPP VARIABLE
 *
 * Both are the same number today. Reading one from the other would encode that
 * coincidence as a rule, and the day the business publishes a landline for
 * calls while keeping a mobile on WhatsApp, the calling CTA would silently
 * dial the wrong line. They are two channels; they get two variables.
 *
 * `tel:` keeps the leading `+` — the international prefix is what lets a phone
 * dial the number from outside India — where `wa.me` wants the bare digits.
 *
 * The member expression on `process.env` is required rather than stylistic:
 * `NEXT_PUBLIC_*` inlining is a textual substitution, so `process.env[name]`
 * would never be replaced and the button would never appear.
 */
export function getPublicPhoneHref(
  configured: string | null | undefined = process.env
    .NEXT_PUBLIC_ONEDECORE_PHONE_E164
): string | null {
  const digits = normalizeE164Digits(configured);
  if (!digits) {
    return null;
  }
  return `tel:+${digits}`;
}

/** True when a valid phone number is configured. */
export function isPublicPhoneConfigured(configured?: string | null): boolean {
  return getPublicPhoneHref(configured) !== null;
}
