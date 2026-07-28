import type { Metadata } from "next";
import { CinematicConcept } from "@/features/design-concepts/concepts/cinematic/CinematicConcept";
import { getConcept } from "@/features/design-concepts/content/concepts";
import { loadConceptFeatured } from "@/features/design-concepts/server/featured";
import { ConceptShell } from "@/features/design-concepts/shared/ConceptShell";

const concept = getConcept("cinematic");

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: `ONEDECORE — Concept A: ${concept.name} (internal review)`,
  description: concept.thesis,
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export default async function CinematicConceptPage() {
  const featured = await loadConceptFeatured();

  return (
    <ConceptShell concept={concept}>
      <CinematicConcept featured={featured} />
    </ConceptShell>
  );
}
