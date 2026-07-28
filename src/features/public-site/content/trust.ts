/**
 * Frozen C5B trust pillars — owner-approved design-philosophy statements.
 * Not performance guarantees. No statistics, testimonials, or awards.
 */
export const TRUST_SECTION_COPY = {
  overline: "Why ONEDECORE",
  heading: "One vision carried through every detail",
  introduction:
    "Our approach keeps spatial decisions, materials, storage, and transitions connected to the wider interior direction.",
} as const;

export type TrustPillarId =
  | "coherent-direction"
  | "clarity-in-decisions"
  | "details-as-whole";

export interface TrustPillar {
  readonly id: TrustPillarId;
  readonly ordinal: "01" | "02" | "03";
  readonly title: string;
  readonly body: string;
}

export const TRUST_PILLARS = [
  {
    id: "coherent-direction",
    ordinal: "01",
    title: "One coherent design direction",
    body: "Every element is considered as part of the wider interior vision.",
  },
  {
    id: "clarity-in-decisions",
    ordinal: "02",
    title: "Clarity in every decision",
    body: "Layouts, materials, and details are developed through a clear and considered design direction.",
  },
  {
    id: "details-as-whole",
    ordinal: "03",
    title: "Details considered as part of the whole",
    body: "Storage, finishes, proportions, and transitions are resolved together rather than in isolation.",
  },
] as const satisfies readonly TrustPillar[];
