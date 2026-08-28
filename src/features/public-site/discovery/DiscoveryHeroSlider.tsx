"use client";

import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent, TouchEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { DISCOVERY_HERO_SLIDES } from "./discovery-copy";
import { DiscoveryHeroTrustBar } from "./DiscoveryHeroTrustBar";
import { getDiscoveryAsset } from "./discovery-assets";

const AUTOPLAY_MS = 6000;
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
      className="od-disc-hero od-disc-hero--slider"
      data-od-disc-section="hero"
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

      <div className="od-disc-shell od-disc-hero__layout">
        <div className="od-disc-hero__copy">
          {DISCOVERY_HERO_SLIDES.map((slide, index) => {
            const isActive = index === active;
            const HeadingTag = index === 0 ? "h1" : "h2";
            return (
              <div
                key={slide.id}
                id={`od-disc-hero-panel-${slide.id}`}
                className="od-disc-hero__panel"
                data-active={isActive ? "" : undefined}
                data-has-badge={slide.badge ? "" : undefined}
                aria-hidden={isActive ? undefined : true}
                aria-labelledby={`od-disc-hero-tab-${slide.id}`}
                inert={isActive ? undefined : true}
                role="tabpanel"
              >
                <p className="od-disc-kicker">{slide.kicker}</p>
                <header>
                  <HeadingTag
                    id={index === 0 ? "od-disc-hero-title" : undefined}
                    className="od-disc-hero__headline"
                  >
                    {slide.headline}
                  </HeadingTag>
                  {slide.badge ? (
                    <p className="od-disc-hero__badge">{slide.badge}</p>
                  ) : null}
                  <p className="od-disc-hero__lede">{slide.lede}</p>
                </header>
                <div className="od-disc-hero__ctas">
                  <Link href={slide.primaryCta.href} className="od-disc-btn od-disc-btn--primary od-disc-btn--sheen">
                    {slide.primaryCta.label}
                  </Link>
                  <Link href={slide.secondaryCta.href} className="od-disc-btn od-disc-btn--ghost">
                    {slide.secondaryCta.label}
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div className="od-disc-hero__bottom">
          <DiscoveryHeroTrustBar />
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
        {focusWithin || hovered
          ? `Slide ${active + 1} of ${slideCount}: ${DISCOVERY_HERO_SLIDES[active]!.headline}`
          : ""}
      </p>

      <div className="od-disc-hero__controls" aria-label="Hero slideshow controls">
        <button
          type="button"
          className="od-disc-hero__arrow od-disc-hero__arrow--prev"
          onClick={goPrev}
          aria-label="Previous slide"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <button
          type="button"
          className="od-disc-hero__arrow od-disc-hero__arrow--next"
          onClick={goNext}
          aria-label="Next slide"
        >
          <span aria-hidden="true">›</span>
        </button>
        <div className="od-disc-hero__dots" role="tablist" aria-label="Choose slide">
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
              aria-controls={`od-disc-hero-panel-${slide.id}`}
              aria-selected={index === active}
              tabIndex={index === active ? 0 : -1}
              aria-label={`Slide ${index + 1}: ${slide.headline}`}
              onClick={() => goTo(index)}
              onKeyDown={(event) => onDotKeyDown(event, index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
