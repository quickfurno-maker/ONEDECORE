"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import {
  DISCOVERY_GATEWAY_EYEBROW,
  DISCOVERY_GATEWAY_INTERIORS_CTA,
  DISCOVERY_GATEWAY_LEDE,
  DISCOVERY_GATEWAY_SHOP_CTA,
  DISCOVERY_GATEWAY_TITLE,
  DISCOVERY_HERO_SLIDES,
} from "./discovery-copy";
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
 * The homepage hero: the brand, and the two ways into it.
 *
 * WHY THE TEXT CAME BACK
 *
 * This hero was deliberately image-only, with the H1 visually hidden, on the
 * argument that the interiors were the argument. That was right for an
 * interiors landing page. It is wrong for the gateway to a brand that does two
 * different things, because a visitor cannot choose between two journeys that
 * the first screen never mentions.
 *
 * So the H1 is on screen again and carries the brand rather than a service
 * list, and the two verticals are two buttons rather than a scroll away.
 *
 * THE SLIDER MECHANICS ARE UNCHANGED
 *
 * Autoplay, pause-on-hover/focus/touch, swipe, reduced-motion, arrow keys and
 * the labelled dot group all behave exactly as before. Only the layer above the
 * photography is new.
 *
 * SHOP IS CONDITIONAL, NOT DISABLED
 *
 * When the fail-closed gate is off, the second button is absent rather than
 * present-and-broken, and the hero reads as a strong interiors hero. A greyed
 * button that goes nowhere is worse than no button.
 *
 * TEXT OVER PHOTOGRAPHY
 *
 * Legibility does not rely on the image being dark enough — `__media::after`
 * lays a fixed gradient scrim under the copy, so a bright slide cannot swallow
 * the headline. The images stay `alt=""`: they are decoration, and the words
 * that matter are now real text beside them.
 *
 * THEY ARE NOT TABS
 *
 * The dots were, when each controlled a copy panel with `role="tabpanel"`.
 * A `tablist` whose tabs control nothing is a promise to assistive technology
 * that the page cannot keep, so they are ordinary buttons in a labelled group
 * and the current one says so with `aria-pressed`.
 */
export function DiscoveryHeroSlider({
  shopLive = false,
}: {
  /** Mirrors the fail-closed public Shop gate. */
  readonly shopLive?: boolean;
} = {}) {
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
      className="od-disc-hero od-disc-hero--slider od-disc-hero--gateway"
      data-od-disc-section="hero"
      data-od-hero-gateway=""
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

      {/*
        * The page's only H1, and now a visible one. It names the brand's job
        * rather than a service, because the two buttons below it are what
        * separate the services.
        */}
      <div className="od-disc-shell od-disc-hero__copy">
        <p className="od-disc-hero__eyebrow">{DISCOVERY_GATEWAY_EYEBROW}</p>
        <h1 id="od-disc-hero-title">{DISCOVERY_GATEWAY_TITLE}</h1>
        <p className="od-disc-hero__lede">{DISCOVERY_GATEWAY_LEDE}</p>
        <div className="od-disc-cta-row od-disc-hero__actions">
          <Link
            href="/interiors"
            className="od-disc-btn od-disc-btn--primary od-disc-btn--sheen"
          >
            {DISCOVERY_GATEWAY_INTERIORS_CTA}
          </Link>
          {shopLive ? (
            <Link href="/shop" className="od-disc-btn od-disc-btn--ghost">
              {DISCOVERY_GATEWAY_SHOP_CTA}
            </Link>
          ) : null}
        </div>
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

      <div
        className="od-disc-hero__dots"
        role="group"
        aria-label="Choose banner image"
      >
        {DISCOVERY_HERO_SLIDES.map((slide, index) => (
          <button
            key={slide.id}
            ref={(node) => {
              dotRefs.current[index] = node;
            }}
            id={`od-disc-hero-dot-${slide.id}`}
            type="button"
            className="od-disc-hero__dot"
            aria-pressed={index === active}
            aria-label={`Show image ${index + 1} of ${slideCount}`}
            onClick={() => goTo(index)}
            onKeyDown={(event) => onDotKeyDown(event, index)}
          />
        ))}
      </div>
    </section>
  );
}
