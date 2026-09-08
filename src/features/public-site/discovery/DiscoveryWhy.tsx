import { Reveal } from "@/features/public-site/motion/Reveal";
import {
  DISCOVERY_WHY_EYEBROW,
  DISCOVERY_WHY_HEADLINE,
  DISCOVERY_WHY_POINTS,
} from "./discovery-copy";

/**
 * Why ONEDECORE — an editorial 2×2, not a card wall.
 *
 * The four points are `<article>`s separated by hairlines rather than boxed
 * cards: four equal boxes read as a feature list, and a feature list is what
 * every contractor site already has. The number is the only ornament, and it
 * sits in the margin so the eye lands on the claim rather than the decoration.
 */
export function DiscoveryWhy() {
  return (
    <section
      className="od-disc-band od-disc-band--ivory od-disc-why"
      data-od-disc-section="why"
      aria-labelledby="od-disc-why-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head od-disc-why__head">
          <p className="od-disc-kicker">{DISCOVERY_WHY_EYEBROW}</p>
          <h2 id="od-disc-why-title" className="od-disc-display">
            {DISCOVERY_WHY_HEADLINE.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
        </Reveal>

        <div className="od-disc-why__grid">
          {DISCOVERY_WHY_POINTS.map((point, index) => (
            <Reveal
              key={point.id}
              order={index}
              as="article"
              className="od-disc-why__item"
            >
              <span className="od-disc-why__num" aria-hidden="true">
                {point.number}
              </span>
              <h3>{point.title}</h3>
              <p>{point.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
