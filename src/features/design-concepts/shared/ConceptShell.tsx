import type { ReactNode } from "react";
import type { ConceptDefinition } from "../content/concepts";
import { HOMEPAGE_COPY, SECTION_IDS, buildConceptNav } from "../content/shared-content";
import { ConceptFooter } from "./ConceptFooter";
import { ConceptNav } from "./ConceptNav";
import { ReviewBanner } from "./ReviewBanner";
import { RevealRuntime } from "./RevealRuntime";

const CONCEPT_MAIN_ID = "concept-main";

const TRACKED_SECTIONS = [
  SECTION_IDS.services,
  SECTION_IDS.process,
  SECTION_IDS.materials,
  SECTION_IDS.trust,
] as const;

interface ConceptShellProps {
  readonly concept: ConceptDefinition;
  readonly children: ReactNode;
}

/**
 * Chrome shared by all three concepts: review banner, navigation, main
 * landmark, footer, and the reveal runtime. Individual concepts differ inside
 * `children` and through the `data-concept` styling hook.
 */
export function ConceptShell({ concept, children }: ConceptShellProps) {
  return (
    <div data-design-concept="" data-concept={concept.id}>
      <a className="dc-skip" href={`#${CONCEPT_MAIN_ID}`}>
        Skip to concept content
      </a>

      <ReviewBanner conceptLetter={concept.letter} conceptName={concept.name} />

      <ConceptNav
        conceptHref={concept.href}
        items={buildConceptNav(concept.href)}
        ctaLabel={HOMEPAGE_COPY.ctaLabel}
        ctaHref={HOMEPAGE_COPY.ctaHref}
        sectionIds={TRACKED_SECTIONS}
      />

      <main id={CONCEPT_MAIN_ID} tabIndex={-1}>
        {children}
      </main>

      <ConceptFooter variant={concept.id} />
      <RevealRuntime />
    </div>
  );
}
