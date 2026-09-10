"use client";

import { getImageProps } from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import type {
  CSSProperties,
  KeyboardEvent as ReactKeyboardEvent,
} from "react";
import {
  getEnabledInteriorsPromoSlides,
  INTERIORS_PROMO_AUTOPLAY_MS,
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

/**
 * The promotional carousel above the Interiors hero.
 *
 * WHY THIS IS A SCROLL-SNAP RAIL AND THE HOMEPAGE HERO IS NOT
 *
 * `DiscoveryHeroSlider` crossfades one full-bleed image at a time. That is the
 * right mechanism for a hero, and the wrong one here: this surface has to show
 * a slice of the NEXT card, because the peek is what tells a thumb the row
 * moves. A crossfade has nothing to peek at.
 *
 * So the geometry is a native scroll-snap rail, and the browser does the work:
 * momentum, rubber-banding, snap points and — the part that matters — a swipe
 * that feels like every other swipe on the device. A JS drag handler can
 * approximate that and never quite matches it. What IS borrowed from the
 * homepage slider is the engineering around the motion: the reduced-motion
 * store, the pause semantics, the dot group, the arrow-key contract.
 *
 * THE RAIL SCROLLS, THE DOCUMENT DOES NOT
 *
 * Overflow belongs to `.od-int-promo__rail` alone. The section is clipped, so
 * the peeking card and the off-screen slides can never widen the page — a
 * horizontal document scrollbar on a phone is the classic way a carousel like
 * this breaks a layout.
 *
 * ACTIVE SLIDE IS OBSERVED, NOT ASSUMED
 *
 * The rail is the source of truth. An IntersectionObserver against the rail
 * reports which card is centred, so a finger-flick, a click on a dot and the
 * autoplay timer all converge on the same state instead of each keeping their
 * own idea of "current".
 *
 * THEY ARE NOT TABS
 *
 * The dots control scroll position, not a set of tabpanels. `role="tablist"`
 * would promise assistive technology a relationship that does not exist, so
 * they are ordinary buttons in a labelled group with `aria-pressed`.
 *
 * NOTHING IS ANNOUNCED EVERY FIVE SECONDS
 *
 * The rail is not a live region. A carousel that politely interrupts a screen
 * reader on a timer is unusable; the slides are all in the DOM, all reachable,
 * and a visitor moves through them when they choose to.
 */
export function InteriorsPromoCarousel() {
  const slides = getEnabledInteriorsPromoSlides();
  const railRef = useRef<HTMLUListElement | null>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [pointerDown, setPointerDown] = useState(false);
  const reducedMotion = usePrefersReducedMotion();
  const labelId = useId();

  const slideCount = slides.length;
  const paused = reducedMotion || hovered || focusWithin || pointerDown;

  /**
   * Scroll a card to the start of the rail.
   *
   * `scrollTo` rather than `scrollIntoView`: the latter also scrolls the
   * PAGE to bring the rail into view, which would yank a visitor reading the
   * hero back up to a banner they did not ask for.
   */
  const goTo = useCallback(
    (index: number, behavior: ScrollBehavior = "smooth") => {
      const rail = railRef.current;
      if (!rail || slideCount === 0) return;
      const next = ((index % slideCount) + slideCount) % slideCount;
      const card = rail.children[next] as HTMLElement | undefined;
      if (!card) return;
      rail.scrollTo({
        left: card.offsetLeft - rail.offsetLeft,
        behavior: reducedMotion ? "auto" : behavior,
      });
    },
    [reducedMotion, slideCount]
  );

  const goNext = useCallback(() => goTo(active + 1), [active, goTo]);
  const goPrev = useCallback(() => goTo(active - 1), [active, goTo]);

  // Which card is centred in the rail, straight from the rail itself.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const index = Number(
            (entry.target as HTMLElement).dataset.promoIndex ?? "0"
          );
          setActive(index);
        }
      },
      { root: rail, threshold: 0.6 }
    );
    for (const child of Array.from(rail.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [slideCount]);

  useEffect(() => {
    if (paused || slideCount < 2) return;
    const timer = window.setTimeout(() => {
      goTo(active + 1);
    }, INTERIORS_PROMO_AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, goTo, paused, slideCount]);

  const onDotKeyDown = (
    event: ReactKeyboardEvent<HTMLButtonElement>,
    index: number
  ) => {
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (index + 1) % slideCount;
    if (event.key === "ArrowLeft") nextIndex = (index - 1 + slideCount) % slideCount;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = slideCount - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    goTo(nextIndex);
    dotRefs.current[nextIndex]?.focus();
  };

  /*
   * Every slide is disabled, so there is no carousel.
   *
   * Returning an empty section would leave a banner-height hole above the hero
   * and push the page down for nothing.
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
        ONEDECORE interior services
      </h2>

      <ul className="od-int-promo__rail" ref={railRef}>
        {slides.map((slide, index) => (
          <PromoCard
            key={slide.id}
            slide={slide}
            index={index}
            total={slideCount}
            /*
             * Only the first card is worth pre-empting the hero image for.
             * Marking all six priority would have twelve files competing for
             * the same connection and delay the one banner anybody sees.
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
              aria-pressed={index === active}
              aria-label={`Show ${slide.eyebrow ?? slide.title}`}
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

const PROMO_SIZES = "(min-width: 64rem) 92vw, (min-width: 48rem) 94vw, 82vw";

/**
 * One promotional card.
 *
 * WHY `getImageProps` AND NOT TWO `<Image>` ELEMENTS
 *
 * Art direction here means two different FILES, not one file cropped twice, so
 * the switch has to happen in `<picture>` — CSS-hiding one of a pair of
 * `<img>` elements downloads both, which is the opposite of the point on a
 * phone. But a hand-written `<source srcSet={path}>` walks straight past the
 * image optimiser and ships the original at full width to every device.
 *
 * `getImageProps` is the documented way out: it returns the optimised `srcSet`
 * that `<Image>` would have rendered, for each source independently, and the
 * browser still fetches exactly one of them.
 *
 * `fetchPriority` rather than `priority` for the first card, for the same
 * reason — `priority` emits a preload for one specific URL, which would fetch
 * the mobile artwork on a desktop that is about to use the landscape source.
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
  const headingId = `od-int-promo-title-${slide.id}`;
  const common = { alt: slide.imageAlt, sizes: PROMO_SIZES, quality: 75 };

  const {
    props: { srcSet: desktopSrcSet },
  } = getImageProps({
    ...common,
    src: slide.desktopImage.src,
    width: slide.desktopImage.width,
    height: slide.desktopImage.height,
  });

  /*
   * `alt` is pulled out of the spread and written on the element.
   *
   * It is identical either way at runtime, but a reader — and `jsx-a11y` —
   * cannot tell that an `{...spread}` carries one. Making the most important
   * accessibility attribute on the page visible at its call site is worth one
   * extra line.
   */
  const {
    props: { srcSet: mobileSrcSet, alt, ...imgProps },
  } = getImageProps({
    ...common,
    src: slide.mobileImage.src,
    width: slide.mobileImage.width,
    height: slide.mobileImage.height,
  });

  return (
    <li
      className="od-int-promo__card"
      data-promo-index={index}
      aria-label={`${index + 1} of ${total}`}
      aria-roledescription="slide"
    >
      <article className="od-int-promo__frame" aria-labelledby={headingId}>
        <div className="od-int-promo__media">
          <picture>
            <source media="(min-width: 48rem)" srcSet={desktopSrcSet} />
            <source srcSet={mobileSrcSet} />
            {/*
              Two focal points, one element. Which source the browser picked is
              not knowable from here, so both are handed to CSS as custom
              properties and the same 48rem breakpoint chooses between them.
            */}
            <img
              {...imgProps}
              alt={alt}
              className="od-int-promo__img"
              fetchPriority={priority ? "high" : undefined}
              style={
                {
                  "--promo-focal-mobile": slide.mobileImage.focalPoint,
                  "--promo-focal-desktop": slide.desktopImage.focalPoint,
                } as CSSProperties
              }
            />
          </picture>
          <span className="od-int-promo__scrim" aria-hidden="true" />
        </div>

        <div className="od-int-promo__copy">
          {slide.eyebrow ? (
            <p className="od-int-promo__eyebrow">{slide.eyebrow}</p>
          ) : null}
          {/*
            h3, never h1. `HomeHero` owns this page's only H1, and a carousel
            that rotates six of them would give the page six competing titles
            depending on when a crawler looked.
          */}
          <h3 id={headingId} className="od-int-promo__title">
            {slide.title}
          </h3>
          {slide.body ? (
            <p className="od-int-promo__body">{slide.body}</p>
          ) : null}
          {slide.ctaLabel && slide.href ? (
            <Link
              href={slide.href}
              className="od-int-promo__cta"
              data-conversion-action={`promo-${slide.id}`}
            >
              {slide.ctaLabel}
            </Link>
          ) : null}
        </div>
      </article>
    </li>
  );
}
