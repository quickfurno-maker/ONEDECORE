"use client";

import { useState } from "react";
import { PM_SECTION_IDS, PM_WHY } from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

/** Why ONEDECORE — six pillars in one architectural composition. */
export function HomeWhy() {
  const { openPlanner } = usePlan();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PM_WHY.pillars[activeIndex]!;

  return (
    <section
      id={PM_SECTION_IDS.why}
      className="pm-section pm-why"
      aria-labelledby="pm-why-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_WHY.eyebrow}</p>
          <h2 id="pm-why-title" className="pm-h2">
            {PM_WHY.heading}
          </h2>
          <p className="pm-lede">{PM_WHY.lede}</p>
        </Reveal>

        <Reveal className="pm-why__shell" order={1}>
          <div className="pm-why__rail" aria-hidden="true">
            <span
              className="pm-why__railFill"
              style={{
                transform: `scaleY(${(activeIndex + 1) / PM_WHY.pillars.length})`,
              }}
            />
          </div>

          <ol className="pm-why__list">
            {PM_WHY.pillars.map((pillar, index) => (
              <li key={pillar.id}>
                <button
                  type="button"
                  className="pm-why__item"
                  data-active={index === activeIndex ? "" : undefined}
                  aria-current={index === activeIndex ? "true" : undefined}
                  onClick={() => setActiveIndex(index)}
                >
                  <span className="pm-why__index">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="pm-why__itemTitle">{pillar.title}</span>
                </button>
              </li>
            ))}
          </ol>

          <article className="pm-why__panel">
            <p className="pm-why__panelNum" aria-hidden="true">
              {String(activeIndex + 1).padStart(2, "0")}
            </p>
            <h3 className="pm-h3">{active.title}</h3>
            <p className="pm-body">{active.body}</p>
            <p className="pm-why__satisfaction">{PM_WHY.satisfactionNote}</p>
          </article>
        </Reveal>

        <Reveal className="pm-why__cta" order={2}>
          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
            data-conversion-action="why-start-plan"
            onClick={() => openPlanner()}
          >
            {PM_WHY.cta}
          </button>
        </Reveal>
      </div>
    </section>
  );
}
