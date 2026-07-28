"use client";

import Image from "next/image";
import Link from "next/link";
import { CM_HERO, CM_PLANNER, HOMEPAGE_HERO_ASSET } from "./content";
import { useLead } from "./LeadContext";
import { LeadPlannerHost, LeadPlannerInline } from "./LeadPlanner";
import { Reveal } from "../shared/Reveal";

export function CmHero() {
  const { openPlanner } = useLead();

  return (
    <section className="cm-hero" aria-labelledby="cm-hero-title">
      <div className="cm-hero__media" aria-hidden="true">
        <Image
          src={HOMEPAGE_HERO_ASSET.path}
          alt=""
          fill
          priority
          sizes="100vw"
          quality={82}
          style={{ objectPosition: HOMEPAGE_HERO_ASSET.focalPoint }}
        />
      </div>
      <div className="cm-hero__scrim" aria-hidden="true" />

      <div className="dc-container cm-hero__inner">
        <Reveal className="cm-hero__copy">
          <p className="cm-hero__brand">{CM_HERO.brandLine}</p>
          <h1 id="cm-hero-title" className="cm-hero__title">
            {CM_HERO.h1}
          </h1>
          <p className="cm-hero__lede">{CM_HERO.supporting}</p>
          <div className="cm-hero__actions">
            <button
              type="button"
              className="dc-btn dc-btn--primary"
              onClick={() => openPlanner()}
            >
              {CM_HERO.primaryCta}
            </button>
            <Link href={CM_HERO.secondaryHref} className="dc-btn dc-btn--ghost">
              {CM_HERO.secondaryCta}
            </Link>
          </div>
        </Reveal>

        <Reveal className="cm-hero__plannerWrap" order={1}>
          <LeadPlannerInline />
        </Reveal>

        <Reveal className="cm-hero__entry" order={1}>
          <button
            type="button"
            className="cm-hero__entryCard"
            onClick={() => openPlanner()}
          >
            <span className="cm-hero__entryTitle">{CM_PLANNER.title}</span>
            <span className="cm-hero__entryHint">{CM_PLANNER.entryHint}</span>
            <span className="dc-btn dc-btn--primary cm-hero__entryCta">
              {CM_HERO.primaryCta}
            </span>
          </button>
        </Reveal>
      </div>

      <LeadPlannerHost />
    </section>
  );
}
