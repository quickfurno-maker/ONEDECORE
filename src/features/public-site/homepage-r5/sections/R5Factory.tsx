"use client";

import { useState } from "react";
import { R5_FACTORY, R5_FACTORY_COPY } from "../content";

/**
 * Own Factory — three capabilities, and deliberately no factory photograph.
 *
 * THE MISSING PICTURE IS THE DESIGN DECISION
 *
 * The brief asks for "one strong factory visual ONLY if real approved factory
 * media exists". It does not. The repository holds nine images — a hero, three
 * service interiors, three material studies, a consultant portrait and a dusk
 * detail — and every one is `provenanceCategory: "C"`, documented as
 * "ONEDECORE marketing artwork. Never presented as project photography."
 *
 * A stock photograph of an anonymous CNC machine placed under the heading
 * "Built in our own manufacturing unit" would read to every visitor as a
 * photograph of ONEDECORE's factory. That is the claim this repository has
 * spent several lanes refusing to make, so the section is built from type and a
 * selection state instead.
 *
 * When real factory media arrives, it drops in above the cards and the copy
 * does not have to change.
 *
 * WHAT THE CARDS DO NOT SAY
 *
 * No machinery names, no tolerances, no certifications, no throughput. Each
 * line describes an OUTCOME that existing approved content already claims —
 * controlled production, checks before dispatch — because a capability nobody
 * has approved is a capability nobody should publish.
 */
export function R5Factory() {
  const [activeId, setActiveId] = useState<string>(R5_FACTORY[0]!.id);

  return (
    <section className="r5-section" aria-labelledby="r5-factory-title">
      <div className="dc-container">
        <header className="r5-head">
          <p className="r5-eyebrow">{R5_FACTORY_COPY.eyebrow}</p>
          <h2 id="r5-factory-title" className="r5-heading">
            {R5_FACTORY_COPY.heading}
          </h2>
          <p className="r5-supporting">{R5_FACTORY_COPY.supporting}</p>
        </header>

        <ul className="r5-proof r5-proof--three">
          {R5_FACTORY.map((item) => {
            const active = item.id === activeId;
            return (
              <li key={item.id}>
                {/*
                  A real button, not a div with a handler: this is a selection
                  control and must be reachable and operable from a keyboard.
                  `aria-pressed` is the honest role here — nothing is disclosed
                  or navigated to, the card simply becomes the emphasised one.
                */}
                <button
                  type="button"
                  className="r5-proofItem r5-proofItem--interactive"
                  aria-pressed={active}
                  onClick={() => setActiveId(item.id)}
                >
                  <h3 className="r5-proofItem__title">{item.title}</h3>
                  <p className="r5-proofItem__text">{item.description}</p>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
