import { CM_FAQS, CM_SECTION_IDS } from "./content";
import { Reveal } from "../shared/Reveal";

export function FaqSection() {
  return (
    <section
      id={CM_SECTION_IDS.faqs}
      className="cm-section cm-faq"
      aria-labelledby="cm-faq-title"
    >
      <div className="dc-container">
        <Reveal className="cm-section__head">
          <p className="dc-eyebrow">FAQs</p>
          <h2 id="cm-faq-title" className="cm-h2">
            Questions before the first conversation
          </h2>
        </Reveal>

        <div className="cm-faq__list">
          {CM_FAQS.map((item, index) => (
            <Reveal key={item.id} order={index} className="cm-faq__item">
              <details>
                <summary>
                  <span className="cm-faq__q">{item.question}</span>
                </summary>
                <p className="cm-faq__a">{item.answer}</p>
              </details>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
