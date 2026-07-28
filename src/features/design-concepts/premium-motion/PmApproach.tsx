import { PM_APPROACH_COPY, PM_SECTION_IDS, TRUST_PILLARS } from "./content";
import { Reveal } from "../shared/Reveal";

/** Open editorial composition: one statement, three lined principles. */
export function PmApproach() {
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

        <ol className="pm-approach__list">
          {TRUST_PILLARS.map((pillar, index) => (
            <Reveal
              as="li"
              key={pillar.id}
              order={index + 1}
              className="pm-principle"
            >
              <span className="pm-principle__rule" aria-hidden="true" />
              <span className="pm-ordinal">{pillar.ordinal}</span>
              <h3 className="pm-principle__title">{pillar.title}</h3>
              <p className="pm-principle__body">{pillar.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}
