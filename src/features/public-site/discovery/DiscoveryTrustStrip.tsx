import { DISCOVERY_TRUST_STRIP_ITEMS } from "./discovery-copy";
import { DiscoveryProjectsCounter } from "./DiscoveryProjectsCounter";

/**
 * The band immediately below the image-only hero.
 *
 * With the hero carrying no copy, this is the first thing a visitor reads, so
 * it leads with the one figure the owner attested to and then states how the
 * work is actually done. The marquee keeps the locality/service ticker it
 * always had; the counter sits outside it, static, because a number that
 * scrolls past is a number nobody reads.
 */
export function DiscoveryTrustStrip() {
  const items = [...DISCOVERY_TRUST_STRIP_ITEMS, ...DISCOVERY_TRUST_STRIP_ITEMS];

  return (
    <section
      className="od-disc-trust-strip"
      data-od-disc-section="trust"
      aria-label="ONEDECORE trust highlights"
    >
      <DiscoveryProjectsCounter />
      <div className="od-disc-trust-strip__track" data-od-trust-marquee="">
        {items.map((item, index) => (
          <span key={`${item.id}-${index}`} className="od-disc-trust-strip__item">
            {item.label}
          </span>
        ))}
      </div>
    </section>
  );
}
