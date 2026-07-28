"use client";

import { useId, useState } from "react";
import { PM_FAQS, PM_FAQ_COPY, PM_SECTION_IDS } from "./content";
import { Reveal } from "../shared/Reveal";

function Chevron() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <path
        d="M6 9.5l6 6 6-6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Controlled accordion with grid-template-rows motion.
 * Content stays in the DOM (no `hidden`) so open/close can animate.
 */
export function PmFaq() {
  const baseId = useId();
  const [openId, setOpenId] = useState<string | null>(PM_FAQS[0]!.id);

  return (
    <section
      id={PM_SECTION_IDS.faqs}
      className="pm-section pm-faq"
      aria-labelledby="pm-faq-title"
    >
      <div className="dc-container pm-faq__inner">
        <Reveal className="pm-faq__head">
          <p className="pm-eyebrow">{PM_FAQ_COPY.eyebrow}</p>
          <h2 id="pm-faq-title" className="pm-h2">
            {PM_FAQ_COPY.heading}
          </h2>
        </Reveal>

        <Reveal className="pm-faq__list" order={1}>
          {PM_FAQS.map((faq) => {
            const isOpen = openId === faq.id;
            const panelId = `${baseId}-${faq.id}`;
            const triggerId = `${panelId}-trigger`;
            return (
              <div
                key={faq.id}
                className="pm-faq__item"
                data-open={isOpen ? "" : undefined}
              >
                <h3 className="pm-faq__heading">
                  <button
                    type="button"
                    id={triggerId}
                    className="pm-faq__trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpenId(isOpen ? null : faq.id)}
                  >
                    <span>{faq.question}</span>
                    <span className="pm-faq__icon" aria-hidden="true">
                      <Chevron />
                    </span>
                  </button>
                </h3>
                <div
                  className="pm-faq__panel"
                  data-open={isOpen ? "" : undefined}
                >
                  <div
                    id={panelId}
                    role="region"
                    aria-labelledby={triggerId}
                    className="pm-faq__answer"
                  >
                    <p className="pm-faq__answerText">{faq.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </Reveal>
      </div>
    </section>
  );
}
