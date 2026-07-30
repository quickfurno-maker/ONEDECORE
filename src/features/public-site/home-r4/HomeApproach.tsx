"use client";

import { useId, useState } from "react";
import {
  PM_APPROACH_COPY,
  PM_APPROACH_DIAGRAM,
  PM_APPROACH_USPS,
} from "./content";
import { Reveal } from "@/features/public-site/motion/Reveal";
import { useRovingTabs } from "./useRovingTabs";

/** Four USP tabs + decorative six-node journey diagram (not a tablist). */
export function HomeApproach() {
  const baseId = useId();
  const panelId = `${baseId}-panel`;
  const [activeIndex, setActiveIndex] = useState(0);
  const active = PM_APPROACH_USPS[activeIndex]!;
  const { setTabRef, onTabListKeyDown, activate } = useRovingTabs(
    PM_APPROACH_USPS.length,
    activeIndex,
    setActiveIndex
  );

  return (
    <section
      id="approach"
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
          <ol className="pm-approach__journey" aria-label="Interior journey">
            {PM_APPROACH_DIAGRAM.map((node, index) => {
              const highlight = Math.min(
                PM_APPROACH_USPS.length - 1,
                Math.floor(
                  (index / (PM_APPROACH_DIAGRAM.length - 1)) *
                    (PM_APPROACH_USPS.length - 1)
                )
              );
              return (
                <li
                  key={node}
                  className="pm-approach__journeyItem"
                  data-active={highlight === activeIndex ? "" : undefined}
                >
                  <span className="pm-approach__nodeDot" aria-hidden="true" />
                  <span>{node}</span>
                </li>
              );
            })}
          </ol>

          <div
            className="pm-approach__usps"
            role="tablist"
            aria-label="What you can expect"
            onKeyDown={onTabListKeyDown}
          >
            {PM_APPROACH_USPS.map((usp, index) => (
              <button
                key={usp.id}
                ref={setTabRef(index)}
                type="button"
                role="tab"
                id={`${baseId}-tab-${usp.id}`}
                className="pm-approach__usp"
                aria-selected={index === activeIndex}
                aria-controls={panelId}
                tabIndex={index === activeIndex ? 0 : -1}
                data-active={index === activeIndex ? "" : undefined}
                onClick={() => activate(index)}
              >
                <span className="pm-ordinal">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="pm-approach__uspTitle">{usp.title}</span>
              </button>
            ))}
          </div>

          <div
            id={panelId}
            role="tabpanel"
            aria-labelledby={`${baseId}-tab-${active.id}`}
            className="pm-approach__active"
          >
            <h3 className="pm-h3">{active.title}</h3>
            <p className="pm-body">{active.body}</p>
          </div>
        </Reveal>

        <noscript>
          <div className="pm-noscript">
            <ol>
              {PM_APPROACH_DIAGRAM.map((node) => (
                <li key={node}>{node}</li>
              ))}
            </ol>
            {PM_APPROACH_USPS.map((usp) => (
              <article key={usp.id}>
                <h3>{usp.title}</h3>
                <p>{usp.body}</p>
              </article>
            ))}
          </div>
        </noscript>
      </div>
    </section>
  );
}
