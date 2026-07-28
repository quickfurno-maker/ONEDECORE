import Image from "next/image";
import { PM_SECTION_IDS, PM_VISION } from "./content";
import { Reveal } from "../shared/Reveal";

const ASSET = PM_VISION.asset;

export function PmVision() {
  return (
    <section
      id={PM_SECTION_IDS.vision}
      className="pm-section pm-vision"
      aria-labelledby="pm-vision-title"
    >
      <div className="dc-container pm-vision__inner">
        <Reveal className="pm-vision__copy">
          <p className="pm-eyebrow">{PM_VISION.eyebrow}</p>
          <h2 id="pm-vision-title" className="pm-h2">
            {PM_VISION.heading}
          </h2>
          <p className="pm-lede">{PM_VISION.body}</p>
          <p className="pm-vision__pull">{PM_VISION.pull}</p>
        </Reveal>

        <Reveal className="pm-vision__media" order={1}>
          <figure className="pm-figure pm-figure--mask">
            <Image
              src={ASSET.path}
              alt={ASSET.alt}
              width={ASSET.width}
              height={ASSET.height}
              loading="lazy"
              sizes="(max-width: 1023px) 100vw, 46vw"
              style={{ objectPosition: ASSET.focalPoint }}
            />
          </figure>
        </Reveal>
      </div>
    </section>
  );
}
