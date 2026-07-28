"use client";

import Image from "next/image";
import Link from "next/link";
import { PM_ASSETS, PM_HERO } from "./content";
import { usePlan } from "./PlanContext";
import { HomePlannerEntry, HomePlannerInline } from "./HomePlanner";

const HERO = PM_ASSETS.hero;

/**
 * R4.1 hero — desktop split stage + compact planner; mobile full-bleed with
 * bottom-weighted copy/CTAs in the first viewport (Option A).
 */
export function HomeHero() {
  const { openPlanner } = usePlan();

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
          style={{ objectPosition: HERO.mobileFocalPoint }}
        />
        <span className="pm-hero__mediaScrim" />
      </div>

      <div className="dc-container pm-hero__inner">
        <div className="pm-hero__copy">
          <p className="pm-hero__eyebrow">
            <span className="pm-hero__eyebrowDot" aria-hidden="true" />
            {PM_HERO.eyebrow}
          </p>

          <h1 id="pm-hero-title" className="pm-hero__title">
            {PM_HERO.titleLines.map((line, index) => (
              <span
                key={line}
                className="pm-hero__line"
                style={{ "--pm-line": index } as React.CSSProperties}
              >
                {line}
              </span>
            ))}
          </h1>

          <p className="pm-hero__lede">{PM_HERO.lede}</p>

          <div className="pm-hero__actions">
            <button
              type="button"
              className="dc-btn dc-btn--primary pm-btn--lg pm-btn--sheen"
              onClick={() => openPlanner()}
            >
              {PM_HERO.primaryCta}
            </button>
            <Link
              href={PM_HERO.secondaryHref}
              className="dc-btn dc-btn--ghost pm-btn--lg"
            >
              {PM_HERO.secondaryCta}
            </Link>
          </div>

          <ul className="pm-hero__assurances">
            {PM_HERO.assurances.map((item, index) => (
              <li
                key={item}
                style={{ "--pm-line": index } as React.CSSProperties}
              >
                <span className="pm-hero__assuranceMark" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>

          <div className="pm-hero__entryWrap">
            <HomePlannerEntry />
          </div>
        </div>

        <div className="pm-hero__stage">
          <figure className="pm-stage">
            <span className="pm-stage__frame" aria-hidden="true" />
            <span className="pm-stage__sheen" aria-hidden="true" />
            <Image
              src={HERO.path}
              alt={HERO.alt}
              width={HERO.width}
              height={HERO.height}
              priority
              fetchPriority="high"
              sizes="(max-width: 1079px) 100vw, 46vw"
              quality={80}
              className="pm-stage__img"
              style={{ objectPosition: HERO.focalPoint }}
            />
          </figure>

          <div className="pm-hero__plannerWrap">
            <HomePlannerInline />
          </div>
        </div>
      </div>

      <p className="pm-hero__brand" aria-hidden="true">
        {PM_HERO.brandLine}
      </p>
    </section>
  );
}
