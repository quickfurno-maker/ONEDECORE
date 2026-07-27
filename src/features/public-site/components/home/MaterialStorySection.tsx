import {
  MATERIAL_STORY_ITEMS,
  MATERIAL_STORY_SECTION_COPY,
} from "../../content/material-story";
import { Container } from "../primitives/Container";
import { EditorialSectionHeading } from "../primitives/EditorialSectionHeading";
import { Reveal } from "../primitives/Reveal";
import { Section } from "../primitives/Section";
import { MaterialStoryItemView } from "./MaterialStoryItem";

/**
 * Homepage material story — selective dark editorial band.
 * One primary + two supporting Category-C marketing moments.
 */
export function MaterialStorySection() {
  const primary = MATERIAL_STORY_ITEMS.find((item) => item.role === "primary");
  const supporting = MATERIAL_STORY_ITEMS.filter((item) => item.role === "supporting");

  if (!primary) {
    return null;
  }

  return (
    <Section
      id="homepage-material-story-section"
      aria-labelledby="homepage-material-story-heading"
      spacing="default"
      surface="dark"
      className="ps-material"
    >
      <Container width="wide">
        <Reveal>
          <EditorialSectionHeading
            headingId="homepage-material-story-heading"
            as="h2"
            overline={MATERIAL_STORY_SECTION_COPY.overline}
            title={MATERIAL_STORY_SECTION_COPY.heading}
            description={MATERIAL_STORY_SECTION_COPY.introduction}
            align="left"
            className="ps-material__heading max-w-[var(--editorial-width)]"
          />
        </Reveal>

        <div className="ps-material__grid">
          <div className="ps-material__primary">
            <MaterialStoryItemView item={primary} revealDelayMs={0} />
          </div>
          <div className="ps-material__supporting">
            {supporting.map((item, index) => (
              <MaterialStoryItemView
                key={item.id}
                item={item}
                revealDelayMs={(index + 1) * 60}
              />
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
