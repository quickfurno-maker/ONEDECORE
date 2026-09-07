import { Reveal } from "@/features/public-site/motion/Reveal";
import {
  DISCOVERY_AREAS_EYEBROW,
  DISCOVERY_AREAS_HEADLINE,
  DISCOVERY_AREAS_SERVED,
} from "./discovery-copy";

/**
 * The Pune neighbourhoods, as two slow marquees.
 *
 * WHY IT IS STILL A SCROLLABLE LIST UNDERNEATH
 *
 * The drift is decoration. The row is a real horizontally scrollable element
 * with all twenty chips in the document, so a keyboard user can tab through
 * them, a screen reader reads a plain list, and a thumb can drag it. Motion
 * carries no information here — every area is legible whether or not it moves.
 *
 * HOW THE LOOP WORKS
 *
 * Each row renders its chips TWICE and translates by exactly -50%, so the
 * second copy lands where the first began and the seam is invisible. The
 * duplicate set is `aria-hidden`, otherwise every area would be announced
 * twice. The two rows travel in opposite directions, which reads as texture
 * rather than as a single band sliding past.
 *
 * Hover and focus pause it — a name a visitor is trying to read should stop
 * moving — and `prefers-reduced-motion` stops it entirely.
 */
function AreaRow({
  areas,
  reverse,
}: {
  readonly areas: readonly string[];
  readonly reverse?: boolean;
}) {
  return (
    <div className="od-disc-areas__row" data-reverse={reverse ? "" : undefined}>
      <ul className="od-disc-areas__track">
        {areas.map((area) => (
          <li key={area} className="od-disc-areas__chip">
            {area}
          </li>
        ))}
      </ul>
      <ul className="od-disc-areas__track" aria-hidden="true">
        {areas.map((area) => (
          <li key={`${area}-echo`} className="od-disc-areas__chip">
            {area}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function DiscoveryAreasServed() {
  const half = Math.ceil(DISCOVERY_AREAS_SERVED.length / 2);
  const top = DISCOVERY_AREAS_SERVED.slice(0, half);
  const bottom = DISCOVERY_AREAS_SERVED.slice(half);

  return (
    <section
      className="od-disc-areas"
      data-od-disc-section="areas"
      aria-labelledby="od-disc-areas-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head od-disc-areas__head">
          <p className="od-disc-kicker">{DISCOVERY_AREAS_EYEBROW}</p>
          <h2 id="od-disc-areas-title" className="od-disc-display">
            <span>{DISCOVERY_AREAS_HEADLINE}</span>
          </h2>
        </Reveal>
      </div>

      <div className="od-disc-areas__rails" data-od-areas-rail="">
        <AreaRow areas={top} />
        <AreaRow areas={bottom} reverse />
      </div>
    </section>
  );
}
