"use client";

import { useEffect, useRef, useState } from "react";
import { R5_PROCESS, R5_PROCESS_COPY } from "../content";

/**
 * How It Works — four stages that light up as you reach them.
 *
 * WHY AN OBSERVER RATHER THAN A SCROLL HANDLER
 *
 * The "progression" this section wants is simply: the stage you are looking at
 * is the active one. A scroll listener would have to measure four elements on
 * every frame and would fight the compositor for the whole length of the page.
 * `IntersectionObserver` answers the same question by being told, costs nothing
 * while the section is off screen, and is the pattern the repository already
 * uses for reveals.
 *
 * NOTHING IS HIDDEN BEHIND THE ACTIVE STATE
 *
 * Every stage renders its number, title and description at all times. The
 * active state changes a rule colour and a number colour and nothing else, so a
 * visitor who never scrolls slowly enough to trigger it, or who has JavaScript
 * fail, reads exactly the same four stages. That is why this is safe to be a
 * client component: the content is server HTML, and the island only decorates.
 */
export function R5Process() {
  const [activeIndex, setActiveIndex] = useState(0);
  const stageRefs = useRef<Array<HTMLLIElement | null>>([]);

  useEffect(() => {
    const nodes = stageRefs.current.filter(
      (node): node is HTMLLIElement => node !== null
    );
    if (nodes.length === 0) return;

    /*
     * `rootMargin` pulls the trigger line towards the middle of the viewport.
     * Without it the last stage can never become active on a short screen,
     * because the page runs out of scroll before it reaches the top.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = nodes.indexOf(entry.target as HTMLLIElement);
          if (index >= 0) setActiveIndex(index);
        }
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 }
    );

    for (const node of nodes) observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="r5-section r5-section--tinted" aria-labelledby="r5-process-title">
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_PROCESS_COPY.eyebrow}</p>
          <h2 id="r5-process-title" className="r5-heading">
            {R5_PROCESS_COPY.heading}
          </h2>
          <p className="r5-supporting">{R5_PROCESS_COPY.supporting}</p>
        </header>

        <ol className="r5-stages">
          {R5_PROCESS.map((stage, index) => (
            <li
              key={stage.id}
              ref={(node) => {
                stageRefs.current[index] = node;
              }}
              className="r5-stage"
              data-active={index === activeIndex ? "true" : undefined}
            >
              {/* Decorative: the ordered list already conveys the sequence. */}
              <span className="r5-stage__number" aria-hidden="true">
                {stage.number}
              </span>
              <h3 className="r5-stage__title">{stage.title}</h3>
              <p className="r5-stage__text">{stage.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
