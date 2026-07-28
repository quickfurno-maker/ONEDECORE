"use client";

import { useState } from "react";
import { PM_PROCESS_COPY, PM_PROCESS_STAGES, PM_SECTION_IDS } from "./content";
import { usePlan } from "./PlanContext";
import { Reveal } from "@/features/public-site/motion/Reveal";

/**
 * Interactive stage walker. Tabs semantics, no scroll hijacking: the visitor
 * chooses a stage and the detail panel transitions in place.
 */
export function HomeProcess() {
  const { openPlanner } = usePlan();
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PM_PROCESS_STAGES[activeIndex]!;
  const progress = ((activeIndex + 1) / PM_PROCESS_STAGES.length) * 100;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % PM_PROCESS_STAGES.length);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) =>
          (index - 1 + PM_PROCESS_STAGES.length) % PM_PROCESS_STAGES.length
      );
    }
  };

  return (
    <section
      id={PM_SECTION_IDS.process}
      className="pm-section pm-process"
      aria-labelledby="pm-process-title"
    >
      <div className="dc-container">
        <Reveal className="pm-head">
          <p className="pm-eyebrow">{PM_PROCESS_COPY.eyebrow}</p>
          <h2 id="pm-process-title" className="pm-h2">
            {PM_PROCESS_COPY.heading}
          </h2>
          <p className="pm-lede">{PM_PROCESS_COPY.lede}</p>
        </Reveal>

        <Reveal className="pm-process__shell" order={1}>
          <div className="pm-process__rail" aria-hidden="true">
            <span
              className="pm-process__railFill"
              style={{ transform: `scaleX(${progress / 100})` }}
            />
          </div>

          <div
            className="pm-process__tabs"
            role="tablist"
            aria-label="Process stages"
            onKeyDown={onKeyDown}
          >
            {PM_PROCESS_STAGES.map((stage, index) => (
              <button
                key={stage.id}
                type="button"
                role="tab"
                id={`pm-process-tab-${stage.id}`}
                aria-selected={index === activeIndex}
                aria-controls={`pm-process-panel-${stage.id}`}
                tabIndex={index === activeIndex ? 0 : -1}
                className="pm-process__tab"
                data-active={index === activeIndex ? "" : undefined}
                data-past={index < activeIndex ? "" : undefined}
                onClick={() => setActiveIndex(index)}
              >
                <span className="pm-process__tabNum">{stage.ordinal}</span>
                <span className="pm-process__tabTitle">{stage.title}</span>
              </button>
            ))}
          </div>

          <div
            key={active.id}
            id={`pm-process-panel-${active.id}`}
            role="tabpanel"
            aria-labelledby={`pm-process-tab-${active.id}`}
            className="pm-process__panel"
            tabIndex={0}
          >
            <p className="pm-process__panelNum" aria-hidden="true">
              {active.ordinal}
            </p>
            <h3 className="pm-h3">{active.title}</h3>
            <p className="pm-body">{active.description}</p>
            <ul className="pm-process__focus">
              {active.focus.map((item, index) => (
                <li key={item} style={{ "--pm-line": index } as React.CSSProperties}>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal className="pm-process__cta" order={2}>
          <button
            type="button"
            className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
            onClick={() => openPlanner()}
          >
            {PM_PROCESS_COPY.cta}
          </button>
        </Reveal>
      </div>
    </section>
  );
}
