import { TRUST_PILLARS, TRUST_SECTION_COPY } from "../../content/trust";
import { Container } from "../primitives/Container";
import { EditorialSectionHeading } from "../primitives/EditorialSectionHeading";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { TrustPillarItem } from "./TrustPillar";

/**
 * Homepage trust section — design-philosophy pillars (max 3).
 * No numeric claims, social proof quotes, trophies, or conversion CTA.
 */
export function TrustSection() {
  return (
    <Section
      id="homepage-trust-section"
      aria-labelledby="homepage-trust-heading"
      spacing="default"
      surface="stone"
    >
      <Container width="wide">
        <Reveal>
          <EditorialSectionHeading
            headingId="homepage-trust-heading"
            as="h2"
            overline={TRUST_SECTION_COPY.overline}
            title={TRUST_SECTION_COPY.heading}
            description={TRUST_SECTION_COPY.introduction}
            align="left"
            className="ps-trust__heading max-w-[var(--editorial-width)]"
          />
        </Reveal>

        <div className="ps-trust__pillars">
          {TRUST_PILLARS.map((pillar, index) => (
            <TrustPillarItem
              key={pillar.id}
              pillar={pillar}
              revealDelayMs={index * 50}
            />
          ))}
        </div>
      </Container>
    </Section>
  );
}
