import Link from "next/link";
import { Reveal } from "@/features/public-site/motion/Reveal";
import {
  DISCOVERY_WHY_EYEBROW,
  DISCOVERY_WHY_HEADLINE,
  DISCOVERY_WHY_POINTS,
} from "./discovery-copy";

/**
 * The interiors case, in four points — an editorial 2×2, not a card wall.
 *
 * WHAT THIS SECTION IS FOR NOW
 *
 * It sits directly under the gateway hero and answers one question: if I pick
 * the interiors path, why this company? Four points, and deliberately not the
 * whole of `/interiors` — manufacturing, the design library, the process and
 * the quality story are all better answers to questions asked after that choice
 * is made, and they live on the page where it is made.
 *
 * The points are `<article>`s separated by hairlines rather than boxed cards:
 * four equal boxes read as a feature list, and a feature list is what every
 * contractor site already has. The number is the only ornament, and it sits in
 * the margin so the eye lands on the claim rather than the decoration.
 *
 * The brand-level "why interiors and furniture share a name" argument is a
 * different section — `DiscoveryAbout`, further down, which owns `#about`.
 */
export function DiscoveryWhy() {
  return (
    <section
      className="od-disc-band od-disc-band--surface od-disc-why"
      data-od-disc-section="interior-usps"
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

        {/*
          One action, into the vertical this section just argued for. The
          consultation CTA is deliberately not repeated here — the page has one
          closing band for that, and a second invitation this early competes
          with it rather than adding to it.
        */}
        <Reveal className="od-disc-why__cta">
          <Link href="/interiors" className="od-disc-btn od-disc-btn--ghost">
            Explore Interiors
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
