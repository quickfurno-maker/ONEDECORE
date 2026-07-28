import {
  CM_SECTION_IDS,
  TRUST_PILLARS,
  TRUST_SECTION_COPY,
} from "./content";
import { Reveal } from "../shared/Reveal";

/** Editorial trust composition — not three equal cards. */
export function WhySection() {
  const [lead, ...rest] = TRUST_PILLARS;

  return (
    <section
      id={CM_SECTION_IDS.why}
      className="cm-section cm-why"
      aria-labelledby="cm-why-title"
    >
      <div className="dc-container cm-why__inner">
        <Reveal className="cm-why__intro">
          <p className="dc-eyebrow">{TRUST_SECTION_COPY.overline}</p>
          <h2 id="cm-why-title" className="cm-h2">
            {TRUST_SECTION_COPY.heading}
          </h2>
          <p className="dc-lede">{TRUST_SECTION_COPY.introduction}</p>
        </Reveal>

        <Reveal className="cm-why__lead" order={1}>
          <span className="dc-ordinal">{lead.ordinal}</span>
          <h3 className="cm-why__leadTitle">{lead.title}</h3>
          <p className="cm-why__leadBody">{lead.body}</p>
        </Reveal>

        <ul className="cm-why__rail">
          {rest.map((pillar, index) => (
            <Reveal as="li" key={pillar.id} order={index + 2} className="cm-why__item">
              <span className="dc-ordinal">{pillar.ordinal}</span>
              <h3 className="cm-h3">{pillar.title}</h3>
              <p className="dc-body">{pillar.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}
