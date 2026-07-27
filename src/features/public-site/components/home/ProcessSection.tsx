import { PROCESS_SECTION_COPY, PROCESS_STEPS } from "../../content/process";
import { Container } from "../primitives/Container";
import { EditorialSectionHeading } from "../primitives/EditorialSectionHeading";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { ProcessStepItem } from "./ProcessStep";

/**
 * Homepage process section — calm four-stage design journey.
 * Production omits CTA until Phase 2F-E ships /process.
 */
export function ProcessSection() {
  return (
    <Section
      id="homepage-process-section"
      aria-labelledby="homepage-process-heading"
      spacing="default"
      surface="stone"
    >
      <Container width="wide">
        <Reveal>
          <EditorialSectionHeading
            headingId="homepage-process-heading"
            as="h2"
            overline={PROCESS_SECTION_COPY.overline}
            title={PROCESS_SECTION_COPY.heading}
            description={PROCESS_SECTION_COPY.introduction}
            align="left"
            className="ps-process__heading max-w-[var(--editorial-width)]"
          />
        </Reveal>

        <ol className="ps-process__steps" aria-label="Design process stages">
          {PROCESS_STEPS.map((step, index) => (
            <li key={step.id} className="ps-process__step-item">
              <ProcessStepItem
                step={step}
                revealDelayMs={index * 50}
                isLast={index === PROCESS_STEPS.length - 1}
              />
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
