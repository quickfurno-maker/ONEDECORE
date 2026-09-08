import Image from "next/image";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { DiscoveryConsultCta } from "./DiscoveryConsultCta";
import { getDiscoveryAsset } from "./discovery-assets";
import {
  DISCOVERY_LIBRARY_CATEGORIES,
  DISCOVERY_LIBRARY_EYEBROW,
  DISCOVERY_LIBRARY_HEADLINE,
  DISCOVERY_LIBRARY_LEDE,
} from "./discovery-copy";

/**
 * The design library rail.
 *
 * A CSS scroll-snap row, not a JavaScript carousel. Native scrolling already
 * gives momentum, keyboard access, screen-reader semantics and a scrollbar for
 * free; a bespoke carousel would reimplement all four worse and ship a
 * dependency to do it. The next card is deliberately part-visible on mobile —
 * that overhang is what tells a thumb there is more to the right, and it does
 * the job an arrow button would do without occupying the screen.
 *
 * ALT TEXT AND HONESTY
 *
 * Cards whose photograph genuinely depicts the category use the asset's own
 * alt text. The two that do not — Bedrooms and TV Units carry material studies,
 * because the library holds no bedroom or media-wall photograph — mark the
 * image decorative and let the visible title do the describing. A material
 * close-up is never captioned as a room.
 */
export function DiscoveryDesignLibrary() {
  return (
    <section
      className="od-disc-band od-disc-band--neutral od-disc-library"
      data-od-disc-section="design-library"
      aria-labelledby="od-disc-library-title"
    >
      <div className="od-disc-shell">
        <Reveal as="header" className="od-disc-band__head">
          <p className="od-disc-kicker">{DISCOVERY_LIBRARY_EYEBROW}</p>
          <h2 id="od-disc-library-title" className="od-disc-display">
            {DISCOVERY_LIBRARY_HEADLINE.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </h2>
          <p className="od-disc-lede">{DISCOVERY_LIBRARY_LEDE}</p>
        </Reveal>
      </div>

      <ul
        className="od-disc-library__rail"
        data-od-library-rail=""
        aria-label="Design categories"
      >
        {DISCOVERY_LIBRARY_CATEGORIES.map((category) => {
          const asset = getDiscoveryAsset(category.assetKey);
          return (
            <li key={category.id} className="od-disc-library__item">
              {/*
                These cards used to be links to a homepage anchor with a
                `?service=` query. They open the one lead form now, with the
                same service already answered — the destination the query was
                standing in for.
              */}
              <DiscoveryConsultCta
                className="od-disc-library__card"
                service={category.service}
                conversionAction={`design-library-${category.id}`}
                ariaLabel={`Plan ${category.title} — free design consultation`}
              >
                <span className="od-disc-library__media">
                  <Image
                    src={asset.path}
                    alt={category.depictsRoom ? asset.alt : ""}
                    fill
                    sizes="(max-width: 768px) 74vw, 30vw"
                    style={{ objectPosition: asset.focalPoint }}
                    loading="lazy"
                  />
                </span>
                <span className="od-disc-library__title">{category.title}</span>
              </DiscoveryConsultCta>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
