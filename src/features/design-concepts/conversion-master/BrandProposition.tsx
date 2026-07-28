import { CM_PROPOSITION, CM_SECTION_IDS } from "./content";
import { Reveal } from "../shared/Reveal";

export function BrandProposition() {
  return (
    <section
      id={CM_SECTION_IDS.proposition}
      className="cm-section cm-prop"
      aria-labelledby="cm-prop-title"
    >
      <div className="dc-container cm-prop__inner">
        <Reveal>
          <span className="cm-prop__rule" aria-hidden="true" />
          <h2 id="cm-prop-title" className="cm-h2">
            {CM_PROPOSITION.heading}
          </h2>
          <p className="cm-prop__body">{CM_PROPOSITION.body}</p>
        </Reveal>
      </div>
    </section>
  );
}
