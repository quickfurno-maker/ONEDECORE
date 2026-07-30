/**
 * Frozen C4 static service stories — neutral production copy only.
 * Future route identifiers are typed for Phase 2F-D activation; C4 production
 * does not render them as active links.
 */
export const SERVICES_SECTION_COPY = {
  overline: "Our Services",
  heading: "Interiors, considered as one complete vision",
  introduction:
    "Three focused services come together to shape a coherent interior journey—from the wider home to the details that organise everyday life.",
} as const;

export type ServiceEditorialImagePosition = "left" | "right";

export type ServiceFutureRoute =
  | "/services/complete-home-interiors"
  | "/services/modular-kitchens"
  | "/services/custom-wardrobes";

export type ServiceStoryId =
  | "complete-home-interiors"
  | "modular-kitchens"
  | "custom-wardrobes";

export interface ServiceStory {
  readonly id: ServiceStoryId;
  readonly ordinal: "01" | "02" | "03";
  readonly title: string;
  readonly description: string;
  readonly futureHref: ServiceFutureRoute;
  readonly imagePosition: ServiceEditorialImagePosition;
  readonly assetId: ServiceStoryId;
}

export const SERVICE_STORIES = [
  {
    id: "complete-home-interiors",
    ordinal: "01",
    title: "Complete Home Interiors",
    description:
      "A coordinated interior journey that brings space planning, finishes, storage, and installation into one considered vision.",
    futureHref: "/services/complete-home-interiors",
    imagePosition: "left",
    assetId: "complete-home-interiors",
  },
  {
    id: "modular-kitchens",
    ordinal: "02",
    title: "Modular Kitchens",
    description:
      "Thoughtfully planned kitchen systems shaped around everyday movement, practical storage, and a calm material palette.",
    futureHref: "/services/modular-kitchens",
    imagePosition: "right",
    assetId: "modular-kitchens",
  },
  {
    id: "custom-wardrobes",
    ordinal: "03",
    title: "Custom Wardrobes",
    description:
      "Made-to-fit wardrobe compositions that balance organised storage, architectural proportion, and refined material detail.",
    futureHref: "/services/custom-wardrobes",
    imagePosition: "left",
    assetId: "custom-wardrobes",
  },
] as const satisfies readonly ServiceStory[];
