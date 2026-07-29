/**
 * Owner-approved commercial claims — single source of truth for R5.3.
 * Visible UI must derive from this config. No contradictory hardcoding.
 * No JSON-LD aggregateRating/Review/Warranty until evidence URLs exist.
 */
export const HOME_CLAIMS = {
  projectsDelivered: 500,
  rating: 4.9,
  reviews: 200,
  warrantyYears: 10,
  clientSatisfactionPercent: 98,
  customDesignPercent: 100,
  ownsManufacturingUnit: true,
  freeDesignConsultation: true,
} as const;

export const HOME_CLAIM_COPY = {
  projectsDelivered: `${HOME_CLAIMS.projectsDelivered}+ Projects Delivered`,
  rating: `${HOME_CLAIMS.rating}/5 Average Rating`,
  reviews: `${HOME_CLAIMS.reviews}+ Client Reviews`,
  warranty: `${HOME_CLAIMS.warrantyYears}-Year Warranty`,
  satisfaction: `${HOME_CLAIMS.clientSatisfactionPercent}% Client Satisfaction`,
  customDesigns: `${HOME_CLAIMS.customDesignPercent}% Custom Designs`,
  manufacturing: "Own Manufacturing Unit",
  freeConsultation: "Free Design Consultation",
} as const;

export const HOME_PUNE_AREAS = [
  "Kharadi",
  "Viman Nagar",
  "Baner",
  "Wakad",
  "Hinjewadi",
  "Hadapsar",
  "Koregaon Park",
  "Aundh",
  "Magarpatta",
  "Kalyani Nagar",
  "Pimple Saudagar",
  "Balewadi",
  "Undri",
  "NIBM",
  "Kothrud",
  "Wagholi",
  "Kondhwa",
  "Sus Road",
  "Pashan",
  "Wanowrie",
  "Vishrantwadi",
  "Dhanori",
  "Ambegaon",
  "Punawale",
  "Ravet",
  "Tathawade",
] as const;

export type HomePuneArea = (typeof HOME_PUNE_AREAS)[number];
