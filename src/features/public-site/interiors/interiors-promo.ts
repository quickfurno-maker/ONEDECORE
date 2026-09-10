import { PM_ASSETS, PM_SECTION_IDS } from "@/features/public-site/home-r4/content";

/**
 * The /interiors promotional carousel, as data.
 *
 * REPLACING A CAMPAIGN IS A CONFIG EDIT
 *
 * Everything a campaign consists of — both artwork sources, the copy, the CTA,
 * where it goes, and whether it runs at all — lives in one record below.
 * `InteriorsPromoCarousel` reads this list and knows nothing else about any
 * particular campaign, so swapping the festive banner for the monsoon one is a
 * change to six lines of data, not a new component.
 *
 * There is deliberately no database, no CMS and no upload flow here. Those are
 * a decision the owner has not made yet, and building the storage before the
 * decision would prejudge it.
 *
 * TWO SOURCES PER SLIDE, NOT ONE ASSET STRETCHED
 *
 * `mobileImage` fills a 9:16 card; `desktopImage` fills a ~12:5 banner. They
 * are different files, chosen per breakpoint by a real `<picture>` source —
 * not one file cropped two ways by CSS. A tall banner squeezed into a wide
 * frame looks exactly like what it is.
 *
 * THE ARTWORK BELOW IS PLACEHOLDER, AND SAYS SO
 *
 * No dedicated promotional artwork exists yet, so these slots borrow the
 * marketing photography already in the repository. None of it is authored at
 * 9:16 or 12:5 — the frames are, and `object-fit: cover` plus a per-slide
 * focal point holds each image honestly inside them until real creative
 * arrives. Because only nine images exist for twelve slots, three are used
 * twice; no slide ever uses the same file for both of its own sources.
 *
 * WHAT IS NOT HERE
 *
 * No discount, no percentage off, no expiry, no coupon, no EMI, no delivery
 * promise, no rating, no award, no price, and no project count. The owner has
 * published no offer, so a banner announcing one would be inventing it. Every
 * line below is a service ONEDECORE actually performs, phrased the way the
 * rest of the site already phrases it.
 */
export interface InteriorsPromoImage {
  /** Public path of the asset. */
  readonly src: string;
  /** Intrinsic size, so the browser can reserve space and avoid layout shift. */
  readonly width: number;
  readonly height: number;
  /** `object-position` inside the card frame. */
  readonly focalPoint: string;
}

export interface InteriorsPromoSlide {
  readonly id: string;
  readonly enabled: boolean;
  /** Fills the 9:16 card. */
  readonly mobileImage: InteriorsPromoImage;
  /** Fills the ~12:5 banner. */
  readonly desktopImage: InteriorsPromoImage;
  readonly eyebrow?: string;
  readonly title: string;
  readonly body?: string;
  readonly ctaLabel?: string;
  /** An anchor on this page or an existing route. Never an invented one. */
  readonly href?: string;
  /**
   * What the photograph shows.
   *
   * Empty only where the copy already says everything the image contributes —
   * a texture behind a headline adds mood, not information, and announcing it
   * to a screen reader is noise. Where the image IS the message, it is
   * described.
   */
  readonly imageAlt: string;
}

/** The 9:16 mobile card and ~12:5 desktop banner the artwork is authored for. */
export const INTERIORS_PROMO_MOBILE_RATIO = "9 / 16" as const;
export const INTERIORS_PROMO_DESKTOP_RATIO = "12 / 5" as const;

/** Autoplay dwell. Long enough to read a two-line banner without hurrying. */
export const INTERIORS_PROMO_AUTOPLAY_MS = 5500;

export const INTERIORS_PROMO_SLIDES: readonly InteriorsPromoSlide[] = [
  {
    id: "complete-home-interiors",
    enabled: true,
    mobileImage: {
      src: PM_ASSETS.completeHomeInteriors.path,
      width: PM_ASSETS.completeHomeInteriors.width,
      height: PM_ASSETS.completeHomeInteriors.height,
      focalPoint: "50% 40%",
    },
    /*
     * Deliberately NOT `PM_ASSETS.hero`. That is the photograph the hero
     * itself uses, and at desktop the banner sits directly above it — the same
     * room twice on one screen reads as a rendering fault.
     */
    desktopImage: {
      src: PM_ASSETS.dusk.path,
      width: PM_ASSETS.dusk.width,
      height: PM_ASSETS.dusk.height,
      focalPoint: "58% 52%",
    },
    eyebrow: "Complete Home Interiors",
    title: "Your whole home, handled by one team.",
    body: "Design, manufacturing, installation and handover — coordinated end to end.",
    ctaLabel: "See what's included",
    href: `#${PM_SECTION_IDS.services}`,
    imageAlt: PM_ASSETS.completeHomeInteriors.alt,
  },
  {
    id: "modular-kitchens",
    enabled: true,
    mobileImage: {
      src: PM_ASSETS.modularKitchens.path,
      width: PM_ASSETS.modularKitchens.width,
      height: PM_ASSETS.modularKitchens.height,
      focalPoint: "50% 44%",
    },
    desktopImage: {
      src: PM_ASSETS.materialTexture.path,
      width: PM_ASSETS.materialTexture.width,
      height: PM_ASSETS.materialTexture.height,
      focalPoint: "50% 50%",
    },
    eyebrow: "Modular Kitchens",
    title: "Kitchens built around how you cook.",
    body: "Planned for your layout, storage and daily routine — then made in our own factory.",
    ctaLabel: "Explore kitchens",
    href: "#modular-kitchen",
    imageAlt: PM_ASSETS.modularKitchens.alt,
  },
  {
    id: "custom-wardrobes",
    enabled: true,
    mobileImage: {
      src: PM_ASSETS.customWardrobes.path,
      width: PM_ASSETS.customWardrobes.width,
      height: PM_ASSETS.customWardrobes.height,
      focalPoint: "50% 38%",
    },
    desktopImage: {
      src: PM_ASSETS.materialTimber.path,
      width: PM_ASSETS.materialTimber.width,
      height: PM_ASSETS.materialTimber.height,
      focalPoint: "50% 50%",
    },
    eyebrow: "Custom Wardrobes",
    title: "Wardrobes measured to the wall you have.",
    body: "Floor-to-ceiling storage planned around the space, not a standard carcass.",
    ctaLabel: "Explore wardrobes",
    href: "#od-int-wardrobe-title",
    imageAlt: PM_ASSETS.customWardrobes.alt,
  },
  {
    id: "own-manufacturing",
    enabled: true,
    mobileImage: {
      src: PM_ASSETS.materialTimber.path,
      width: PM_ASSETS.materialTimber.width,
      height: PM_ASSETS.materialTimber.height,
      focalPoint: "50% 50%",
    },
    desktopImage: {
      src: PM_ASSETS.materialStone.path,
      width: PM_ASSETS.materialStone.width,
      height: PM_ASSETS.materialStone.height,
      focalPoint: "44% 50%",
    },
    eyebrow: "Own Manufacturing",
    title: "Made by us, not sourced for you.",
    body: "Our own modular factory means direct control over finish, quality and timeline.",
    ctaLabel: "Inside the factory",
    href: `#${PM_SECTION_IDS.factory}`,
    /*
     * A material close-up is exactly what this is, and the alt says so. Calling
     * it "our factory" would be describing a photograph nobody has taken.
     */
    imageAlt: PM_ASSETS.materialTimber.alt,
  },
  {
    id: "design-consultation",
    enabled: true,
    mobileImage: {
      src: PM_ASSETS.heroConsultant.path,
      width: PM_ASSETS.heroConsultant.width,
      height: PM_ASSETS.heroConsultant.height,
      focalPoint: "50% 24%",
    },
    desktopImage: {
      src: PM_ASSETS.hero.path,
      width: PM_ASSETS.hero.width,
      height: PM_ASSETS.hero.height,
      focalPoint: "52% 46%",
    },
    eyebrow: "Design Consultation",
    title: "Start with a conversation, not a contract.",
    body: "Talk through layout, style, storage and budget with our design team first.",
    ctaLabel: "Book a free consultation",
    href: `#${PM_SECTION_IDS.plan}`,
    imageAlt: PM_ASSETS.heroConsultant.alt,
  },
  {
    id: "portfolio-inspiration",
    enabled: true,
    mobileImage: {
      src: PM_ASSETS.hero.path,
      width: PM_ASSETS.hero.width,
      height: PM_ASSETS.hero.height,
      focalPoint: "52% 44%",
    },
    desktopImage: {
      src: PM_ASSETS.materialStone.path,
      width: PM_ASSETS.materialStone.width,
      height: PM_ASSETS.materialStone.height,
      focalPoint: "42% 48%",
    },
    eyebrow: "Interior Inspiration",
    title: "See the finish before you commit.",
    body: "Rooms, materials and detailing from the work we publish.",
    ctaLabel: "View portfolio",
    href: "/portfolio",
    imageAlt: PM_ASSETS.hero.alt,
  },
];

/** The slides that actually run. Order is the array order. */
export function getEnabledInteriorsPromoSlides(
  slides: readonly InteriorsPromoSlide[] = INTERIORS_PROMO_SLIDES
): readonly InteriorsPromoSlide[] {
  return slides.filter((slide) => slide.enabled);
}
