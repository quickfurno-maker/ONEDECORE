"use client";

import Image from "next/image";
import { useCallback, useId, useRef, useState } from "react";
import { HOME_PUNE_AREAS } from "./claims";
import {
  PM_ASSETS,
  PM_CREDIBILITY,
  PM_HERO,
  PM_SECTION_IDS,
} from "./content";
import { usePlan } from "./PlanContext";
import { scrollToHomeSection } from "./scroll-to-section";

const HERO = PM_ASSETS.hero;

function scrollToEstimate() {
  scrollToHomeSection(
    PM_SECTION_IDS.estimate,
    "button, input, select, [href]"
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
          quality={80}
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
            <button
              type="button"
              className="dc-btn dc-btn--ghost pm-btn--lg"
              data-conversion-action="hero-estimate"
              onClick={scrollToEstimate}
            >
              {PM_HERO.secondaryCta}
            </button>
          </div>

          <p className="pm-hero__reassurance">{PM_HERO.reassurance}</p>

          <div className="pm-hero__credibility" aria-label="ONEDECORE credibility">
            {PM_CREDIBILITY.map((item) => (
              <div key={item.id} className="pm-hero__credItem">
                <span className="pm-hero__credStat">{item.stat}</span>
                <span className="pm-hero__credLabel">{item.label}</span>
              </div>
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
