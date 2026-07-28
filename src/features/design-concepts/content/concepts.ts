/**
 * Phase 2F owner-review concept registry.
 *
 * R3 Conversion Master is the active direction (see conversion-master feature).
 * The three R2 entries below remain for historical comparison only.
 *
 * Internal design review only. These routes are not part of the public site,
 * are excluded from the sitemap, and carry noindex/nofollow metadata.
 */

export type ConceptId = "cinematic" | "architectural" | "design-tech";

/** Active Phase 2F-R3 owner-review prototype (not part of the R2 letter set). */
export const CONVERSION_MASTER = {
  id: "conversion-master",
  slug: "conversion-master",
  href: "/design-concepts/conversion-master",
  name: "Conversion Master",
  phase: "2F-R3",
  active: true,
  thesis:
    "Warm Conversion Luxury homepage with shared lead planner, portfolio proof, scope brief, FAQ, and consultation conversion — local prototype only.",
} as const;

export interface ConceptDefinition {
  readonly id: ConceptId;
  readonly letter: "A" | "B" | "C";
  readonly slug: string;
  readonly href: string;
  readonly name: string;
  readonly thesis: string;
  readonly strengths: readonly string[];
  readonly tradeoffs: readonly string[];
  readonly motionRange: string;
  readonly previewAsset: {
    readonly path: string;
    readonly width: number;
    readonly height: number;
    readonly alt: string;
  };
}

export const CONCEPTS = [
  {
    id: "cinematic",
    letter: "A",
    slug: "cinematic-coffee-luxe",
    href: "/design-concepts/cinematic-coffee-luxe",
    name: "Cinematic Coffee Luxe",
    thesis:
      "A warm, cinematic interior brand. Deep coffee surfaces, full-bleed imagery, and restrained gold carry an emotionally rich sense of craft.",
    strengths: [
      "Strongest immediate warmth and atmosphere",
      "Hero reads as a single cinematic frame",
      "Material Story becomes the emotional high point",
    ],
    tradeoffs: [
      "Dark full-bleed imagery demands disciplined contrast work",
      "Slowest motion of the three, so it rewards patience over urgency",
      "Least amount of negative space for future content growth",
    ],
    motionRange: "600–900ms",
    previewAsset: {
      path: "/marketing/hero/homepage-hero-architectural.webp",
      width: 1920,
      height: 1280,
      alt: "Abstract architectural composition of layered travertine and limestone planes with slim bronze reveals and deep charcoal shadow",
    },
  },
  {
    id: "architectural",
    letter: "B",
    slug: "modern-architectural",
    href: "/design-concepts/modern-architectural",
    name: "Modern Architectural",
    thesis:
      "A structured, precise architecture-led brand. Split hero, framed imagery, generous negative space, and near-absent gold keep the focus on proportion.",
    strengths: [
      "Clearest information hierarchy and alignment",
      "Most negative space, so new sections drop in cleanly",
      "Lowest performance and contrast risk",
    ],
    tradeoffs: [
      "Least emotionally warm of the three",
      "Restraint can read as quiet if imagery is weak",
      "Fewest signature moments to remember the brand by",
    ],
    motionRange: "400–650ms",
    previewAsset: {
      path: "/marketing/materials/travertine-bronze-detail.webp",
      width: 1800,
      height: 1200,
      alt: "Abstract travertine surface with a slim bronze reveal and charcoal shadow",
    },
  },
  {
    id: "design-tech",
    letter: "C",
    slug: "luxury-design-tech",
    href: "/design-concepts/luxury-design-tech",
    name: "Luxury Design-Tech",
    thesis:
      "A premium design-led platform. Layered modular blocks, the richest Portfolio presentation, and a measured sage accent give the brand forward momentum.",
    strengths: [
      "Strongest Portfolio presentation of the three",
      "Most responsive interaction and focus feedback",
      "Modular blocks scale well to service and process pages",
    ],
    tradeoffs: [
      "Layered depth needs care to avoid a product-UI feel",
      "Highest number of interaction states to maintain",
      "Sage accent adds a fourth colour to govern",
    ],
    motionRange: "350–700ms",
    previewAsset: {
      path: "/marketing/services/modular-kitchens.webp",
      width: 1600,
      height: 1200,
      alt: "Abstract modular kitchen composition with stone work surface and aligned cabinetry planes",
    },
  },
] as const satisfies readonly ConceptDefinition[];

export function getConcept(id: ConceptId): ConceptDefinition {
  const concept = CONCEPTS.find((entry) => entry.id === id);
  if (!concept) {
    throw new Error(`Unknown design concept: ${id}`);
  }
  return concept;
}

export const CONCEPT_REVIEW_NOTICE =
  "Internal design review — not a public ONEDECORE page.";
