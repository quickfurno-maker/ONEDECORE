"use client";

import { useState } from "react";
import {
  PM_APPROACH_COPY,
  PM_APPROACH_DIAGRAM,
  PM_APPROACH_USPS,
  PM_SECTION_IDS,
} from "./content";
import { Reveal } from "@/features/public-site/motion/Reveal";

/** Interactive USP system with architectural path — no fake guarantees. */
export function HomeApproach() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PM_APPROACH_USPS[activeIndex]!;

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % PM_APPROACH_USPS.length);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex(
        (index) => (index - 1 + PM_APPROACH_USPS.length) % PM_APPROACH_USPS.length
      );
    }
  };

  return (
    <section
      id={PM_SECTION_IDS.approach}
      className="pm-section pm-approach"
      aria-labelledby="pm-approach-title"
    >
      <div className="dc-container pm-approach__inner">
        <Reveal className="pm-approach__statement">
          <p className="pm-eyebrow">{PM_APPROACH_COPY.eyebrow}</p>
          <h2 id="pm-approach-title" className="pm-h2 pm-approach__heading">
            {PM_APPROACH_COPY.heading}
          </h2>
          <p className="pm-lede">{PM_APPROACH_COPY.lede}</p>
        </Reveal>

        <Reveal className="pm-approach__system" order={1}>
          <div
            className="pm-approach__diagram"
            role="tablist"
            aria-label="ONEDECORE journey nodes"
            onKeyDown={onKeyDown}
          >
            {PM_APPROACH_DIAGRAM.map((node, index) => {
              const uspsIndex = Math.min(
                PM_APPROACH_USPS.length - 1,
                Math.floor((index / (PM_APPROACH_DIAGRAM.length - 1)) * (PM_APPROACH_USPS.length - 1))
              );
              const selected = uspsIndex === activeIndex;
              return (
                <button
                  key={node}
                  type="button"
                  role="tab"
                  className="pm-approach__node"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  data-active={selected ? "" : undefined}
                  onClick={() => setActiveIndex(uspsIndex)}
                >
                  <span className="pm-approach__nodeDot" aria-hidden="true" />
                  <span>{node}</span>
                </button>
              );
            })}
          </div>

          <div className="pm-approach__usps" role="tabpanel">
            {PM_APPROACH_USPS.map((usp, index) => (
              <button
                key={usp.id}
                type="button"
                className="pm-approach__usp"
                data-active={index === activeIndex ? "" : undefined}
                aria-pressed={index === activeIndex}
                onClick={() => setActiveIndex(index)}
              >
                <span className="pm-ordinal">{String(index + 1).padStart(2, "0")}</span>
                <span className="pm-approach__uspTitle">{usp.title}</span>
                <span className="pm-approach__uspBody">{usp.body}</span>
              </button>
            ))}
          </div>

          <div className="pm-approach__active" aria-live="polite">
            <h3 className="pm-h3">{active.title}</h3>
            <p className="pm-body">{active.body}</p>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
