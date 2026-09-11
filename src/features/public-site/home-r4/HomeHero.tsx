"use client";

import Image from "next/image";
import { useCountUp } from "@/features/public-site/motion/useCountUp";
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
 * R5.3 conversion hero — full-bleed image, one CTA, credibility strip.
 *
 * FOUR ELEMENTS, AND THE COMPONENT HAS NO STATE
 *
 * Eyebrow, headline, button, credibility row. The service line, the
 * descriptive paragraph and the CTA microcopy that used to sit between them
 * are gone — see `PM_HERO` for why they were not replaced with shorter copy —
 * and so is the Pune area disclosure, which was the only thing here that
 * needed `useState`, a generated id and a focus-restoring toggle.
 *
 * That block is not lost: `InteriorsServiceAreas`, further down the same page,
 * has always rendered ALL 26 localities as plain server HTML. The hero was
 * showing six of them behind an expander, which is a second, worse copy of a
 * section the visitor reaches anyway — and it was the reason this file needed
 * a `<noscript>` fallback. Both are now the one section's job.
 *
 * What remains client-side is the counter, which is `useCountUp` inside the
 * cells rather than anything this component holds.
 */
export function HomeHero() {
  const { openPlanner, getNextIncompleteStep } = usePlan();

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

          {/*
            THE LAST THING IN THE HERO.

            The four cells are unchanged — the counted figures, their claim
            gates, the 2x2 grid that becomes a row at 768px, and the
            screen-reader text that states the final value once. The only
            difference is what follows them, which is now the page.
          */}
          <div className="pm-hero__credibility" aria-label="ONEDECORE credibility">
            {PM_CREDIBILITY.map((item) => (
              <CredibilityCell key={item.id} item={item} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
