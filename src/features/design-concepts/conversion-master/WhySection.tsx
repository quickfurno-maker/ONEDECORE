import {
  CM_SECTION_IDS,
  TRUST_PILLARS,
  TRUST_SECTION_COPY,
} from "./content";
import { Reveal } from "../shared/Reveal";

/** Editorial trust composition — large statement + three lined principles. */
export function WhySection() {
  return (
    <section
      id={CM_SECTION_IDS.why}
      className="cm-section cm-why"
      aria-labelledby="cm-why-title"
    >
      <div className="dc-container cm-why__inner">
        <Reveal className="cm-why__intro">
          <p className="dc-eyebrow">{TRUST_SECTION_COPY.overline}</p>
          <h2 id="cm-why-title" className="cm-h2 cm-why__statement">
            {TRUST_SECTION_COPY.heading}
          </h2>
          <p className="dc-lede">{TRUST_SECTION_COPY.introduction}</p>
        </Reveal>

        <ol className="cm-why__principles">
          {TRUST_PILLARS.map((pillar, index) => (
            <Reveal
              as="li"
              key={pillar.id}
              order={index + 1}
              className="cm-why__principle"
            >
              <span className="dc-ordinal">{pillar.ordinal}</span>
              <h3 className="cm-why__principleTitle">{pillar.title}</h3>
              <p className="cm-why__principleBody">{pillar.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
