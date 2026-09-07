"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, TouchEvent } from "react";
import Image from "next/image";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DISCOVERY_HERO_SLIDES, DISCOVERY_HERO_PAGE_TITLE } from "./discovery-copy";
import { getDiscoveryAsset } from "./discovery-assets";

const AUTOPLAY_MS = 5500;
const SWIPE_THRESHOLD = 48;

function subscribeReducedMotion(onStoreChange: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", onStoreChange);
  return () => media.removeEventListener("change", onStoreChange);
}

function getReducedMotionSnapshot() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribeReducedMotion, getReducedMotionSnapshot, () => false);
}

/**
 * The homepage hero: sliding images and nothing else.
 *
 * WHY THERE IS NO TEXT HERE
 *
 * Owner-directed. The hero used to carry a kicker, a rotating headline, a lede,
 * a badge and a trust bar layered over the photography, plus prev/next arrows.
 * It is now the photography — the interiors are the argument, and everything
 * that was competing with them has moved below the fold where it can be read
 * rather than skimmed past.
 *
 * WHAT THAT COSTS, AND HOW IT IS PAID
 *
 * A page still needs one H1, and a decorative banner cannot be it. So the H1 is
 * rendered visually hidden: present for assistive technology and for search
 * engines, invisible on screen. The images are `alt=""` because they are
 * decoration, not content — a screen reader user loses nothing by not hearing
 * "modern kitchen photograph", and gains by not hearing it five times.
 *
 * The dots are the only visible control. They are labelled by position rather
 * than by the old marketing headlines, because "slide 2" is what they actually
 * do and the headline is no longer on screen to refer to.
 */
export function DiscoveryHeroSlider() {
  const [active, setActive] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focusWithin, setFocusWithin] = useState(false);
  const [touchPaused, setTouchPaused] = useState(false);
  const [progressKey, setProgressKey] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const dotRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const slideCount = DISCOVERY_HERO_SLIDES.length;
  const reducedMotion = usePrefersReducedMotion();
  const paused = reducedMotion || hovered || focusWithin || touchPaused;

  const goTo = useCallback(
    (index: number) => {
      setActive(((index % slideCount) + slideCount) % slideCount);
      setProgressKey((value) => value + 1);
    },
    [slideCount]
  );

  const goNext = useCallback(() => goTo(active + 1), [active, goTo]);
  const goPrev = useCallback(() => goTo(active - 1), [active, goTo]);

  useEffect(() => {
    if (paused) return;
    const timer = window.setTimeout(() => {
      setActive((current) => (current + 1) % slideCount);
      setProgressKey((value) => value + 1);
    }, AUTOPLAY_MS);
    return () => window.clearTimeout(timer);
  }, [active, paused, slideCount]);

  const onDotKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>, index: number) => {
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

  const onTouchStart = (event: TouchEvent) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
    setTouchPaused(true);
  };

  const onTouchEnd = (event: TouchEvent) => {
    const start = touchStartX.current;
    const end = event.changedTouches[0]?.clientX;
    touchStartX.current = null;
    setTouchPaused(false);
    if (start == null || end == null) {
      return;
    }
    const delta = end - start;
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      if (delta < 0) goNext();
      else goPrev();
    }
  };

  return (
    <section
      className="od-disc-hero od-disc-hero--slider od-disc-hero--imageOnly"
      data-od-disc-section="hero"
      data-od-hero-image-only=""
      aria-labelledby="od-disc-hero-title"
      aria-roledescription="carousel"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocusWithin(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocusWithin(false);
        }
      }}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => setTouchPaused(false)}
    >
      {/*
        * The page's only H1. Visually hidden, semantically present: the banner
        * itself is decoration and cannot carry the page's identity.
        */}
      <h1 id="od-disc-hero-title" className="od-sr-only">
        {DISCOVERY_HERO_PAGE_TITLE}
      </h1>

      <div className="od-disc-hero__slides" aria-hidden="true">
        {DISCOVERY_HERO_SLIDES.map((slide, index) => {
          const isActive = index === active;
          const asset = getDiscoveryAsset(slide.assetKey);
          return (
            <div
              key={slide.id}
              className="od-disc-hero__slide"
              data-active={isActive ? "" : undefined}
              aria-hidden={isActive ? undefined : true}
            >
              <div
                className="od-disc-hero__media"
                aria-hidden="true"
                style={
                  {
                    "--od-hero-focal": asset.focalPoint,
                    "--od-hero-focal-mobile": asset.mobileFocalPoint,
                  } as CSSProperties
                }
              >
                <Image
                  src={asset.path}
                  alt=""
                  fill
                  priority={index === 0}
                  loading={index === 0 ? "eager" : "lazy"}
                  sizes="100vw"
                  className="od-disc-hero__bg"
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="od-disc-hero__progress" aria-hidden="true">
        {DISCOVERY_HERO_SLIDES.map((slide, index) => (
          <span
            key={`${slide.id}-${progressKey}`}
            className="od-disc-hero__progress-seg"
            data-active={index === active ? "" : undefined}
            data-paused={paused && index === active ? "" : undefined}
          />
        ))}
      </div>

      <p className="od-sr-only" aria-live="polite" aria-atomic="true">
        {focusWithin || hovered ? `Image ${active + 1} of ${slideCount}` : ""}
      </p>

      <div className="od-disc-hero__dots" role="tablist" aria-label="Choose banner image">
        {DISCOVERY_HERO_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            ref={(node) => {
              dotRefs.current[index] = node;
            }}
            id={`od-disc-hero-tab-${slide.id}`}
            type="button"
            role="tab"
            className="od-disc-hero__dot"
            aria-selected={index === active}
            tabIndex={index === active ? 0 : -1}
            aria-label={`Show image ${index + 1} of ${slideCount}`}
            onClick={() => goTo(index)}
            onKeyDown={(event) => onDotKeyDown(event, index)}
          />
        ))}
      </div>
    </section>
  );
}
