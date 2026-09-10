/**
 * The /interiors promotional rail: one 9:16 format, six empty slots.
 *
 * WHAT THIS SUITE IS DEFENDING
 *
 *  1. The single-source model. The previous build shipped a portrait file and
 *     a landscape file per campaign, which is two exports to keep in step and
 *     two chances for them to say different things. A `desktopImage` field
 *     creeping back would reintroduce that silently.
 *
 *  2. The 9:16 shape. It is the one thing the artwork depends on, and the
 *     easiest way to break it is a `max-height` on a box with `aspect-ratio` —
 *     the browser satisfies the cap by distorting or cropping rather than by
 *     refusing.
 *
 *  3. One card per step. The obvious implementation of "next" on a multi-card
 *     rail scrolls by a viewport, which skips three banners at a time and
 *     leaves a visitor wondering what they missed.
 *
 *  4. Empty meaning empty. No image requests, no invented copy, no CTA, no
 *     dead href — the slots exist to settle geometry, not to look finished.
 *
 *  5. Everything the previous two commits established on this page.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  getEnabledInteriorsPromoSlides,
  INTERIORS_PROMO_AUTOPLAY_MS,
  INTERIORS_PROMO_PLACEHOLDER_PREFIX,
  INTERIORS_PROMO_RATIO,
  INTERIORS_PROMO_SLIDES,
} from "../interiors/interiors-promo.ts";
import { PM_CREDIBILITY, pmCredibilityText } from "../home-r4/content.ts";
import { HOME_CLAIMS, canQuotePublicClaim } from "../home-r4/claims.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CAROUSEL = "src/features/public-site/interiors/InteriorsPromoCarousel.tsx";
const CONFIG = "src/features/public-site/interiors/interiors-promo.ts";
const PAGE = "src/features/public-site/interiors/InteriorsConversionPage.tsx";
const HERO = "src/features/public-site/home-r4/HomeHero.tsx";
const CSS = "src/features/public-site/interiors/interiors.css";

/**
 * The page's section-order contract, read from source rather than imported.
 *
 * `InteriorsConversionPage.tsx` imports stylesheets, which `node --test`
 * cannot load. Reading the literal asserts the same thing: the array a
 * developer would edit.
 */
function readInteriorsSectionOrder(): readonly string[] {
  const source = read(PAGE);
  const block = /export const INTERIORS_SECTION_ORDER = \[([\s\S]*?)\] as const;/.exec(
    source
  );
  assert.ok(block, "INTERIORS_SECTION_ORDER must be a literal array");
  return Array.from(block[1]!.matchAll(/"([^"]+)"/g)).map((match) => match[1]!);
}

/* -------------------------------------------------------------------------- */
/* 1. Config — six empty slots, one source model                               */
/* -------------------------------------------------------------------------- */

describe("the rail is six configurable slots", () => {
  test("exactly six slots with stable unique ids", () => {
    assert.equal(INTERIORS_PROMO_SLIDES.length, 6);
    const ids = INTERIORS_PROMO_SLIDES.map((slide) => slide.id);
    assert.equal(new Set(ids).size, 6, "slide ids must be unique");
    for (const id of ids) {
      assert.match(id, /^[a-z][a-z0-9-]*$/, `${id} must be a stable slug`);
    }
  });

  test("every slot is currently empty: no artwork, no destination", () => {
    for (const slide of INTERIORS_PROMO_SLIDES) {
      assert.ok(
        slide.image === undefined || slide.image === null,
        `${slide.id} must carry no artwork in this review build`
      );
      assert.ok(
        slide.href === undefined || slide.href === null,
        `${slide.id} must not be clickable while it is empty`
      );
    }
  });

  test("one artwork path per campaign, never a mobile/desktop pair", () => {
    /*
     * The previous model had `mobileImage` and `desktopImage`. Two cuts per
     * campaign is two exports to keep in step, and when they drift nobody
     * notices until someone opens the site on the other device.
     */
    const config = read(CONFIG);
    for (const gone of [
      "mobileImage",
      "desktopImage",
      "focalPointMobile",
      "focalPointDesktop",
      "ctaLabel",
      "eyebrow",
    ]) {
      assert.doesNotMatch(
        code(config),
        new RegExp(`\\b${gone}\\b`),
        `${gone} must not survive into the single-source model`
      );
    }
    assert.match(config, /readonly image\?: string \| null/);
    assert.match(config, /readonly href\?: string \| null/);
  });

  test("the authored format is 9:16 and the CSS agrees", () => {
    assert.equal(INTERIORS_PROMO_RATIO, "9 / 16");
    const css = read(CSS);
    assert.match(css, /aspect-ratio: 9 \/ 16/);
    // And no landscape frame survives anywhere.
    assert.doesNotMatch(css, /aspect-ratio: 12 \/ 5/);
  });

  test("enabled filtering decides what renders", () => {
    assert.equal(getEnabledInteriorsPromoSlides().length, 6);
    const withOneOff = INTERIORS_PROMO_SLIDES.map((slide, index) =>
      index === 2 ? { ...slide, enabled: false } : slide
    );
    const enabled = getEnabledInteriorsPromoSlides(withOneOff);
    assert.equal(enabled.length, 5);
    assert.ok(!enabled.some((slide) => slide.id === INTERIORS_PROMO_SLIDES[2]!.id));
  });

  test("all slots disabled renders nothing at all", () => {
    const allOff = INTERIORS_PROMO_SLIDES.map((slide) => ({
      ...slide,
      enabled: false,
    }));
    assert.equal(getEnabledInteriorsPromoSlides(allOff).length, 0);
    assert.match(code(read(CAROUSEL)), /if \(slideCount === 0\) \{\s*return null;/);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Empty frames — no images, no copy, no CTA                                */
/* -------------------------------------------------------------------------- */

describe("the empty slots look like frames, not like finished content", () => {
  test("a Banner N label and nothing else", () => {
    assert.equal(INTERIORS_PROMO_PLACEHOLDER_PREFIX, "Banner");
    const carousel = code(read(CAROUSEL));
    assert.match(
      carousel,
      /const label = `\$\{INTERIORS_PROMO_PLACEHOLDER_PREFIX\} \$\{index \+ 1\}`/
    );
    assert.match(carousel, /className="od-int-promo__emptyLabel">\{label\}/);
  });

  test("no promotional copy is rendered by the carousel", () => {
    const carousel = code(read(CAROUSEL));
    for (const gone of [
      "od-int-promo__eyebrow",
      "od-int-promo__title",
      "od-int-promo__body",
      "od-int-promo__cta",
      "od-int-promo__scrim",
      "od-int-promo__copy",
    ]) {
      assert.doesNotMatch(carousel, new RegExp(gone), `${gone} must be gone`);
    }
    // And the stylesheet does not keep the rules alive for a future accident.
    const css = read(CSS);
    for (const gone of ["od-int-promo__cta", "od-int-promo__scrim", "od-int-promo__title"]) {
      assert.doesNotMatch(css, new RegExp(`\\.${gone}`), `${gone} CSS must be gone`);
    }
  });

  test("no image element renders while the slots are empty", () => {
    /*
     * The `<Image>` branch is retained so that adding a path is the only
     * change a campaign needs — but it is behind `slide.image`, and no slot
     * has one, so this build issues no image request at all.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /slide\.image \? \(/);
    assert.match(carousel, /<Image/);
    assert.match(carousel, /src=\{slide\.image\}/);
  });

  test("the empty frame is not dressed up as an uploader", () => {
    const css = read(CSS);
    const block = /\.od-int-promo__empty \{[\s\S]*?\n\}/.exec(css);
    assert.ok(block, "the empty frame needs its own rule");
    assert.doesNotMatch(block[0], /dashed|dotted/, "no drop-zone border");
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /Upload|Drop |Choose file|placeholder\.(png|jpg)/i);
  });

  test("no art-direction machinery is left behind", () => {
    const carousel = code(read(CAROUSEL));
    for (const gone of ["getImageProps", "<picture>", "srcSet", "--promo-focal"]) {
      assert.doesNotMatch(
        carousel,
        new RegExp(gone.replace(/[<>/]/g, "\\$&")),
        `${gone} belonged to the two-source model`
      );
    }
    assert.doesNotMatch(read(CSS), /--promo-focal/);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Optional whole-card link                                                 */
/* -------------------------------------------------------------------------- */

describe("a banner links as a whole card or not at all", () => {
  test("href present makes the card a real link; absent makes it inert", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /slide\.href \? \(/);
    assert.match(carousel, /<Link\s+href=\{slide\.href\}/);
    assert.match(carousel, /<article className=\{frameClass\}>\{body\}<\/article>/);
    // No click-div pretending to be a link, and no button inside a banner.
    assert.doesNotMatch(carousel, /<div[^>]*onClick/);
    assert.doesNotMatch(carousel, /<button[^>]*promo-\$\{/);
  });

  test("a linked banner will have an accessible name", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /alt=\{slide\.imageAlt \?\? ""\}/);
    assert.match(read(CONFIG), /readonly imageAlt\?: string \| null/);
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Geometry                                                                 */
/* -------------------------------------------------------------------------- */

describe("geometry", () => {
  test("mobile: 82vw, exact 9:16, 20px radius, 12px gap, 16px inset", () => {
    const css = read(CSS);
    assert.match(css, /flex: 0 0 min\(82vw, calc\(76vh \* 9 \/ 16\)\)/);
    assert.match(css, /\.od-int-promo__frame \{[\s\S]*?aspect-ratio: 9 \/ 16/);
    assert.match(css, /\.od-int-promo__frame \{[\s\S]*?border-radius: 20px/);
    assert.match(css, /gap: 12px/);
    assert.match(css, /padding: 0 16px/);
  });

  test("the height guard caps WIDTH so the ratio stays exact", () => {
    /*
     * A `max-height` on a box with `aspect-ratio` is satisfied by distorting
     * or cropping. Capping the width instead makes a short viewport show a
     * smaller card that is still 9:16, which is what the artwork needs.
     */
    const css = read(CSS);
    const frame = /\.od-int-promo__frame \{[\s\S]*?\n\}/.exec(css);
    assert.ok(frame);
    assert.doesNotMatch(frame[0], /max-height/, "the frame must not cap height");
    assert.match(css, /calc\(76vh \* 9 \/ 16\)/);
    assert.match(css, /calc\(70vh \* 9 \/ 16\)/);
  });

  test("desktop: more cards, not a bigger one — and never a billboard", () => {
    const css = read(CSS);
    assert.match(css, /flex: 0 0 min\(clamp\(300px, 26vw, 360px\), calc\(70vh \* 9 \/ 16\)\)/);
    assert.match(css, /@media \(min-width: 48rem\)[\s\S]*?border-radius: 24px/);
    assert.match(css, /@media \(min-width: 48rem\)[\s\S]*?gap: 22px/);
    // The old single-banner desktop layout must not come back.
    assert.doesNotMatch(css, /flex: 0 0 92vw/);
    assert.doesNotMatch(css, /flex: 0 0 94%/);
  });

  test("the rail scrolls but the document never does", () => {
    const css = read(CSS);
    assert.match(css, /\.od-int-promo \{[^}]*overflow: clip/);
    assert.match(css, /overscroll-behavior-x: contain/);
    assert.match(css, /scroll-snap-type: x mandatory/);
    assert.match(css, /scroll-snap-align: start/);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. Interaction                                                              */
/* -------------------------------------------------------------------------- */

describe("interaction", () => {
  test("autoplay dwells at about 5.5 seconds", () => {
    assert.ok(
      INTERIORS_PROMO_AUTOPLAY_MS >= 5000 && INTERIORS_PROMO_AUTOPLAY_MS <= 6000,
      `autoplay ${INTERIORS_PROMO_AUTOPLAY_MS}ms must sit in the 5-6s band`
    );
  });

  test("every movement is one card, never one viewport", () => {
    /*
     * Scrolling by `clientWidth` would jump three or four banners at a desktop
     * width and skip whatever the visitor was reading.
     */
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /clientWidth\s*[,)]?\s*behavior/);
    assert.doesNotMatch(carousel, /scrollBy/);
    assert.match(carousel, /goTo\(active >= maxIndex \|\| atScrollEnd \? 0 : active \+ 1\)/);
    assert.match(carousel, /goTo\(rail\.scrollLeft <= SCROLL_EPSILON \? maxIndex : active - 1\)/);
    // Autoplay uses the same one-card step as the arrow.
    assert.match(carousel, /setTimeout\(goNext, INTERIORS_PROMO_AUTOPLAY_MS\)/);
  });

  test("the loop point is measured, not assumed", () => {
    /*
     * With four cards visible, card 6 can never sit at the start of the rail —
     * it runs out of scrollable width three cards earlier. Hard-coding
     * `slideCount - 1` as the last position would leave autoplay stuck against
     * the end.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /rail\.scrollWidth - rail\.clientWidth/);
    assert.match(carousel, /setMaxIndex\(reachable\)/);
    assert.match(carousel, /hidden=\{index > maxIndex\}/);
    /*
     * The loop point is `maxIndex`, not the raw scroll end. At 1440 the last
     * reachable card lands with scroll still available, so testing only the
     * scroll position left a dead beat where the rail crept forward but the
     * leading card never changed.
     */
    assert.match(carousel, /active >= maxIndex \|\| atScrollEnd/);
    /*
     * And the active index is clamped to that range, or the final swipe on a
     * phone lights no dot at all — the nearest card edge there is the last
     * one, whose dot is hidden because it can never lead.
     */
    assert.match(carousel, /setActive\(Math\.min\(nearest, reachable\)\)/);
  });

  test("the active card is the leading one, computed from scroll position", () => {
    const carousel = code(read(CAROUSEL));
    // An IntersectionObserver reports every visible card, which is useless
    // when four are visible at once.
    assert.doesNotMatch(carousel, /IntersectionObserver/);
    assert.match(carousel, /Math\.abs\(offset - rail\.scrollLeft\)/);
    assert.match(carousel, /setActive\(Math\.min\(nearest, reachable\)\)/);
    assert.match(carousel, /new ResizeObserver/);
  });

  test("swipe is the platform's, not a hand-rolled drag handler", () => {
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /onTouchMove|onDragStart|clientX/);
    assert.match(read(CSS), /overflow-x: auto/);
  });

  test("autoplay pauses for hover, focus and touch, and resumes after", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(
      carousel,
      /const paused = reducedMotion \|\| hovered \|\| focusWithin \|\| pointerDown/
    );
    assert.match(carousel, /onMouseEnter=\{\(\) => setHovered\(true\)\}/);
    assert.match(carousel, /onMouseLeave=\{\(\) => setHovered\(false\)\}/);
    assert.match(carousel, /onFocusCapture=\{\(\) => setFocusWithin\(true\)\}/);
    assert.match(carousel, /onBlurCapture=\{\(\) => setFocusWithin\(false\)\}/);
    // A cancelled gesture must clear the pause, or autoplay never restarts.
    assert.match(carousel, /onPointerCancel=\{\(\) => setPointerDown\(false\)\}/);
  });

  test("arrow keys, Home and End move between slides", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /event\.key === "ArrowRight"/);
    assert.match(carousel, /event\.key === "ArrowLeft"/);
    assert.match(carousel, /event\.key === "Home"/);
    assert.match(carousel, /event\.key === "End"/);
    // Keyboard movement respects the reachable range.
    assert.match(carousel, /Math\.min\(index \+ 1, maxIndex\)/);
    assert.match(carousel, /nextIndex = maxIndex/);
    // Focus follows selection, or a keyboard user loses their place.
    assert.match(carousel, /dotRefs\.current\[nextIndex\]\?\.focus\(\)/);
  });

  test("reduced motion disables autoplay and the sliding animation", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /usePrefersReducedMotion/);
    assert.match(carousel, /reducedMotion \|\| hovered/);
    assert.match(carousel, /behavior: reducedMotion \? "auto" : "smooth"/);
    assert.match(
      read(CSS),
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?scroll-behavior: auto/
    );
  });

  test("controls are real buttons and nothing shouts on a timer", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /role="group" aria-label="Choose promotion"/);
    assert.match(carousel, /aria-label="Previous promotion"/);
    assert.match(carousel, /aria-label="Next promotion"/);
    assert.match(carousel, /aria-pressed=\{index === active\}/);
    assert.doesNotMatch(carousel, /aria-live/);
    assert.doesNotMatch(carousel, /role="tab"|role="tablist"|role="tabpanel"/);
    assert.match(carousel, /aria-roledescription="carousel"/);
    assert.match(carousel, /aria-roledescription="slide"/);
  });

  test("no carousel library was added", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const banned of [
      "swiper",
      "slick-carousel",
      "react-slick",
      "embla-carousel",
      "keen-slider",
    ]) {
      assert.ok(!all.includes(banned), `${banned} must not be a dependency`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Page composition                                                         */
/* -------------------------------------------------------------------------- */

describe("/interiors composition", () => {
  test("the rail precedes the hero, and the hero is mounted once", () => {
    const page = code(read(PAGE));
    const promo = page.indexOf("<InteriorsPromoCarousel />");
    const hero = page.indexOf("<HomeHero />");
    assert.ok(promo > 0 && hero > 0);
    assert.ok(promo < hero, "the rail must come before the hero");
    assert.equal((page.match(/<HomeHero \/>/g) ?? []).length, 1);
    assert.equal((page.match(/<InteriorsPromoCarousel \/>/g) ?? []).length, 1);
  });

  test("the section order contract matches what is rendered", () => {
    const order = readInteriorsSectionOrder();
    assert.deepEqual(order.slice(0, 3), ["header", "promo-carousel", "hero"]);
    assert.ok(!order.includes("trust"));
  });

  test("the second proof counter stays removed", () => {
    assert.doesNotMatch(code(read(PAGE)), /DiscoveryProofStrip/);
    assert.ok(
      existsSync(
        join(root, "src/features/public-site/discovery/DiscoveryProofStrip.tsx")
      ),
      "the component must not be deleted"
    );
  });

  test("exactly one credibility system remains", () => {
    const page = code(read(PAGE));
    for (const second of [
      "DiscoveryProofStrip",
      "DiscoveryHeroTrustBar",
      "VerifiedMetricCounter",
    ]) {
      assert.doesNotMatch(page, new RegExp(second));
    }
    assert.match(code(read(HERO)), /pm-hero__credibility/);
  });

  test("the carousel logic did not leak into the page file", () => {
    const page = code(read(PAGE));
    assert.doesNotMatch(page, /useState|useEffect|ResizeObserver|scrollTo/);
    assert.ok(page.split("\n").length < 90, "the page should stay a running order");
  });

  test("the hero was moved, not redesigned", () => {
    const hero = code(read(HERO));
    for (const kept of [
      "pm-hero__title",
      "PM_HERO.serviceLine",
      "PM_HERO.lede",
      "pm-hero__media",
      "hero-start-plan",
      "hero-estimate",
      "pm-hero__credibility",
      "pm-hero__areas",
      "HOME_PUNE_AREAS",
      "<noscript>",
    ]) {
      assert.match(hero, new RegExp(kept.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 7. The one animated counter                                                 */
/* -------------------------------------------------------------------------- */

describe("hero credibility counts numbers and prints words", () => {
  test("cells declare what they are instead of being parsed", () => {
    for (const item of PM_CREDIBILITY) {
      assert.ok(item.kind === "count" || item.kind === "static");
      if (item.kind === "count") {
        assert.ok(
          Number.isInteger(item.value),
          `${item.id} must be an integer to count safely`
        );
      } else {
        assert.equal(typeof item.stat, "string");
      }
    }
  });

  test("the words stay words", () => {
    const byId = new Map(PM_CREDIBILITY.map((item) => [item.id, item]));
    for (const id of ["manufacturing", "process"]) {
      assert.equal(byId.get(id)?.kind, "static", `${id} must never animate`);
    }
    assert.equal(pmCredibilityText(byId.get("manufacturing")!), "Own");
    assert.equal(pmCredibilityText(byId.get("process")!), "End To End");
    // The rating is decimal, so it is static by design even when quotable.
    if (canQuotePublicClaim("average-rating")) {
      assert.equal(byId.get("rating")?.kind, "static");
    }
  });

  test("the numbers count, with their suffixes left alone", () => {
    const byId = new Map(PM_CREDIBILITY.map((item) => [item.id, item]));
    if (canQuotePublicClaim("projects-delivered")) {
      assert.equal(
        pmCredibilityText(byId.get("projects")!),
        `${HOME_CLAIMS.projectsDelivered}+`
      );
    }
    if (canQuotePublicClaim("warranty-years")) {
      assert.equal(
        pmCredibilityText(byId.get("warranty")!),
        `${HOME_CLAIMS.warrantyYears}-Year`
      );
    }
    assert.match(
      code(read(HERO)),
      /\{item\.prefix \?\? ""\}\s*\{value\}\s*\{item\.suffix \?\? ""\}/
    );
  });

  test("assistive technology gets the final value once, not every frame", () => {
    const hero = code(read(HERO));
    assert.match(hero, /<span className="od-sr-only">\s*\{finalText\} \{item\.label\}/);
    assert.match(hero, /className="pm-hero__credStat" aria-hidden="true"/);
  });

  test("the server render carries the real figure, and gating is unchanged", () => {
    const hook = code(read("src/features/public-site/motion/useCountUp.ts"));
    assert.match(hook, /useState<number>\(target\)/);
    assert.doesNotMatch(hook, /useState\(0\)/);
    assert.match(hook, /finished\.current = true/);
    assert.match(read(HERO), /useCountUp\(item\.value\)/);
    const content = code(read("src/features/public-site/home-r4/content.ts"));
    assert.match(content, /canQuotePublicClaim\("projects-delivered"\)/);
    assert.match(content, /canQuotePublicClaim\("average-rating"\)/);
    assert.match(content, /canQuotePublicClaim\("warranty-years"\)/);
  });
});

/* -------------------------------------------------------------------------- */
/* 8. Contact actions must not regress                                         */
/* -------------------------------------------------------------------------- */

describe("the earlier contact work still holds", () => {
  test("header CTA absent, sticky Call Now present, one FAB per surface", () => {
    const shell = code(read("src/features/public-site/home-r4/HomeShell.tsx"));
    assert.match(shell, /showConsultation=\{false\}/);

    const sticky = code(
      read("src/features/public-site/home-r4/HomeStickyActions.tsx")
    );
    assert.match(sticky, /data-conversion-action="sticky-continue"/);
    assert.match(sticky, /data-conversion-action="sticky-call"/);
    assert.match(sticky, /href=\{callHref\}/);
    assert.doesNotMatch(sticky, /sticky-estimate/);

    assert.equal(
      (code(read(PAGE)).match(/<DiscoveryWhatsAppFab \/>/g) ?? []).length,
      1,
      "/interiors keeps exactly one WhatsApp FAB"
    );
    assert.equal(
      (
        code(read("src/features/public-site/discovery/DiscoveryHomePage.tsx")).match(
          /<DiscoveryWhatsAppFab \/>/g
        ) ?? []
      ).length,
      1,
      "the homepage keeps exactly one WhatsApp FAB"
    );
  });

  test("the homepage did not gain a promotional rail", () => {
    const home = code(read("src/features/public-site/discovery/DiscoveryHomePage.tsx"));
    assert.doesNotMatch(home, /InteriorsPromoCarousel/);
  });

  test("the estimator survived the reorder", () => {
    assert.match(code(read(PAGE)), /<HomeBudgetEstimator \/>/);
  });
});

/* -------------------------------------------------------------------------- */
/* 9. Headings                                                                 */
/* -------------------------------------------------------------------------- */

describe("the page keeps exactly one H1", () => {
  test("the hero owns it and the rail does not compete", () => {
    assert.match(code(read(HERO)), /<h1 id="pm-hero-title"/);
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /<h1[\s>]/);
    assert.match(carousel, /<h2 id=\{labelId\} className="od-sr-only">/);
    // No per-slide heading at all now that the slots carry no copy.
    assert.doesNotMatch(carousel, /<h3[\s>]/);
  });
});
