"use client";

import Image from "next/image";
import { useCallback, useId, useRef, useState } from "react";
import { useCountUp } from "@/features/public-site/motion/useCountUp";
import { HOME_PUNE_AREAS } from "./claims";
import {
  PM_ASSETS,
  PM_CREDIBILITY,
  PM_HERO,
  pmCredibilityText,
  type PmCredibilityItem,
} from "./content";
import { usePlan } from "./PlanContext";

const HERO = PM_ASSETS.hero;

/**
 * One credibility cell — counted if it is a number, printed if it is a word.
 *
 * THE ACCESSIBLE TEXT IS THE FINAL VALUE, ALWAYS
 *
 * The counting digits live in an `aria-hidden` span and the real figure sits
 * beside them in a visually hidden one. A screen reader therefore reads
 * "1000+ Projects Delivered" once, rather than being handed a new number on
 * every animation frame — and it reads the same sentence whether the animation
 * ran, was skipped for reduced motion, or never started because the cell was
 * off screen.
 *
 * `useCountUp` seeds at the target, so the server HTML, the pre-hydration
 * paint and every no-JS visitor already show the true value. It counts once,
 * when the cell comes into view, and never replays.
 */
function CredibilityCell({ item }: { readonly item: PmCredibilityItem }) {
  if (item.kind === "static") {
    return (
      <div className="pm-hero__credItem">
        <span className="pm-hero__credStat">{item.stat}</span>
        <span className="pm-hero__credLabel">{item.label}</span>
      </div>
    );
  }
  return <CountedCredibilityCell item={item} />;
}

function CountedCredibilityCell({
  item,
}: {
  readonly item: Extract<PmCredibilityItem, { kind: "count" }>;
}) {
  const { value, ref } = useCountUp(item.value);
  const finalText = pmCredibilityText(item);

  return (
    <div className="pm-hero__credItem" ref={ref}>
      <span className="od-sr-only">
        {finalText} {item.label}
      </span>
      <span className="pm-hero__credStat" aria-hidden="true">
        {/*
          Only the digits move. The prefix and suffix are words — a "+" that
          counted up to itself, or a "-Year" that assembled letter by letter,
          would read as a rendering fault rather than as emphasis.
        */}
        {item.prefix ?? ""}
        {value}
        {item.suffix ?? ""}
      </span>
      <span className="pm-hero__credLabel" aria-hidden="true">
        {item.label}
      </span>
    </div>
  );
}

/**
 * R5.3 conversion hero — full-bleed image, credibility strip, area disclosure.
 */
export function HomeHero() {
  const { openPlanner, getNextIncompleteStep } = usePlan();
  const [areasExpanded, setAreasExpanded] = useState(false);
  const expandRef = useRef<HTMLButtonElement | null>(null);
  const areasId = useId();

  const toggleAreas = useCallback(() => {
    setAreasExpanded((current) => {
      const next = !current;
      if (!next) {
        queueMicrotask(() => expandRef.current?.focus());
      }
      return next;
    });
  }, []);

  return (
    <section className="pm-hero pm-hero--qf" aria-labelledby="pm-hero-title">
      <span className="pm-hero__glow" aria-hidden="true" />
      <span className="pm-hero__grid" aria-hidden="true" />

      <div className="pm-hero__media" aria-hidden="true">
        <Image
          src={HERO.path}
          alt=""
          fill
          priority
          fetchPriority="high"
          sizes="100vw"
          /*
           * 75 is what is actually served. `images.qualities` defaults to
           * [75], so an 80 here was dropped from the emitted srcset and only
           * produced a warning on every dev boot. Matching the configured
           * value changes no pixel and removes a message that read like a
           * broken image.
           */
          quality={75}
          className="pm-hero__mediaImg"
          style={{ objectPosition: HERO.focalPoint }}
        />
        <span className="pm-hero__mediaScrim" />
      </div>

      <div className="dc-container pm-hero__inner">
        <div className="pm-hero__copy">
          <p className="pm-hero__eyebrow">
            <span className="pm-hero__eyebrowDot" aria-hidden="true" />
            {PM_HERO.eyebrow}
          </p>

          <p className="pm-hero__serviceLine">{PM_HERO.serviceLine}</p>

          <h1 id="pm-hero-title" className="pm-hero__title">
            {PM_HERO.titleLines.map((line, index) => (
              <span
                key={line.text}
                className={
                  line.emphasize
                    ? "pm-hero__line pm-hero__line--gold"
                    : "pm-hero__line"
                }
                style={{ "--pm-line": index } as React.CSSProperties}
              >
                {line.text}
              </span>
            ))}
          </h1>

          <p className="pm-hero__lede">{PM_HERO.lede}</p>

          <div className="pm-hero__actions">
            <button
              type="button"
              className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
              data-conversion-action="hero-start-plan"
              onClick={() => openPlanner(getNextIncompleteStep())}
            >
              {PM_HERO.primaryCta}
            </button>
            {/*
              ONE CALL TO ACTION IN THE HERO.

              "Get Price Estimate" used to sit beside it, and two buttons of
              equal prominence at the top of the page ask a visitor to choose
              before they have read anything. The estimator itself is untouched
              and still reachable — from the sticky bar's journey, the service
              sections and its own anchor — so what was removed is the fork in
              the road, not the road.
            */}
          </div>

          <p className="pm-hero__reassurance">{PM_HERO.reassurance}</p>

          <div className="pm-hero__credibility" aria-label="ONEDECORE credibility">
            {PM_CREDIBILITY.map((item) => (
              <CredibilityCell key={item.id} item={item} />
            ))}
          </div>

          <div className="pm-hero__areas">
            <p className="pm-hero__areasLabel">{PM_HERO.areasLabel}</p>
            <ul
              id={areasId}
              className="pm-hero__areasList"
              data-expanded={areasExpanded ? "" : undefined}
            >
              {HOME_PUNE_AREAS.map((area, index) => (
                <li key={area} className="pm-hero__area" data-index={index}>
                  {area}
                </li>
              ))}
            </ul>
            <button
              ref={expandRef}
              type="button"
              className="pm-textlink pm-hero__areasToggle"
              aria-expanded={areasExpanded}
              aria-controls={areasId}
              onClick={toggleAreas}
            >
              <span className="pm-hero__areasToggleDesktop">
                {areasExpanded
                  ? PM_HERO.areasCollapseLabel
                  : PM_HERO.areasExpandLabel}
              </span>
              <span className="pm-hero__areasToggleMobile">
                {areasExpanded
                  ? PM_HERO.areasCollapseLabel
                  : PM_HERO.areasExpandMobileLabel}
              </span>
            </button>
          </div>
        </div>
      </div>

      <noscript>
        <div className="dc-container pm-noscript pm-hero__noscript">
          <p>{PM_HERO.areasLabel}</p>
          <ul>
            {HOME_PUNE_AREAS.map((area) => (
              <li key={area}>{area}</li>
            ))}
          </ul>
        </div>
      </noscript>
    </section>
  );
}
