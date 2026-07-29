"use client";

import { useId, useState } from "react";
import { PM_SECTION_IDS, PM_WHY } from "./content";
import { usePlan } from "./PlanContext";
import { useRovingTabs } from "./useRovingTabs";
import { Reveal } from "@/features/public-site/motion/Reveal";

/** Why ONEDECORE — four pillars with roving tablist. */
export function HomeWhy() {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const { openPlanner } = usePlan();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PM_WHY.pillars[activeIndex]!;
  const { setTabRef, onTabListKeyDown, activate } = useRovingTabs(
    PM_WHY.pillars.length,
    activeIndex,
    setActiveIndex
  );

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

          <div
            className="pm-why__tabs"
            role="tablist"
            aria-label="Why ONEDECORE pillars"
            onKeyDown={onTabListKeyDown}
          >
            {PM_WHY.pillars.map((pillar, index) => (
              <button
                key={pillar.id}
                ref={setTabRef(index)}
                type="button"
                role="tab"
                id={`${baseId}-tab-${pillar.id}`}
                aria-selected={index === activeIndex}
                aria-controls={panelId}
                tabIndex={index === activeIndex ? 0 : -1}
                className="pm-why__item"
                data-active={index === activeIndex ? "" : undefined}
                onClick={() => activate(index)}
              >
                <span className="pm-why__index">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="pm-why__itemTitle">{pillar.title}</span>
              </button>
            ))}
          </div>

          <article
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active.id}`}
            className="pm-why__panel"
            tabIndex={0}
          >
            <p className="pm-why__panelNum" aria-hidden="true">
              {String(activeIndex + 1).padStart(2, "0")}
            </p>
            <h3 className="pm-h3">{active.title}</h3>
            <p className="pm-body">{active.body}</p>
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

        <noscript>
          <div className="pm-noscript">
            {PM_WHY.pillars.map((pillar, index) => (
              <article key={pillar.id}>
                <h3>
                  {String(index + 1).padStart(2, "0")} {pillar.title}
                </h3>
                <p>{pillar.body}</p>
              </article>
            ))}
          </div>
        </noscript>
      </div>
    </section>
  );
}
