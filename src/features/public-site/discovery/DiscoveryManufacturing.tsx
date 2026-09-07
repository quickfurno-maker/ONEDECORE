import Image from "next/image";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { getDiscoveryAsset } from "./discovery-assets";
import {
  DISCOVERY_MANUFACTURING_EYEBROW,
  DISCOVERY_MANUFACTURING_HEADLINE,
  DISCOVERY_MANUFACTURING_LEDE,
  DISCOVERY_MANUFACTURING_POINTS,
} from "./discovery-copy";

/**
 * The manufacturing advantage — one large image beside editorial copy.
 *
 * THE IMAGE IS A MATERIAL STUDY, NOT A FACTORY PHOTOGRAPH
 *
 * There is no photograph of the ONEDECORE production floor in the asset
 * library. A stock factory interior captioned under "Manufactured by us" would
 * assert a place that has not been photographed, so this uses the mitred-oak
 * joinery detail — real ONEDECORE material photography that shows the finish
 * the section is actually talking about. When a real factory photograph exists,
 * it belongs here and nowhere else changes.
 */
export function DiscoveryManufacturing() {
  const asset = getDiscoveryAsset("oakJoinery");

  return (
    <section
      className="od-disc-band od-disc-band--deep od-disc-mfg"
      data-od-disc-section="manufacturing"
      aria-labelledby="od-disc-mfg-title"
    >
      <div className="od-disc-shell od-disc-mfg__shell">
        <Reveal className="od-disc-mfg__media">
          <Image
            src={asset.path}
            alt={asset.alt}
            width={asset.width}
            height={asset.height}
            sizes="(max-width: 900px) 92vw, 46vw"
            style={{ objectPosition: asset.focalPoint }}
            loading="lazy"
          />
        </Reveal>

        <div className="od-disc-mfg__body">
          <Reveal as="header" className="od-disc-band__head">
            <p className="od-disc-kicker">{DISCOVERY_MANUFACTURING_EYEBROW}</p>
            <h2 id="od-disc-mfg-title" className="od-disc-display">
              {DISCOVERY_MANUFACTURING_HEADLINE.map((line) => (
                <span key={line}>{line}</span>
              ))}
            </h2>
            <p className="od-disc-lede">{DISCOVERY_MANUFACTURING_LEDE}</p>
          </Reveal>

          <ul className="od-disc-mfg__points">
            {DISCOVERY_MANUFACTURING_POINTS.map((point, index) => (
              <Reveal
                key={point.id}
                order={index}
                as="li"
                className="od-disc-mfg__point"
              >
                <span className="od-disc-mfg__num" aria-hidden="true">
                  {point.number}
                </span>
                <div>
                  <h3>{point.title}</h3>
                  <p>{point.body}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
