/**
 * The /interiors promotional rail, as data.
 *
 * ONE ARTWORK FILE PER CAMPAIGN
 *
 * Every banner is 5:8, on every device. The rail does not switch artwork at a
 * breakpoint — it changes how many cards fit. A phone shows one dominant card
 * with the next peeking; a desktop shows three or four of the same cards side
 * by side. That means a campaign is one file to design, one file to upload and
 * one line to change, instead of a portrait and a landscape cut that have to
 * be kept in step and re-exported together every time the copy moves.
 *
 * It also removes the failure mode of the previous model: a desktop banner
 * that was authored 12:5 and a mobile banner authored portrait could drift into
 * saying different things, and nobody would notice until someone opened the
 * site on the other device.
 *
 * THE SLOTS ARE EMPTY ON PURPOSE
 *
 * No `image` and no `href` on any of the six. The owner is designing the real
 * artwork, and this build exists to settle geometry — card size, ratio, gap,
 * radius, how many are visible, how the rail moves. Filling the slots with
 * borrowed photography would decide the composition before the artwork that
 * has to live in it exists, and every judgement made against it would be a
 * judgement about the wrong picture.
 *
 * So each slot renders an empty frame with a small `Banner N` label. It is a
 * frame preview, not an uploader and not a mockup.
 *
 * ADDING A CAMPAIGN LATER
 *
 *   { id: "diwali-2026", enabled: true, image: "/assets/.../banner-1.webp" }
 *
 * and optionally an `href` to make the whole card a link. That is the entire
 * change — the carousel needs no edit at all.
 */
export interface InteriorsPromoSlide {
  readonly id: string;
  readonly enabled: boolean;
  /**
   * The 5:8 artwork. Absent means the slot renders as an empty frame.
   *
   * One path, not two: the same file is used at every breakpoint.
   */
  readonly image?: string | null;
  /**
   * Optional destination for the WHOLE card.
   *
   * There is no button inside a banner and there will not be one. If a
   * campaign needs a call to action, it is drawn into the artwork, and this
   * href makes the card itself the link — one target, no HTML control
   * competing with a painted one, and nothing for a screen reader to announce
   * twice. Absent means the card is not interactive at all.
   */
  readonly href?: string | null;
  /**
   * Describes the artwork, once there is artwork to describe.
   *
   * Required alongside `image`: a linked banner whose whole content is a
   * picture is unusable without it. Meaningless while the slots are empty.
   */
  readonly imageAlt?: string | null;
}

/**
 * The single authored artwork format. Recommended export: 1080 × 1728.
 *
 * 5:8, not 9:16. A 9:16 card is the shape of a phone screen, and a rail built
 * from it read as a story viewer however much width came off it — the banner
 * filled the fold and the page underneath was always a scroll away. 5:8 is a
 * promotional card: still clearly portrait, but something you glance along.
 *
 * Any exact 5:8 export works; 1080 × 1728 is the size to ask a designer for.
 */
export const INTERIORS_PROMO_RATIO = "5 / 8" as const;

/** Autoplay dwell. Long enough to read a banner without hurrying. */
export const INTERIORS_PROMO_AUTOPLAY_MS = 5500;

/** Review-only label prefix; deleted with the empty-frame branch. */
export const INTERIORS_PROMO_PLACEHOLDER_PREFIX = "Banner";

export const INTERIORS_PROMO_SLIDES: readonly InteriorsPromoSlide[] = [
  { id: "promo-1", enabled: true },
  { id: "promo-2", enabled: true },
  { id: "promo-3", enabled: true },
  { id: "promo-4", enabled: true },
  { id: "promo-5", enabled: true },
  { id: "promo-6", enabled: true },
];

/** The slides that actually run. Order is the array order. */
export function getEnabledInteriorsPromoSlides(
  slides: readonly InteriorsPromoSlide[] = INTERIORS_PROMO_SLIDES
): readonly InteriorsPromoSlide[] {
  return slides.filter((slide) => slide.enabled);
}
