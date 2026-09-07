"use client";

import Link from "next/link";
import { getPublicWhatsAppHref, PUBLIC_WHATSAPP } from "@/features/public-site/chrome/public-contact";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";
import { Reveal } from "@/features/public-site/motion/Reveal";
import {
  DISCOVERY_FINAL_CTA_HEADLINE,
  DISCOVERY_FINAL_CTA_LEDE,
} from "./discovery-copy";

/**
 * The closing decision point, immediately before the footer.
 *
 * The WhatsApp button follows the same rule as the sticky dock: rendered only
 * when `getPublicWhatsAppHref()` returns a URL, because a dead WhatsApp button
 * on a conversion surface is worse than none. With the number unconfigured the
 * section shows one clear primary action, which is what a closing CTA wants
 * anyway.
 */
export function DiscoveryFinalCta() {
  const whatsappHref = getPublicWhatsAppHref();

  return (
    <section
      className="od-disc-band od-disc-final"
      data-od-disc-section="final-cta"
      aria-labelledby="od-disc-final-title"
    >
      <div className="od-disc-shell od-disc-final__shell">
        <Reveal>
          <h2 id="od-disc-final-title" className="od-disc-display od-disc-final__title">
            {DISCOVERY_FINAL_CTA_HEADLINE}
          </h2>
          <p className="od-disc-lede od-disc-final__lede">{DISCOVERY_FINAL_CTA_LEDE}</p>
          <div className="od-disc-final__actions">
            <Link
              href={PUBLIC_CONSULTATION.href}
              className="od-disc-btn od-disc-btn--primary"
              data-conversion-action="consultation-final"
            >
              {PUBLIC_CONSULTATION.label}
            </Link>
            {whatsappHref ? (
              <a
                href={whatsappHref}
                className="od-disc-btn od-disc-btn--ghost"
                data-conversion-action="whatsapp-final"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={PUBLIC_WHATSAPP.ariaLabel}
              >
                WhatsApp Us
              </a>
            ) : null}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
