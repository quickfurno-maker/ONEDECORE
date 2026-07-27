import { BRAND_PROPOSITION_COPY } from "../../content/homepage";
import { Container } from "../primitives/Container";
import { EditorialSectionHeading } from "../primitives/EditorialSectionHeading";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";

export function BrandProposition() {
  return (
    <Section id="brand-proposition-section" spacing="default">
      <Container width="content">
        <Reveal>
          <EditorialSectionHeading
            as="h2"
            title={BRAND_PROPOSITION_COPY.heading}
            description={BRAND_PROPOSITION_COPY.body}
            align="left"
            className="max-w-[var(--editorial-width)]"
          />
        </Reveal>
      </Container>
    </Section>
  );
}
