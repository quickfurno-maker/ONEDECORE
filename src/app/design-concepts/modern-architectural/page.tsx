import type { Metadata } from "next";
import { ArchitecturalConcept } from "@/features/design-concepts/concepts/architectural/ArchitecturalConcept";
import { getConcept } from "@/features/design-concepts/content/concepts";
import { loadConceptFeatured } from "@/features/design-concepts/server/featured";
import { ConceptShell } from "@/features/design-concepts/shared/ConceptShell";

const concept = getConcept("architectural");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `ONEDECORE — Concept B: ${concept.name} (internal review)`,
  description: concept.thesis,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function ArchitecturalConceptPage() {
  const featured = await loadConceptFeatured();

  return (
    <ConceptShell concept={concept}>
      <ArchitecturalConcept featured={featured} />
    </ConceptShell>
  );
}
