"use client";

import { useId, useState } from "react";
import { PM_SCOPE_AREAS, PM_SCOPE_COPY } from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { useRovingTabs } from "./useRovingTabs";

export function HomeScopeIncluded() {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const { openPlanner, getNextIncompleteStep } = usePlan();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PM_SCOPE_AREAS[activeIndex]!;
  const { setTabRef, onTabListKeyDown, activate } = useRovingTabs(
    PM_SCOPE_AREAS.length,
    activeIndex,
    setActiveIndex
  );

  return (
    <section
      id="included"
      className="pm-section pm-scope"
      aria-labelledby="pm-scope-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_SCOPE_COPY.eyebrow}</p>
          <h2 id="pm-scope-title" className="pm-h2">
            {PM_SCOPE_COPY.heading}
          </h2>
          <p className="pm-lede">{PM_SCOPE_COPY.lede}</p>
        </Reveal>

        <Reveal className="pm-scope__shell" order={1}>
          <div
            className="pm-scope__list"
            role="tablist"
            aria-label="Project scope areas"
            onKeyDown={onTabListKeyDown}
          >
            {PM_SCOPE_AREAS.map((area, index) => (
              <button
                key={area.id}
                ref={setTabRef(index)}
                type="button"
                role="tab"
                id={`${baseId}-tab-${area.id}`}
                className="pm-scope__tab"
                aria-selected={index === activeIndex}
                aria-controls={panelId}
                tabIndex={index === activeIndex ? 0 : -1}
                data-active={index === activeIndex ? "" : undefined}
                onClick={() => activate(index)}
              >
                <span className="pm-scope__num" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{area.title}</span>
              </button>
            ))}
          </div>

          <div className="pm-scope__stage">
            <svg
              className="pm-scope__diagram"
              viewBox="0 0 320 220"
              aria-hidden="true"
              focusable="false"
            >
              <rect x="16" y="16" width="288" height="188" rx="6" />
              {PM_SCOPE_AREAS.map((_, index) => {
                const x = 40 + index * 42;
                return (
                  <g key={index}>
                    <circle
                      cx={x}
                      cy="110"
                      r={index === activeIndex ? 10 : 6}
                      data-active={index === activeIndex ? "" : undefined}
                    />
                    {index < PM_SCOPE_AREAS.length - 1 ? (
                      <path d={`M${x + 10} 110 H${x + 32}`} />
                    ) : null}
                  </g>
                );
              })}
              <path
                className="pm-scope__activePath"
                d={`M40 150 H${40 + activeIndex * 42}`}
              />
            </svg>

            <div
              id={panelId}
              role="tabpanel"
              aria-labelledby={`${baseId}-tab-${active.id}`}
              className="pm-scope__panel"
            >
              <h3 className="pm-h3">{active.title}</h3>
              <p className="pm-body">{active.body}</p>
            </div>
          </div>
        </Reveal>

        <Reveal className="pm-scope__cta" order={2}>
          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
            data-conversion-action="scope-build-brief"
            onClick={() => openPlanner(getNextIncompleteStep())}
          >
            {PM_SCOPE_COPY.cta}
          </button>
        </Reveal>

        <noscript>
          <div className="pm-noscript">
            {PM_SCOPE_AREAS.map((area) => (
              <article key={area.id}>
                <h3>{area.title}</h3>
                <p>{area.body}</p>
              </article>
            ))}
          </div>
        </noscript>
      </div>
    </section>
  );
}
