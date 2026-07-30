/**
 * Frozen C5B process content — owner-approved design-journey stages.
 * Calm editorial narrative only; not contractual milestones.
 * No CTA until Phase 2F-E ships /process.
 */
export const PROCESS_SECTION_COPY = {
  overline: "Our Process",
  heading: "A considered path from first conversation to final handover",
  introduction:
    "Four clear stages bring the wider interior vision and its details into one coordinated journey.",
} as const;

export type ProcessStepId = "discover" | "define" | "detail" | "deliver";

export interface ProcessStep {
  readonly id: ProcessStepId;
  readonly ordinal: "01" | "02" | "03" | "04";
  readonly title: string;
  readonly description: string;
}

export const PROCESS_STEPS = [
  {
    id: "discover",
    ordinal: "01",
    title: "Discover",
    description:
      "We begin by understanding the home, everyday requirements, priorities, and the direction you want the interiors to take.",
  },
  {
    id: "define",
    ordinal: "02",
    title: "Define",
    description:
      "Layouts, storage requirements, materials, and the overall design language are brought together into one clear direction.",
  },
  {
    id: "detail",
    ordinal: "03",
    title: "Detail",
    description:
      "Key interior elements are refined through proportion, finish, functionality, and considered material combinations.",
  },
  {
    id: "deliver",
    ordinal: "04",
    title: "Deliver",
    description:
      "The approved design is carried through execution, installation, final detailing, and handover as one coordinated interior journey.",
  },
] as const satisfies readonly ProcessStep[];
