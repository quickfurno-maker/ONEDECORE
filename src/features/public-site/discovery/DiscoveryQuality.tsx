import { Reveal } from "@/features/public-site/motion/Reveal";
import {
  DISCOVERY_QUALITY_EYEBROW,
  DISCOVERY_QUALITY_HEADLINE,
  DISCOVERY_QUALITY_LEDE,
  DISCOVERY_QUALITY_PRINCIPLES,
} from "./discovery-copy";

/**
 * Quality — trust built from process, not credentials.
 *
 * There is no rating, award, certificate, testimonial or warranty period on
 * this section, because none of those is evidenced in the claim register. What
 * is left is a description of how the work is actually done, which is the only
 * honest way to answer "why should I trust you with my home?" while the
 * evidence is still pending.
 */
export function DiscoveryQuality() {
  return (
    <section
      className="od-disc-band od-disc-band--neutral od-disc-quality"
      data-od-disc-section="quality"
      aria-labelledby="od-disc-quality-title"
    >
      <div className="od-disc-shell od-disc-quality__shell">
        <Reveal as="header" className="od-disc-band__head od-disc-quality__head">
          <p className="od-disc-kicker">{DISCOVERY_QUALITY_EYEBROW}</p>
          <h2 id="od-disc-quality-title" className="od-disc-display">
            {DISCOVERY_QUALITY_HEADLINE.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p className="od-disc-lede">{DISCOVERY_QUALITY_LEDE}</p>
        </Reveal>

        <ul className="od-disc-quality__list">
          {DISCOVERY_QUALITY_PRINCIPLES.map((principle, index) => (
            <Reveal
              key={principle.id}
              order={index}
              as="li"
              className="od-disc-quality__item"
            >
              <h3>{principle.title}</h3>
              <p>{principle.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
