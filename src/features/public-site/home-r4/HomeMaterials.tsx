import Image from "next/image";
import {
  PM_MATERIALS_COPY,
  PM_MATERIAL_PRIMARY,
  PM_MATERIAL_SUPPORTING,
  PM_SECTION_IDS,
} from "./content";
import { Reveal } from "@/features/public-site/motion/Reveal";

/** Tactile highlight: one dominant detail plus two supporting studies. */
export function HomeMaterials() {
  const primary = PM_MATERIAL_PRIMARY;

  return (
    <section
      id={PM_SECTION_IDS.materials}
      className="pm-section pm-materials"
      aria-labelledby="pm-materials-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_MATERIALS_COPY.eyebrow}</p>
          <h2 id="pm-materials-title" className="pm-h2">
            {PM_MATERIALS_COPY.heading}
          </h2>
          <p className="pm-lede">{PM_MATERIALS_COPY.lede}</p>
        </Reveal>

        <Reveal className="pm-materials__primary" order={1}>
          <figure className="pm-figure pm-figure--mask pm-materials__primaryFigure">
            <Image
              src={primary.asset.path}
              alt={primary.asset.alt}
              width={primary.asset.width}
              height={primary.asset.height}
              loading="lazy"
              sizes="(max-width: 1023px) 100vw, 1200px"
              style={{ objectPosition: primary.asset.focalPoint }}
            />
            <figcaption className="pm-materials__caption">
              <span className="pm-ordinal">{primary.ordinal}</span>
              <span className="pm-materials__theme">{primary.theme}</span>
              <span className="pm-materials__text">{primary.caption}</span>
            </figcaption>
          </figure>
        </Reveal>

        <ul className="pm-materials__grid">
          {PM_MATERIAL_SUPPORTING.map((item, index) => (
            <Reveal as="li" key={item.id} order={index + 2}>
              <figure className="pm-figure pm-figure--mask pm-materials__supportFigure">
                <Image
                  src={item.asset.path}
                  alt={item.asset.alt}
                  width={item.asset.width}
                  height={item.asset.height}
                  loading="lazy"
                  sizes="(max-width: 767px) 100vw, 45vw"
                  style={{ objectPosition: item.asset.focalPoint }}
                />
                <figcaption className="pm-materials__caption">
                  <span className="pm-ordinal">{item.ordinal}</span>
                  <span className="pm-materials__theme">{item.theme}</span>
                  <span className="pm-materials__text">{item.caption}</span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
