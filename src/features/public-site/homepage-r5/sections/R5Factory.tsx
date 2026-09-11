"use client";

import Image from "next/image";
import { useState } from "react";
import { PM_ASSETS } from "@/features/public-site/home-r4/content";
import { FACTORY_IMAGERY_NOTE, R5_FACTORY, R5_FACTORY_COPY } from "../content";

const FACTORY_IMAGE = PM_ASSETS.manufacturingReference;

/**
 * Own Factory — three capabilities and one clearly-labelled representative
 * visual.
 *
 * THE PICTURE IS CAPTIONED, NOT IMPLIED
 *
 * This section had no image at all, because the repository had no factory
 * media and a stock photograph of an anonymous CNC machine under the heading
 * "Built in our own manufacturing unit" reads to every visitor as a photograph
 * of ONEDECORE's factory. That is the claim this repository has spent several
 * lanes refusing to make.
 *
 * The owner's image pack supplies a workshop visual and is explicit that it is
 * representative artwork, not documentary photography of the facility. The
 * launch brief allows it on one condition: that the existing caption system can
 * say so honestly without looking like a dev placeholder. It can, so the
 * picture is here and `FACTORY_IMAGERY_NOTE` sits immediately beneath it —
 * under the image, not at the foot of the section, because a disclosure a
 * reader scrolls past is not a disclosure.
 *
 * The note is deliberately specific. The generic reference-imagery sentence
 * answers "is this a finished project"; the question here is "is this YOUR
 * factory", and the answer is no.
 *
 * When authentic factory photography arrives, the file and the note change
 * together. The copy does not.
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

        <figure className="r5-factoryFigure">
          <div className="r5-factoryMedia">
            <Image
              src={FACTORY_IMAGE.path}
              alt={FACTORY_IMAGE.alt}
              width={FACTORY_IMAGE.width}
              height={FACTORY_IMAGE.height}
              sizes="(min-width: 1100px) 1040px, (min-width: 768px) 92vw, 100vw"
              /* Below the fold by definition — the hero, the rail and four
                 sections sit above it. */
              loading="lazy"
              quality={75}
              style={{ objectPosition: FACTORY_IMAGE.focalPoint }}
            />
          </div>
          <figcaption className="r5-note r5-note--figure">{FACTORY_IMAGERY_NOTE}</figcaption>
        </figure>

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
