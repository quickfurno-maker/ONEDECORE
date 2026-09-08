import Link from "next/link";
import { PUBLIC_CONSULTATION } from "@/features/public-site/chrome/public-nav";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { DiscoveryConsultCta } from "./DiscoveryConsultCta";
import {
  DISCOVERY_FINAL_CTA_EYEBROW,
  DISCOVERY_FINAL_CTA_HEADLINE,
  DISCOVERY_FINAL_CTA_LEDE,
  DISCOVERY_FINAL_CTA_PROOF,
} from "./discovery-copy";

/**
 * The closing panel.
 *
 * It was a centred headline floating in a section-height of empty space, which
 * read as the page trailing off rather than closing. It is a PANEL now: a
 * bordered block with its own edges, so the content has something to sit
 * against and the spacing is the panel's padding rather than the band's.
 *
 * The two actions are the two things a visitor can still want at this point —
 * talk to someone, or look at more work. WhatsApp is deliberately not a third:
 * it is already floating on the right, and offering it twice within a thumb's
 * reach of itself is noise.
 */
export function DiscoveryFinalCta() {
  return (
    <section
      className="od-disc-band od-disc-final"
      data-od-disc-section="final-cta"
      aria-labelledby="od-disc-final-title"
    >
      <div className="od-disc-shell">
        <Reveal className="od-disc-final__panel">
          <p className="od-disc-kicker">{DISCOVERY_FINAL_CTA_EYEBROW}</p>
          <h2 id="od-disc-final-title" className="od-disc-display od-disc-final__title">
            <span>{DISCOVERY_FINAL_CTA_HEADLINE}</span>
          </h2>
          <p className="od-disc-lede od-disc-final__lede">{DISCOVERY_FINAL_CTA_LEDE}</p>

          <div className="od-disc-final__actions">
            <DiscoveryConsultCta
              className="od-disc-btn od-disc-btn--primary"
              conversionAction="consultation-final"
            >
              {PUBLIC_CONSULTATION.label}
            </DiscoveryConsultCta>
            <Link
              href="/portfolio"
              className="od-disc-btn od-disc-btn--ghost"
              data-conversion-action="portfolio-final"
            >
              Explore Portfolio
            </Link>
          </div>

          <ul className="od-disc-final__proof">
            {DISCOVERY_FINAL_CTA_PROOF.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}
