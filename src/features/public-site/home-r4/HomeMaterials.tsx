"use client";

import Image from "next/image";
import { useId, useState } from "react";
import {
  PM_MATERIALS_COPY,
  PM_MATERIAL_DECISION_STEPS,
  PM_MATERIAL_PRIMARY,
  PM_MATERIAL_SUPPORTING,
  PM_SECTION_IDS,
} from "./content";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { useRovingTabs } from "./useRovingTabs";

export function HomeMaterials() {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const primary = PM_MATERIAL_PRIMARY;
  const [stepIndex, setStepIndex] = useState(0);
  const step = PM_MATERIAL_DECISION_STEPS[stepIndex]!;
  const { setTabRef, onTabListKeyDown, activate } = useRovingTabs(
    PM_MATERIAL_DECISION_STEPS.length,
    stepIndex,
    setStepIndex
  );

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

        <Reveal className="pm-materials__decision" order={4}>
          <h3 className="pm-h3">{PM_MATERIALS_COPY.decisionHeading}</h3>
          <div
            className="pm-materials__steps"
            role="tablist"
            aria-label="Material decision sequence"
            onKeyDown={onTabListKeyDown}
          >
            {PM_MATERIAL_DECISION_STEPS.map((entry, index) => (
              <button
                key={entry.id}
                ref={setTabRef(index)}
                type="button"
                role="tab"
                id={`${baseId}-tab-${entry.id}`}
                className="pm-materials__step"
                aria-selected={index === stepIndex}
                aria-controls={panelId}
                tabIndex={index === stepIndex ? 0 : -1}
                data-active={index === stepIndex ? "" : undefined}
                onClick={() => activate(index)}
              >
                <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                {entry.title}
              </button>
            ))}
          </div>
          <div
            id={panelId}
            className="pm-materials__stepPanel"
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${step.id}`}
          >
            <p className="pm-body">{step.body}</p>
          </div>
        </Reveal>

        <noscript>
          <div className="pm-noscript">
            <h3>{PM_MATERIALS_COPY.decisionHeading}</h3>
            {PM_MATERIAL_DECISION_STEPS.map((entry) => (
              <article key={entry.id}>
                <h4>{entry.title}</h4>
                <p>{entry.body}</p>
              </article>
            ))}
          </div>
        </noscript>
      </div>
    </section>
  );
}
