import { HOME_CLAIMS } from "../home-r4/claims.ts";
import { PUBLIC_CONSULTATION_BY_SERVICE } from "../chrome/public-nav.ts";

export type DiscoveryAssetKey =
  | "hero"
  | "completeHomeInteriors"
  | "modularKitchens"
  | "customWardrobes"
  | "dusk"
  | "oakJoinery"
  | "flutedTexture"
  | "travertineBronze";

/**
 * The homepage narrative, in order.
 *
 * Each band answers the question the previous one raises:
 *
 *   proof           can they actually do this?
 *   why             what makes them different?
 *   manufacturing   what does "own factory" really mean?
 *   design-library  how much choice do I get?
 *   process         what happens after I enquire?
 *   real-homes      show me.
 *   quality         can I trust the execution?
 *   consultation    start.
 *   final-cta       one last, clear way in.
 *
 * `furniture` renders only when the Shop gate is live, which is why it is in
 * the list but not in the story above.
 */
export const DISCOVERY_SECTION_ORDER = [
  "header",
  "hero",
  "proof",
  "areas",
  "portfolio-categories",
  "why",
  "manufacturing",
  "design-library",
  "process",
  "real-homes",
  "quality",
  "furniture",
  "consultation",
  "final-cta",
  "footer",
] as const;

/** Major homepage bands before footer. Furniture renders only when Shop is live. */
export const DISCOVERY_MAJOR_SECTIONS = [
  "hero",
  "proof",
  "areas",
  "portfolio-categories",
  "why",
  "manufacturing",
  "design-library",
  "process",
  "real-homes",
  "quality",
  "furniture",
  "consultation",
  "final-cta",
] as const;

/**
 * The four figures directly below the hero.
 *
 * Each carries the claim id it is published under, so `DiscoveryProofStrip` can
 * ask the evidence register rather than trusting this list. All four are
 * OWNER-ATTESTED, not evidenced — see `PUBLIC_CLAIM_EVIDENCE`. Withdrawing an
 * attestation removes the metric from the strip without touching this file.
 */
export const DISCOVERY_PROOF_METRICS = [
  {
    claimId: "projects-delivered" as const,
    prefix: "",
    value: HOME_CLAIMS.projectsDelivered,
    suffix: "+",
    label: "Projects Delivered",
  },
  {
    /*
     * A warranty is a contractual promise, so `requiresEffectiveLegalTerms` is
     * true for this claim and `isClaimDisplayable` answers false while the
     * warranty terms are pending owner approval. It is listed here because the
     * owner asked for it; the strip will start rendering it the moment the terms
     * are approved, and until then it renders three metrics.
     */
    claimId: "warranty-years" as const,
    prefix: "Up to ",
    value: HOME_CLAIMS.warrantyYears,
    suffix: "+ Years",
    label: "Warranty",
    /*
     * "Up to" is a ceiling, and a ceiling without terms beside it reads as a
     * promise. This is the only metric that carries a link.
     */
    termsHref: "/warranty",
    termsLabel: "T&C apply",
  },
  {
    claimId: "design-inspirations" as const,
    prefix: "",
    value: HOME_CLAIMS.designInspirations,
    suffix: "+",
    label: "Designs to Choose From",
  },
  {
    claimId: "delivery-window" as const,
    prefix: "",
    value: HOME_CLAIMS.deliveryDays,
    suffix: " Days",
    label: "Delivery",
  },
] as const;

/*
 * Locations, not a claim. Hinjewadi and Koregaon Park are already published
 * across the site in HOME_PUNE_AREAS; the manufacturing line repeats what the
 * strip above states and the evidence register governs.
 */
export const DISCOVERY_PROOF_FOOTNOTE =
  "Hinjewadi · Koregaon Park · Own Manufacturing Unit";

/* -------------------------------------------------------------------------- */
/* Why ONEDECORE                                                              */
/* -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- */
/* Areas served                                                               */
/* -------------------------------------------------------------------------- */

export const DISCOVERY_AREAS_EYEBROW = "AREAS WE SERVE";
export const DISCOVERY_AREAS_HEADLINE =
  "Premium interiors across Pune's key neighbourhoods.";

/**
 * The twenty neighbourhoods, owner-supplied and in the owner's order.
 *
 * A place list, not a claim: naming where the studio works asserts nothing
 * measurable, so this needs no evidence gate. `HOME_PUNE_AREAS` remains the
 * broader locality list the rest of the site uses; this is the shorter,
 * deliberately ordered marketing set.
 */
export const DISCOVERY_AREAS_SERVED = [
  "Kharadi",
  "Koregaon Park",
  "Kalyani Nagar",
  "Viman Nagar",
  "Baner",
  "Balewadi",
  "Aundh",
  "Wakad",
  "Hinjawadi",
  "Hadapsar",
  "Magarpatta",
  "Kothrud",
  "Bavdhan",
  "Pashan",
  "Pimple Saudagar",
  "NIBM",
  "Undri",
  "Wagholi",
  "Kondhwa",
  "Shivajinagar",
] as const;

export const DISCOVERY_CATEGORIES_EYEBROW = "EXPLORE OUR WORK";
export const DISCOVERY_CATEGORIES_HEADLINE = "Start where your home needs it most.";

export const DISCOVERY_WHY_EYEBROW = "WHY ONEDECORE";
export const DISCOVERY_WHY_HEADLINE = [
  "Everything your interior needs.",
  "Under one roof.",
] as const;

export const DISCOVERY_WHY_POINTS = [
  {
    id: "direct",
    number: "01",
    title: "Direct From Manufacturer",
    body: "No unnecessary middle layers. Better control on finish, quality and value through direct manufacturing.",
  },
  {
    id: "factory",
    number: "02",
    title: "Own Modular Factory",
    body: "Precision machinery and controlled production for modular kitchens, wardrobes and complete-home interiors.",
  },
  {
    id: "consultation",
    number: "03",
    title: "Free Design Consultation",
    body: "Discuss your layout, style, storage needs and budget with our design team before you decide.",
  },
  {
    /*
     * The fourth card no longer repeats the design count. A metric already on
     * the proof strip, restated as a benefit, reads as padding — and it tied
     * this card's copy to a number that changes.
     */
    id: "customised",
    number: "04",
    title: "Customised For Your Home",
    body: "Every design is planned around your space, lifestyle and preferences rather than a standard catalogue fit.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Manufacturer advantage                                                     */
/* -------------------------------------------------------------------------- */

export const DISCOVERY_MANUFACTURING_EYEBROW = "BUILT DIFFERENTLY";
export const DISCOVERY_MANUFACTURING_HEADLINE = [
  "Designed by us.",
  "Manufactured by us.",
  "Installed by us.",
] as const;

export const DISCOVERY_MANUFACTURING_LEDE =
  "From design planning to modular manufacturing and final installation, ONEDECORE keeps greater control over the process. Our own manufacturing capability helps us deliver customised interiors with consistent finishes, better coordination and fewer unnecessary layers between design and execution.";

export const DISCOVERY_MANUFACTURING_POINTS = [
  {
    id: "precision",
    number: "01",
    title: "Factory-Made Precision",
    body: "Machine-finished modular components designed for consistency.",
  },
  {
    id: "dimensions",
    number: "02",
    title: "Custom-Built Dimensions",
    body: "Designed around your actual walls, storage needs and lifestyle.",
  },
  {
    id: "control",
    number: "03",
    title: "Better Execution Control",
    body: "Design, manufacturing and installation coordinated as one process.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Design library                                                             */
/* -------------------------------------------------------------------------- */

export const DISCOVERY_LIBRARY_EYEBROW = "DESIGN LIBRARY";
export const DISCOVERY_LIBRARY_HEADLINE = [
  "Start with inspiration.",
  "Finish with something completely yours.",
] as const;

/*
 * The figure is INTERPOLATED, not typed. Writing "500+" here would be a second
 * place the design count lives, and the two would drift the first time it
 * changed — which is exactly what happened when this section still said 800+
 * after the proof strip had moved on.
 */
export const DISCOVERY_LIBRARY_LEDE = `Choose from ${HOME_CLAIMS.designInspirations}+ interior ideas across kitchens, wardrobes, living rooms, bedrooms and complete-home themes. Mix finishes, layouts, colours and storage concepts to create a design that works for your home — not just the showroom.`;

/**
 * The library rail.
 *
 * `assetKey` names REAL ONEDECORE photography, and each category uses an image
 * that honestly depicts it. Bedrooms has no bedroom photograph in the asset
 * library, so it carries a material study rather than a room shot presented as
 * one — `depictsRoom: false` says so, and the card renders without a room
 * caption. Borrowing a kitchen photo to stand in for a bedroom would be exactly
 * the fabricated depiction the claim register exists to prevent.
 */
export const DISCOVERY_LIBRARY_CATEGORIES = [
  {
    id: "modular-kitchens",
    title: "Modular Kitchens",
    assetKey: "modularKitchens" as const satisfies DiscoveryAssetKey,
    depictsRoom: true,
    href: PUBLIC_CONSULTATION_BY_SERVICE["modular-kitchens"],
  },
  {
    id: "wardrobes",
    title: "Wardrobes",
    assetKey: "customWardrobes" as const satisfies DiscoveryAssetKey,
    depictsRoom: true,
    href: PUBLIC_CONSULTATION_BY_SERVICE["custom-wardrobes"],
  },
  {
    id: "living-rooms",
    title: "Living Rooms",
    // Not the hero image: reusing it here would make the page look like it owns
    // one photograph. This asset's own alt describes a living interior.
    assetKey: "completeHomeInteriors" as const satisfies DiscoveryAssetKey,
    depictsRoom: true,
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
  },
  {
    id: "bedrooms",
    title: "Bedrooms",
    assetKey: "oakJoinery" as const satisfies DiscoveryAssetKey,
    depictsRoom: false,
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
  },
  {
    id: "tv-units",
    title: "TV Units",
    assetKey: "flutedTexture" as const satisfies DiscoveryAssetKey,
    depictsRoom: false,
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
  },
  {
    id: "complete-homes",
    title: "Complete Homes",
    assetKey: "travertineBronze" as const satisfies DiscoveryAssetKey,
    depictsRoom: false,
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
  },
] as const;

/* -------------------------------------------------------------------------- */
/* How it works                                                               */
/* -------------------------------------------------------------------------- */

export const DISCOVERY_HOW_EYEBROW = "HOW IT WORKS";
export const DISCOVERY_HOW_HEADLINE = [
  "From first idea to finished home.",
  "One coordinated process.",
] as const;

export const DISCOVERY_HOW_STEPS = [
  {
    id: "tell",
    number: "01",
    title: "Tell us about your home",
    body: "Select your home type, approximate budget and Pune location.",
  },
  {
    id: "consult",
    number: "02",
    title: "Get your free design consultation",
    body: "Discuss layouts, storage, materials, finishes and ideas with our team.",
  },
  {
    id: "finalise",
    number: "03",
    title: "Finalise your design",
    body: "Choose the design direction, finishes and scope that work for you.",
  },
  {
    id: "execute",
    number: "04",
    title: "We manufacture & execute",
    body: "Your approved interiors move into production and coordinated installation.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Quality / trust                                                            */
/* -------------------------------------------------------------------------- */

export const DISCOVERY_QUALITY_EYEBROW = "QUALITY YOU CAN SEE";
export const DISCOVERY_QUALITY_HEADLINE = [
  "Factory precision.",
  "Designer detailing.",
  "Site-ready execution.",
] as const;

export const DISCOVERY_QUALITY_LEDE =
  "Good interiors are not only about how they look on day one. They depend on accurate planning, controlled manufacturing, material choices and coordinated installation.";

/*
 * Process statements, not credentials. There is no rating, award, certificate
 * or warranty period here — none of those is evidenced, and the trust this
 * section builds has to come from describing how the work is done.
 */
export const DISCOVERY_QUALITY_PRINCIPLES = [
  {
    id: "precision",
    title: "Precision Manufacturing",
    body: "Consistent modular production through controlled factory processes.",
  },
  {
    id: "planning",
    title: "Design-Led Planning",
    body: "Layouts shaped around storage, movement and everyday use.",
  },
  {
    id: "materials",
    title: "Material & Finish Control",
    body: "Selections coordinated with the approved design direction.",
  },
  {
    id: "installation",
    title: "Coordinated Installation",
    body: "A structured path from production to on-site completion.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Consultation + closing CTA                                                 */
/* -------------------------------------------------------------------------- */

export const DISCOVERY_CONSULT_EYEBROW = "START YOUR INTERIOR JOURNEY";
export const DISCOVERY_CONSULT_HEADLINE = "Tell us what you're planning.";
export const DISCOVERY_CONSULT_LEDE =
  "Share a few details about your home and budget. Our design team will help you understand the right possibilities for your space.";

export const DISCOVERY_FINAL_CTA_EYEBROW = "READY TO START?";
export const DISCOVERY_FINAL_CTA_HEADLINE =
  "Your home deserves more than a catalogue interior.";
export const DISCOVERY_FINAL_CTA_LEDE =
  "Start with a free design consultation or explore real ONEDECORE spaces before you decide.";

/*
 * Three words each, no icons. The row is a reminder of what was argued above,
 * not a second attempt at arguing it — and the design count is interpolated so
 * it cannot drift from the proof strip.
 */
export const DISCOVERY_FINAL_CTA_PROOF = [
  "Direct Manufacturing",
  `${HOME_CLAIMS.designInspirations}+ Designs`,
  "Pune Execution",
] as const;

export const DISCOVERY_PROCESS_STEPS = ["Consult", "Design", "Manufacture", "Install"] as const;

export const DISCOVERY_FURNITURE_PROCESS_STEPS = [
  "Browse",
  "Explore Details",
  "Check Serviceability",
] as const;

/**
 * Hero slides carry NO call to action.
 *
 * The hero's job is brand and service storytelling; the persistent sticky
 * dock is the page's one conversion action. Two more buttons per slide only
 * competed with it, and on mobile they cost a large share of the first screen.
 */
/**
 * The page's H1, rendered visually hidden above the image-only hero.
 *
 * The banner carries no text, so the page identity has to live somewhere a
 * screen reader and a crawler can both find it.
 */
export const DISCOVERY_HERO_PAGE_TITLE =
  "ONEDECORE — complete home interiors, modular kitchens and wardrobes in Pune";

export const DISCOVERY_HERO_SLIDES = [
  {
    id: "complete-home",
    kicker: "Premium interiors for Pune homes",
    headline: "Complete home interiors, designed around you.",
    lede:
      "From concept and modular manufacturing to installation, ONEDECORE brings your home together through one coordinated team.",
    assetKey: "hero" as const satisfies DiscoveryAssetKey,
    badge: null,
  },
  {
    id: "kitchen-wardrobe",
    kicker: "Modular Kitchens · Custom Wardrobes",
    headline: "Made to fit your space. Built to last.",
    lede:
      "Precision-made modular kitchens and custom wardrobes designed for your layout, storage needs and finish preferences.",
    assetKey: "modularKitchens" as const satisfies DiscoveryAssetKey,
    badge: null,
  },
  {
    id: "furniture-ecosystem",
    kicker: "Complete-home ecosystem",
    headline: "A complete-home experience, under one design language.",
    lede:
      "ONEDECORE is expanding from interiors into coordinated furniture and décor — so every room can share the same considered direction.",
    assetKey: "completeHomeInteriors" as const satisfies DiscoveryAssetKey,
    badge: "Furniture & Décor — coming soon",
  },
] as const;

export const DISCOVERY_CATEGORY_TILES = [
  {
    id: "complete-home" as const,
    title: "Complete Home Interiors",
    lede: "One coordinated design language across your entire home.",
    cta: "Plan My Home",
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
    assetKey: "completeHomeInteriors" as const satisfies DiscoveryAssetKey,
    featured: false,
    comingSoon: false,
  },
  {
    id: "modular-kitchen" as const,
    title: "Modular Kitchens",
    lede: "Precision-made kitchens designed for workflow, storage and finish.",
    cta: "Plan My Kitchen",
    href: PUBLIC_CONSULTATION_BY_SERVICE["modular-kitchens"],
    assetKey: "modularKitchens" as const satisfies DiscoveryAssetKey,
    featured: true,
    comingSoon: false,
  },
  {
    id: "wardrobes" as const,
    title: "Custom Wardrobes",
    lede: "Made-to-fit storage planned around your room and daily routine.",
    cta: "Plan My Wardrobe",
    href: PUBLIC_CONSULTATION_BY_SERVICE["custom-wardrobes"],
    assetKey: "customWardrobes" as const satisfies DiscoveryAssetKey,
    featured: false,
    comingSoon: false,
  },
  {
    id: "furniture-decor" as const,
    title: "Furniture & Décor",
    lede: "Coordinated furniture and décor under one ONEDECORE design language.",
    cta: "Plan My Home",
    href: PUBLIC_CONSULTATION_BY_SERVICE["complete-home-interiors"],
    assetKey: "dusk" as const satisfies DiscoveryAssetKey,
    featured: false,
    comingSoon: true,
    badge: "Coming soon",
  },
] as const;

export const DISCOVERY_SERVICE_CARDS = DISCOVERY_CATEGORY_TILES.filter((tile) => !tile.comingSoon).map(
  (tile) => ({
    id: tile.id,
    title: tile.title,
    lede: tile.lede,
    points: [] as const,
    href: tile.href,
    cta: tile.cta,
    assetKey: tile.assetKey,
  })
);

/** @deprecated Use DISCOVERY_CATEGORY_TILES — kept for transitional test references. */
export const DISCOVERY_SERVICE_SECTIONS = DISCOVERY_CATEGORY_TILES.filter((t) => !t.comingSoon).map(
  (card) => ({
    id: card.id,
    title: card.title,
    href: card.href,
    kicker:
      card.id === "complete-home"
        ? "Complete home"
        : card.id === "modular-kitchen"
          ? "Kitchen"
          : "Wardrobes",
    lede: card.lede,
    points: [] as const,
  })
);

export const DISCOVERY_TRUST_LABELS = [
  "End-to-End Interiors",
  "In-House Manufacturing",
  "Custom Furniture",
  "Quality Control",
  "After-Sales Support",
] as const;
