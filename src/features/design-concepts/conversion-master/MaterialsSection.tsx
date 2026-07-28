import Image from "next/image";
import {
  ARTWORK_PROVENANCE_NOTE,
  CM_SECTION_IDS,
  MATERIAL_PRIMARY,
  MATERIAL_STORY_SECTION_COPY,
  MATERIAL_SUPPORTING,
} from "./content";
import { Reveal } from "../shared/Reveal";

export function MaterialsSection() {
  return (
    <section
      id={CM_SECTION_IDS.materials}
      className="cm-section cm-materials"
      aria-labelledby="cm-materials-title"
    >
      <div className="dc-container">
        <Reveal className="cm-section__head">
          <p className="dc-eyebrow">{MATERIAL_STORY_SECTION_COPY.overline}</p>
          <h2 id="cm-materials-title" className="cm-h2">
            {MATERIAL_STORY_SECTION_COPY.heading}
          </h2>
          <p className="dc-lede">{MATERIAL_STORY_SECTION_COPY.introduction}</p>
        </Reveal>

        <div className="cm-materials__layout">
          <Reveal className="cm-materials__primary">
            <div className="cm-materials__media cm-materials__media--lg">
              <Image
                src={MATERIAL_PRIMARY.asset.path}
                alt={MATERIAL_PRIMARY.asset.alt}
                width={MATERIAL_PRIMARY.asset.width}
                height={MATERIAL_PRIMARY.asset.height}
                loading="lazy"
                sizes="(max-width: 1023px) 100vw, 62vw"
                style={{ objectPosition: MATERIAL_PRIMARY.asset.focalPoint }}
              />
            </div>
            <div className="cm-materials__caption">
              <span className="dc-ordinal">{MATERIAL_PRIMARY.ordinal}</span>
              <h3 className="cm-h3">{MATERIAL_PRIMARY.theme}</h3>
              <p className="dc-body">{MATERIAL_PRIMARY.caption}</p>
            </div>
          </Reveal>

          <ul className="cm-materials__support">
            {MATERIAL_SUPPORTING.map((item, index) => (
              <Reveal as="li" key={item.id} order={index} className="cm-materials__item">
                <div className="cm-materials__media">
                  <Image
                    src={item.asset.path}
                    alt={item.asset.alt}
                    width={item.asset.width}
                    height={item.asset.height}
                    loading="lazy"
                    sizes="(max-width: 1023px) 100vw, 30vw"
                    style={{ objectPosition: item.asset.focalPoint }}
                  />
                </div>
                <div className="cm-materials__caption">
                  <span className="dc-ordinal">{item.ordinal}</span>
                  <h3 className="cm-h3">{item.theme}</h3>
                  <p className="dc-body">{item.caption}</p>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>

        <p className="dc-provenance">{ARTWORK_PROVENANCE_NOTE}</p>
      </div>
    </section>
  );
}
