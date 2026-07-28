"use client";

import {
  CM_PROCESS_CTA,
  CM_SECTION_IDS,
  PROCESS_SECTION_COPY,
  PROCESS_STEPS,
} from "./content";
import { useLead } from "./LeadContext";
import { Reveal } from "../shared/Reveal";

export function ProcessSection() {
  const { openPlanner } = useLead();

  return (
    <section
      id={CM_SECTION_IDS.process}
      className="cm-section cm-process"
      aria-labelledby="cm-process-title"
    >
      <div className="dc-container">
        <Reveal className="cm-section__head">
          <p className="dc-eyebrow">{PROCESS_SECTION_COPY.overline}</p>
          <h2 id="cm-process-title" className="cm-h2">
            {PROCESS_SECTION_COPY.heading}
          </h2>
          <p className="dc-lede">{PROCESS_SECTION_COPY.introduction}</p>
        </Reveal>

        <ol className="cm-process__list">
          {PROCESS_STEPS.map((step, index) => (
            <Reveal as="li" key={step.id} order={index} className="cm-process__step">
              <span className="dc-ordinal">{step.ordinal}</span>
              <h3 className="cm-h3">{step.title}</h3>
              <p className="dc-body">{step.description}</p>
            </Reveal>
          ))}
        </ol>

        <Reveal className="cm-process__cta" order={4}>
          <button
            type="button"
            className="dc-btn dc-btn--primary"
            onClick={() => openPlanner()}
          >
            {CM_PROCESS_CTA}
          </button>
        </Reveal>
      </div>
    </section>
  );
}
