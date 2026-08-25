export const DISCOVERY_SECTION_ORDER = [
  "header",
  "hero",
  "complete-home",
  "modular-kitchen",
  "wardrobes",
  "why",
  "real-homes",
  "furniture",
  "consultation",
  "footer",
] as const;

/** Major homepage bands before footer. Furniture renders only when Shop is live. */
export const DISCOVERY_MAJOR_SECTIONS = [
  "hero",
  "complete-home",
  "modular-kitchen",
  "wardrobes",
  "why",
  "real-homes",
  "furniture",
  "consultation",
] as const;

export const DISCOVERY_TRUST_LABELS = [
  "End-to-End Interiors",
  "In-House Manufacturing",
  "Custom Furniture",
  "Quality Control",
  "After-Sales Support",
] as const;

export const DISCOVERY_PROCESS_STEPS = ["Consult", "Design", "Manufacture", "Install"] as const;

export const DISCOVERY_FURNITURE_PROCESS_STEPS = [
  "Browse",
  "Explore Details",
  "Check Serviceability",
] as const;

export const DISCOVERY_SERVICE_SECTIONS = [
  {
    id: "complete-home" as const,
    title: "Complete Home Interiors",
    href: "/?service=complete-home-interiors#consultation",
    kicker: "Complete home",
    lede: "Layouts, materials and finishes planned as one home — not room-by-room purchases.",
    points: [
      "Whole-home design language across living, dining and bedrooms",
      "Coordinated materials, lighting and storage",
      "Design, manufacturing and installation under one team",
    ] as const,
  },
  {
    id: "modular-kitchen" as const,
    title: "Modular Kitchen",
    href: "/?service=modular-kitchens#consultation",
    kicker: "Kitchen",
    lede: "Premium modular kitchens planned around workflow, storage and finish quality.",
    points: [
      "Ergonomic layouts and durable cabinetry",
      "Material and hardware options you can live with",
      "Made and installed with ONEDECORE quality control",
    ] as const,
  },
  {
    id: "wardrobes" as const,
    title: "Custom Wardrobes",
    href: "/?service=custom-wardrobes#consultation",
    kicker: "Wardrobes",
    lede: "Made-to-fit wardrobes and storage planned around your room and routine.",
    points: [
      "Custom proportions for Indian bedrooms and apartments",
      "Internal organisation for clothing and accessories",
      "Warm finishes that match the wider home",
    ] as const,
  },
] as const;
