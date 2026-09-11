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
 * THE SIX SLOTS ARE THE RAIL, ARTWORK OR NOT
 *
 * `enabled` is what decides whether a slot is on the page. A slot that is on
 * but has no `image` yet renders as an empty frame with a small `Banner N`
 * label — a real 5:8 card in the real rail, just without its picture.
 *
 * This is a deliberate, owner-held decision and it has been taken twice, in
 * both directions, so it is worth writing down rather than rediscovering.
 *
 * A previous pass made artwork the gate: no `image`, no card, and with all six
 * empty the section vanished. That is the right behaviour for a rail whose
 * campaigns come and go — a half-built promotion should never reach a
 * visitor — but it is the wrong behaviour for THIS moment. The six-slot
 * slider is itself the thing being reviewed and signed off, and a section that
 * renders nothing cannot be reviewed. So the empty frames are back.
 *
 * What that costs, stated plainly: while the slots are empty, a visitor sees
 * six labelled placeholders. They are not mistakes and they are not stock
 * photography — they are the frames the artwork will land in — but they are
 * unfinished, and they are visible. Filling the slots is what closes that.
 *
 * ADDING A CAMPAIGN
 *
 *   { id: "promo-1", enabled: true, image: "/assets/.../banner-1.webp",
 *     imageAlt: "…" }
 *
 * and optionally an `href` to make the whole card a link. The card swaps its
 * empty frame for the picture; nothing else changes. To take a slot off the
 * rail entirely, set `enabled: false`.
 */
export interface InteriorsPromoSlide {
  readonly id: string;
  readonly enabled: boolean;
  /**
   * The 5:8 artwork. Absent means the slot renders as an empty frame.
   *
   * One path, not two: the same file is used at every breakpoint. Whether a
   * value counts as artwork is `hasInteriorsPromoCreative`, not a bare
   * truthiness check.
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
  /**
   * Set only on slides that came from the Website Manager.
   *
   * `consultation` is a link type with no href: the card opens the canonical
   * lead form in place rather than navigating. `href` stays null for it, which
   * is what keeps the `<Link>` branch from firing.
   */
  readonly linkType?: "none" | "internal" | "external" | "consultation";
  readonly newTab?: boolean;
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

/** Label prefix for a slot that has no artwork yet: `Banner 1`…`Banner 6`. */
export const INTERIORS_PROMO_PLACEHOLDER_PREFIX = "Banner";

/**
 * The six slots. All on, none filled yet.
 *
 * `enabled` and artwork are two different switches on purpose. `enabled: false`
 * takes a slot off the rail completely — a campaign that has ended, kept in
 * place so it can be turned back on. A missing `image` leaves the slot on the
 * rail as an empty frame. Only the first removes a card.
 */
export const INTERIORS_PROMO_SLIDES: readonly InteriorsPromoSlide[] = [
  { id: "promo-1", enabled: true },
  { id: "promo-2", enabled: true },
  { id: "promo-3", enabled: true },
  { id: "promo-4", enabled: true },
  { id: "promo-5", enabled: true },
  { id: "promo-6", enabled: true },
];

/**
 * Does this slot have a picture, or does it render as an empty frame?
 *
 * This decides the CARD's contents, not whether the card exists. The
 * blank-string check is not defensive padding: `image: ""` is what a cleared
 * config field or a half-finished edit looks like, and it is the one value
 * that reads as "no artwork" to a person and as a usable src to
 * `<Image>`, which would issue a broken request instead of rendering nothing.
 * One predicate, so "has a creative" has a single definition.
 */
export function hasInteriorsPromoCreative(slide: InteriorsPromoSlide): boolean {
  return typeof slide.image === "string" && slide.image.trim().length > 0;
}

/**
 * The slides on the rail. Order is the array order.
 *
 * Artwork is deliberately NOT part of this filter — see the note at the top of
 * the file. An empty result (every slot disabled) still renders nothing at
 * all, which is the guard that keeps a zero-card rail off the page.
 */
export function getEnabledInteriorsPromoSlides(
  slides: readonly InteriorsPromoSlide[] = INTERIORS_PROMO_SLIDES
): readonly InteriorsPromoSlide[] {
  return slides.filter((slide) => slide.enabled);
}
