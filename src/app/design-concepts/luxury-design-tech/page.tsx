import type { Metadata } from "next";
import { DesignTechConcept } from "@/features/design-concepts/concepts/design-tech/DesignTechConcept";
import { getConcept } from "@/features/design-concepts/content/concepts";
import { loadConceptFeatured } from "@/features/design-concepts/server/featured";
import { ConceptShell } from "@/features/design-concepts/shared/ConceptShell";

const concept = getConcept("design-tech");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `ONEDECORE — Concept C: ${concept.name} (internal review)`,
  description: concept.thesis,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function DesignTechConceptPage() {
  const featured = await loadConceptFeatured();

  return (
    <ConceptShell concept={concept}>
      <DesignTechConcept featured={featured} />
    </ConceptShell>
  );
}
