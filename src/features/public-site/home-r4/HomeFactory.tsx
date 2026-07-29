"use client";

import Image from "next/image";
import {
  PM_FACTORY,
  PM_MATERIAL_PRIMARY,
  PM_MATERIAL_SUPPORTING,
  PM_SECTION_IDS,
} from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

/** Designed here. Built by us. — manufacturing differentiation with material close-ups. */
export function HomeFactory() {
  const { openPlanner } = usePlan();
  const materials = [PM_MATERIAL_PRIMARY, ...PM_MATERIAL_SUPPORTING];

  return (
    <section
      id={PM_SECTION_IDS.factory}
      className="pm-section pm-factory"
      aria-labelledby="pm-factory-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_FACTORY.eyebrow}</p>
          <h2 id="pm-factory-title" className="pm-h2">
            {PM_FACTORY.heading}
          </h2>
          <p className="pm-lede">{PM_FACTORY.lede}</p>
        </Reveal>

        <Reveal className="pm-factory__stages" order={1}>
          <ol className="pm-factory__stageList">
            {PM_FACTORY.stages.map((stage, index) => (
              <li
                key={stage.id}
                style={{ "--pm-line": index } as React.CSSProperties}
              >
                <span className="pm-factory__stageNum">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="pm-h3">{stage.title}</h3>
                  <p className="pm-body">{stage.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </Reveal>

        <Reveal className="pm-factory__materials" order={2}>
          <div className="pm-factory__materialGrid">
            {materials.map((material) => (
              <figure key={material.id} className="pm-factory__material">
                <Image
                  src={material.asset.path}
                  alt={material.asset.alt}
                  width={material.asset.width}
                  height={material.asset.height}
                  loading="lazy"
                  sizes="(max-width: 767px) 100vw, 30vw"
                  style={{ objectPosition: material.asset.focalPoint }}
                />
                <figcaption>
                  <span className="pm-ordinal">{material.ordinal}</span>
                  <span>{material.theme}</span>
                </figcaption>
              </figure>
            ))}
          </div>

          <div className="pm-factory__path">
            <h3 className="pm-h3">{PM_FACTORY.materialPathHeading}</h3>
            <ol>
              {PM_FACTORY.materialPath.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </div>
        </Reveal>

        <Reveal className="pm-card pm-factory__callout" order={3}>
          <span className="pm-card__glow" aria-hidden="true" />
          <h3 className="pm-h3">{PM_FACTORY.calloutTitle}</h3>
          <p className="pm-body">{PM_FACTORY.calloutBody}</p>
          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--sheen"
            data-conversion-action="factory-explore"
            onClick={() => openPlanner()}
          >
            {PM_FACTORY.cta}
          </button>
        </Reveal>
      </div>
    </section>
  );
}
