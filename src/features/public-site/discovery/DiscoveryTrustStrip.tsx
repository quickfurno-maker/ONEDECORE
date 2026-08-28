import { DISCOVERY_TRUST_STRIP_ITEMS } from "./discovery-copy";

export function DiscoveryTrustStrip() {
  const items = [...DISCOVERY_TRUST_STRIP_ITEMS, ...DISCOVERY_TRUST_STRIP_ITEMS];

  return (
    <section
      className="od-disc-trust-strip"
      data-od-disc-section="trust"
      aria-label="ONEDECORE trust highlights"
    >
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
