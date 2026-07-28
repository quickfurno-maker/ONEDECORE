import Image from "next/image";
import {
  CM_SECTION_IDS,
  CM_STORY,
  MATERIAL_PRIMARY,
  MATERIAL_SUPPORTING,
  SERVICE_CARDS,
} from "./content";
import { Reveal } from "../shared/Reveal";

export function ProjectStorySection() {
  const kitchen = SERVICE_CARDS.find((s) => s.id === "modular-kitchens")!;
  const wardrobe = SERVICE_CARDS.find((s) => s.id === "custom-wardrobes")!;

  return (
    <section
      id={CM_SECTION_IDS.story}
      className="cm-section cm-story"
      aria-labelledby="cm-story-title"
    >
      <div className="dc-container">
        <Reveal className="cm-section__head">
          <p className="dc-eyebrow">{CM_STORY.overline}</p>
          <h2 id="cm-story-title" className="cm-h2">
            {CM_STORY.heading}
          </h2>
          <p className="dc-lede">{CM_STORY.body}</p>
        </Reveal>

        <div className="cm-story__grid">
          <Reveal as="figure" className="cm-story__figure cm-story__figure--primary">
            <Image
              src={MATERIAL_PRIMARY.asset.path}
              alt={MATERIAL_PRIMARY.asset.alt}
              width={MATERIAL_PRIMARY.asset.width}
              height={MATERIAL_PRIMARY.asset.height}
              loading="lazy"
              sizes="(max-width: 1023px) 100vw, 58vw"
              style={{ objectPosition: MATERIAL_PRIMARY.asset.focalPoint }}
            />
            <figcaption>
              <strong>{MATERIAL_PRIMARY.theme}</strong>
              <span>{MATERIAL_PRIMARY.caption}</span>
            </figcaption>
          </Reveal>

          <div className="cm-story__stack">
            <Reveal as="figure" order={1} className="cm-story__figure">
              <Image
                src={kitchen.asset.path}
                alt={kitchen.asset.alt}
                width={kitchen.asset.width}
                height={kitchen.asset.height}
                loading="lazy"
                sizes="(max-width: 1023px) 100vw, 36vw"
                style={{ objectPosition: kitchen.asset.focalPoint }}
              />
              <figcaption>
                <strong>{kitchen.title}</strong>
                <span>{kitchen.description}</span>
              </figcaption>
            </Reveal>
            <Reveal as="figure" order={2} className="cm-story__figure">
              <Image
                src={wardrobe.asset.path}
                alt={wardrobe.asset.alt}
                width={wardrobe.asset.width}
                height={wardrobe.asset.height}
                loading="lazy"
                sizes="(max-width: 1023px) 100vw, 36vw"
                style={{ objectPosition: wardrobe.asset.focalPoint }}
              />
              <figcaption>
                <strong>{wardrobe.title}</strong>
                <span>{wardrobe.description}</span>
              </figcaption>
            </Reveal>
          </div>
        </div>

        <Reveal className="cm-story__note">
          <p className="dc-body">{CM_STORY.futureNote}</p>
          {MATERIAL_SUPPORTING.length > 0 ? (
            <p className="dc-sr-only">
              Supporting material themes:{" "}
              {MATERIAL_SUPPORTING.map((item) => item.theme).join("; ")}.
            </p>
          ) : null}
        </Reveal>
      </div>
    </section>
  );
}
