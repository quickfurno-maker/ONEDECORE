"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from "react";
import {
  getEnabledInteriorsPromoSlides,
  INTERIORS_PROMO_AUTOPLAY_MS,
  INTERIORS_PROMO_PLACEHOLDER_PREFIX,
  type InteriorsPromoSlide,
} from "./interiors-promo";

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    () => false
  );
}

/** Treat sub-pixel scroll remainders as "already there". */
const SCROLL_EPSILON = 2;

/**
 * The promotional rail above the Interiors hero.
 *
 * ONE COMPONENT, TWO SHAPES, NO BREAKPOINT LOGIC IN JS
 *
 * A phone shows one 9:16 card with the next peeking; a desktop shows three or
 * four of the same cards. Nothing here knows which — the card width is a CSS
 * clamp, and everything below measures the rail rather than assuming a layout.
 * That is why the step logic works identically at 360px and 1920px: "advance
 * one card" is the same instruction whether one card or four are on screen.
 *
 * IT STEPS ONE CARD, NEVER ONE PAGE
 *
 * The obvious implementation of "next" on a multi-card rail is to scroll by
 * `clientWidth`, which jumps three or four banners at once and skips whatever
 * the visitor was reading. Every movement here — arrow, dot, autoplay, keyboard
 * — resolves to a card index and scrolls that card's left edge to the start of
 * the rail.
 *
 * WHERE THE RAIL ENDS
 *
 * With four cards visible, card 6 can never sit at the start: the rail runs out
 * of scrollable width three cards earlier. So the last reachable position is
 * measured, not assumed, and "next" from there loops to the beginning. The
 * surplus dots — the ones that could only ever clamp to the same position —
 * are hidden once that measurement exists, because a control that cannot change
 * anything should not be offered.
 *
 * THE RAIL SCROLLS, THE DOCUMENT DOES NOT
 *
 * Overflow belongs to `.od-int-promo__rail`. The section clips, so six cards
 * and their peek can never widen the page.
 *
 * NOTHING IS ANNOUNCED ON A TIMER
 *
 * The rail is not a live region. A carousel that interrupts a screen reader
 * every five seconds is unusable; the cards are all in the DOM and reachable,
 * and a visitor moves through them when they choose to.
 */
export function InteriorsPromoCarousel() {
  const slides = getEnabledInteriorsPromoSlides();
  const railRef = useRef<HTMLUListElement | null>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(0);
  /*
   * Starts at the last slide so the server renders every dot, then narrows to
   * what the measured rail can actually reach.
   */
  const [maxIndex, setMaxIndex] = useState(slides.length - 1);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pointerDown, setPointerDown] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const labelId = useId();

  const slideCount = slides.length;
  const paused = reducedMotion || hovered || focusWithin || pointerDown;

  /** Card left edges relative to the rail's own scroll origin. */
  const readOffsets = useCallback((rail: HTMLUListElement) => {
    return Array.from(rail.children).map(
      (child) => (child as HTMLElement).offsetLeft - rail.offsetLeft
    );
  }, []);

  /**
   * Scroll card `index` to the start of the rail.
   *
   * `scrollTo`, not `scrollIntoView`: the latter also scrolls the PAGE to bring
   * the rail into view, which would drag a visitor reading the hero back up to
   * a banner they did not ask for.
   */
  const goTo = useCallback(
    (index: number) => {
      const rail = railRef.current;
      if (!rail || slideCount === 0) return;
      const wrapped = ((index % slideCount) + slideCount) % slideCount;
      const offsets = readOffsets(rail);
      const target = offsets[wrapped];
      if (target === undefined) return;
      rail.scrollTo({
        left: target,
        behavior: reducedMotion ? "auto" : "smooth",
      });
    },
    [readOffsets, reducedMotion, slideCount]
  );

  /**
   * One card forward, looping once the rail can go no further.
   *
   * The loop point is `maxIndex`, not the raw scroll end. Those are not the
   * same place: at 1440 the last reachable card lands with ~150px of scroll
   * still available, so testing only the scroll position produced a dead step
   * — the rail crept to its true end, the leading card did not change, and the
   * carousel appeared to freeze for one full autoplay beat before looping.
   * The scroll check stays as a guard for a rail dragged manually to the end.
   */
  const goNext = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    const atScrollEnd =
      rail.scrollLeft >= rail.scrollWidth - rail.clientWidth - SCROLL_EPSILON;
    goTo(active >= maxIndex || atScrollEnd ? 0 : active + 1);
  }, [active, goTo, maxIndex]);

  const goPrev = useCallback(() => {
    const rail = railRef.current;
    if (!rail) return;
    // From the very start, wrap to the last position the rail can hold.
    goTo(rail.scrollLeft <= SCROLL_EPSILON ? maxIndex : active - 1);
  }, [active, goTo, maxIndex]);

  /*
   * Active card and reachable range come from the rail's geometry.
   *
   * An IntersectionObserver reports every visible card, which is fine when one
   * is visible and useless when four are. The leading card — the one whose left
   * edge is nearest the scroll position — is unambiguous at any card count.
   */
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      const offsets = readOffsets(rail);
      if (offsets.length === 0) return;

      const maxScroll = rail.scrollWidth - rail.clientWidth;
      let reachable = 0;
      for (let index = 0; index < offsets.length; index += 1) {
        if (offsets[index]! <= maxScroll + SCROLL_EPSILON) reachable = index;
      }
      setMaxIndex(reachable);

      let nearest = 0;
      let smallest = Number.POSITIVE_INFINITY;
      offsets.forEach((offset, index) => {
        const distance = Math.abs(offset - rail.scrollLeft);
        if (distance < smallest) {
          smallest = distance;
          nearest = index;
        }
      });
      /*
       * Clamped to what is reachable.
       *
       * At the very end of a mobile rail the nearest card edge is the LAST
       * one, whose dot is hidden because that position can never lead. Left
       * unclamped, the final swipe lit no dot at all. The last reachable
       * position is the honest answer to "where am I".
       */
      setActive(Math.min(nearest, reachable));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(measure);
    };

    measure();
    rail.addEventListener("scroll", schedule, { passive: true });
    const observer = new ResizeObserver(schedule);
    observer.observe(rail);
    return () => {
      rail.removeEventListener("scroll", schedule);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, [readOffsets, slideCount]);

  useEffect(() => {
    if (paused || slideCount < 2) return;
    const timer = window.setTimeout(goNext, INTERIORS_PROMO_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, goNext, paused, slideCount]);

  const onDotKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = Math.min(index + 1, maxIndex);
    if (event.key === "ArrowLeft") nextIndex = Math.max(index - 1, 0);
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = maxIndex;
    if (nextIndex === null) return;
    event.preventDefault();
    goTo(nextIndex);
    dotRefs.current[nextIndex]?.focus();
  };

  /*
   * Every slot disabled, so there is no rail. An empty section would leave a
   * banner-height hole above the hero and push the page down for nothing.
   */
  if (slideCount === 0) {
    return null;
  }

  return (
    <section
      className="od-int-promo"
      aria-roledescription="carousel"
      aria-labelledby={labelId}
      data-od-disc-section="promo-carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={() => setFocusWithin(false)}
      onPointerDown={() => setPointerDown(true)}
      onPointerUp={() => setPointerDown(false)}
      onPointerCancel={() => setPointerDown(false)}
    >
      <h2 id={labelId} className="od-sr-only">
        ONEDECORE promotions
      </h2>

      <ul className="od-int-promo__rail" ref={railRef}>
        {slides.map((slide, index) => (
          <PromoCard
            key={slide.id}
            slide={slide}
            index={index}
            total={slideCount}
            /*
             * Only the first card is worth hinting. Marking all six high
             * priority would have them compete for the same connection and
             * delay the one banner anybody sees.
             */
            priority={index === 0}
          />
        ))}
      </ul>

      <div className="od-int-promo__controls">
        <button
          type="button"
          className="od-int-promo__arrow"
          onClick={goPrev}
          aria-label="Previous promotion"
        >
          <Chevron direction="left" />
        </button>

        <div className="od-int-promo__dots" role="group" aria-label="Choose promotion">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              ref={(node) => {
                dotRefs.current[index] = node;
              }}
              type="button"
              className="od-int-promo__dot"
              /*
               * Beyond the measured range a dot could only clamp back to the
               * same position, so it is removed rather than left as a control
               * that does nothing.
               */
              hidden={index > maxIndex}
              aria-pressed={index === active}
              aria-label={`Show promotion ${index + 1}`}
              onClick={() => goTo(index)}
              onKeyDown={(event) => onDotKeyDown(event, index)}
            />
          ))}
        </div>

        <button
          type="button"
          className="od-int-promo__arrow"
          onClick={goNext}
          aria-label="Next promotion"
        >
          <Chevron direction="right" />
        </button>
      </div>
    </section>
  );
}

function Chevron({ direction }: { readonly direction: "left" | "right" }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        d={direction === "left" ? "M15 5 8 12l7 7" : "M9 5l7 7-7 7"}
      />
    </svg>
  );
}

/**
 * One 9:16 slot: artwork if configured, an empty frame if not.
 *
 * THE WHOLE CARD IS THE LINK, OR NOTHING IS
 *
 * There is no button inside a banner. When a campaign wants a call to action
 * it is drawn into the artwork, and `href` makes the card itself the link — so
 * the painted button and the real target are the same rectangle. Without an
 * href the card is an `<article>` with no handlers: not a click-div pretending
 * to be a link, and nothing focusable that leads nowhere.
 */
function PromoCard({
  slide,
  index,
  total,
  priority,
}: {
  readonly slide: InteriorsPromoSlide;
  readonly index: number;
  readonly total: number;
  readonly priority: boolean;
}) {
  const label = `${INTERIORS_PROMO_PLACEHOLDER_PREFIX} ${index + 1}`;

  const body: ReactNode = slide.image ? (
    <Image
      src={slide.image}
      alt={slide.imageAlt ?? ""}
      fill
      /*
       * One source at every breakpoint, so `sizes` describes one card: most of
       * the viewport on a phone, a fixed-ish portrait column on a desktop.
       */
      sizes="(min-width: 64rem) 360px, (min-width: 48rem) 40vw, 82vw"
      quality={75}
      priority={priority}
      loading={priority ? undefined : "lazy"}
      className="od-int-promo__img"
    />
  ) : (
    /*
     * REVIEW-ONLY EMPTY FRAME.
     *
     * A charcoal surface, a hairline, and a small label. Deliberately not a
     * dashed drop-zone or an image glyph: this is a preview of the frame the
     * artwork will sit in, and anything that looks like an uploader invites
     * the wrong feedback. Delete this branch when the slots are filled.
     */
    <span className="od-int-promo__empty">
      <span className="od-int-promo__emptyLabel">{label}</span>
    </span>
  );

  const frameClass = "od-int-promo__frame";

  return (
    <li
      className="od-int-promo__card"
      data-promo-index={index}
      aria-label={`${index + 1} of ${total}`}
      aria-roledescription="slide"
    >
      {slide.href ? (
        <Link
          href={slide.href}
          className={`${frameClass} od-int-promo__frame--link`}
          data-conversion-action={`promo-${slide.id}`}
        >
          {body}
        </Link>
      ) : (
        <article className={frameClass}>{body}</article>
      )}
    </li>
  );
}
