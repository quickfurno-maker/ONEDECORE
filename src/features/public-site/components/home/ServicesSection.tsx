import { SERVICE_STORIES, SERVICES_SECTION_COPY } from "../../content/services";
import { Container } from "../primitives/Container";
import { EditorialSectionHeading } from "../primitives/EditorialSectionHeading";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { ServiceEditorialRow } from "./ServiceEditorialRow";

/**
 * Homepage services section — alternating editorial rows.
 * Production omits service CTAs until Phase 2F-D routes ship.
 */
export function ServicesSection() {
  return (
    <Section
      id="homepage-services-section"
      aria-labelledby="homepage-services-heading"
      spacing="default"
      surface="stone"
    >
      <Container width="wide">
        <Reveal>
          <EditorialSectionHeading
            headingId="homepage-services-heading"
            as="h2"
            overline={SERVICES_SECTION_COPY.overline}
            title={SERVICES_SECTION_COPY.heading}
            description={SERVICES_SECTION_COPY.introduction}
            align="left"
            className="ps-services__heading max-w-[var(--editorial-width)]"
          />
        </Reveal>

        <div className="ps-services__rows">
          {SERVICE_STORIES.map((service, index) => (
            <ServiceEditorialRow
              key={service.id}
              service={service}
              revealDelayMs={index * 60}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
