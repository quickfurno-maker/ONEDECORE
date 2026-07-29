"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useRef, useState } from "react";
import {
  PM_ASSETS,
  PM_HERO,
  PM_HERO_CREDIBILITY,
  PM_PUNE_AREAS,
} from "./content";
import { usePlan } from "./PlanContext";

const HERO = PM_ASSETS.hero;

/**
 * Full-bleed hero — copy, credibility, areas, CTAs.
 * Planner opens from CTA only (no inline card).
 */
export function HomeHero() {
  const { openPlanner, getNextIncompleteStep } = usePlan();
  const [areasOpen, setAreasOpen] = useState(false);
  const areasId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);

  return (
    <section className="pm-hero" aria-labelledby="pm-hero-title">
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
                className="pm-hero__line"
                data-emphasis={line.emphasize ? "" : undefined}
                style={{ "--pm-line": index } as React.CSSProperties}
              >
                {line.text}
              </span>
            ))}
          </h1>

          <p className="pm-hero__lede">{PM_HERO.lede}</p>

          <ul
            className="pm-hero__credibility"
            role="list"
            aria-label="ONEDECORE operating facts"
          >
            {PM_HERO_CREDIBILITY.map((item) => (
              <li key={item.label} className="pm-hero__credItem">
                <span className="pm-hero__credCheck" aria-hidden="true">
                  ✓
                </span>
                <span>
                  <span className="pm-hero__credValue">{item.value}</span>{" "}
                  {item.label}
                </span>
              </li>
            ))}
          </ul>

          <div className="pm-hero__actions">
            <button
              type="button"
              className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
              data-conversion-action="hero-start-plan"
              data-hero-primary-cta=""
              onClick={() => openPlanner(getNextIncompleteStep())}
            >
              {PM_HERO.primaryCta}
            </button>
            <Link
              href={PM_HERO.secondaryHref}
              className="dc-btn dc-btn--ghost pm-btn--lg"
              data-conversion-action="portfolio-view"
            >
              {PM_HERO.secondaryCta}
            </Link>
          </div>

          <div className="pm-hero__areas">
            <p className="pm-hero__areasLabel">{PM_HERO.areasLabel}</p>
            <ul
              id={areasId}
              className="pm-hero__areaList"
              data-expanded={areasOpen ? "" : undefined}
            >
              {PM_PUNE_AREAS.map((area) => (
                <li key={area} className="pm-hero__areaPill">
                  {area}
                </li>
              ))}
            </ul>
            <button
              ref={toggleRef}
              type="button"
              className="pm-hero__areasToggle"
              aria-expanded={areasOpen}
              aria-controls={areasId}
              onClick={() => setAreasOpen((value) => !value)}
            >
              {areasOpen ? PM_HERO.areasCollapseLabel : PM_HERO.areasExpandLabel}
            </button>
            <noscript>
              <ul className="pm-hero__areaList pm-hero__areaList--noscript">
                {PM_PUNE_AREAS.map((area) => (
                  <li key={area} className="pm-hero__areaPill">
                    {area}
                  </li>
                ))}
              </ul>
            </noscript>
          </div>
        </div>
      </div>
    </section>
  );
}
