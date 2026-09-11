"use client";

import { getImageProps } from "next/image";
import { useCountUp } from "@/features/public-site/motion/useCountUp";
import {
  PM_ASSETS,
  PM_CREDIBILITY,
  PM_HERO,
  pmCredibilityText,
  type PmCredibilityItem,
} from "./content";
import { usePlan } from "./PlanContext";

const HERO_DESKTOP = PM_ASSETS.heroHomeDesktop;
const HERO_MOBILE = PM_ASSETS.heroHomeMobile;

/**
 * The hero image is ART-DIRECTED, which is why this is a <picture> and not
 * `<Image fill>`.
 *
 * The two files are different crops, not one picture at two sizes: 1600x900
 * landscape for desktop and tablet, 900x1600 portrait for a phone. `sizes`
 * cannot express that — it picks a WIDTH from one srcset. `<source media>` is
 * the only mechanism that picks a FILE, and it is the only one that downloads
 * just the one it picked. Two `<Image>` elements toggled with `display: none`
 * was the obvious alternative and the wrong one: Chrome fetches a hidden `img`
 * anyway, so a phone would have paid for the desktop crop as well.
 *
 * `getImageProps` is the documented Next 16 recipe for this. The srcsets still
 * come from the image optimizer, so nothing about formats, widths or quality
 * changes — only which of the two the browser is allowed to ask for.
 *
 * WHAT IS LOST, AND WHY IT IS ACCEPTABLE
 *
 * `priority` also injects `<link rel="preload">`, and that does not survive the
 * move to `<picture>`; a media-conditional preload would have to restate both
 * srcsets in the head and would then be a second place to keep in step. What
 * actually drives the LCP here is that the `<img>` is in the server-rendered
 * HTML, above everything else, with `fetchpriority="high"` and `loading="eager"`
 * — the preload scanner reaches it in the first chunk either way.
 */
const HERO_IMAGE_QUALITY = 75;

const { props: heroDesktopProps } = getImageProps({
  alt: "",
  src: HERO_DESKTOP.path,
  width: HERO_DESKTOP.width,
  height: HERO_DESKTOP.height,
  quality: HERO_IMAGE_QUALITY,
  sizes: "100vw",
});

const { props: heroMobileProps } = getImageProps({
  alt: "",
  src: HERO_MOBILE.path,
  width: HERO_MOBILE.width,
  height: HERO_MOBILE.height,
  quality: HERO_IMAGE_QUALITY,
  sizes: "100vw",
});

const { srcSet: heroDesktopSrcSet } = heroDesktopProps;
const { srcSet: heroMobileSrcSet, ...heroFallbackProps } = heroMobileProps;

/**
 * The switch point.
 *
 * 768px, so tablets get the landscape crop as the asset map asks. Below it the
 * portrait crop has the room a phone actually has.
 */
const HERO_DESKTOP_MEDIA = "(min-width: 768px)";

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

      <div
        className="pm-hero__media"
        aria-hidden="true"
        /*
         * Focal points travel as custom properties rather than as an inline
         * `object-position`, because the two crops need different ones and a
         * single element can only carry one inline value. The numbers stay in
         * the asset registry where they are reviewed; the breakpoint that
         * chooses between them stays in the stylesheet, next to the same
         * 768px used by the <source> above.
         */
        style={
          {
            "--pm-hero-focal-desktop": HERO_DESKTOP.focalPoint,
            "--pm-hero-focal-mobile": HERO_MOBILE.focalPoint,
          } as React.CSSProperties
        }
      >
        <picture>
          <source
            media={HERO_DESKTOP_MEDIA}
            srcSet={heroDesktopSrcSet}
            sizes="100vw"
            width={HERO_DESKTOP.width}
            height={HERO_DESKTOP.height}
          />
          <source
            srcSet={heroMobileSrcSet}
            sizes="100vw"
            width={HERO_MOBILE.width}
            height={HERO_MOBILE.height}
          />
          {/*
            The fallback, and the element every browser actually paints. It
            carries the mobile file because a browser old enough to ignore
            <source> is a phone often enough that the portrait crop is the
            safer default.
          */}
          <img
            {...heroFallbackProps}
            alt=""
            className="pm-hero__mediaImg"
            fetchPriority="high"
            loading="eager"
            decoding="async"
          />
        </picture>
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
