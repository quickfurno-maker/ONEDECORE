/**
 * The /interiors promotional carousel, its composition, and the one counter.
 *
 * WHAT THIS SUITE IS DEFENDING
 *
 *  1. Invented offers. The carousel is the surface a discount would land on,
 *     and the owner has published none. A slide announcing "20% off" would be
 *     a claim the business never made, on the page most likely to be shared.
 *
 *  2. Invented destinations. A banner CTA pointing at an anchor that does not
 *     exist fails silently — the page simply does not move — so every internal
 *     target is checked against the components that actually render one.
 *
 *  3. A second H1. Six rotating titles would give the page six competing
 *     headings depending on when a crawler looked.
 *
 *  4. The counter quietly animating something it must not: a decimal that
 *     floors to the wrong number, or a word.
 *
 *  5. The contact work from the previous commit regressing while this page is
 *     being rearranged.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  getEnabledInteriorsPromoSlides,
  INTERIORS_PROMO_AUTOPLAY_MS,
  INTERIORS_PROMO_DESKTOP_RATIO,
  INTERIORS_PROMO_MOBILE_RATIO,
  INTERIORS_PROMO_SLIDES,
} from "../interiors/interiors-promo.ts";
import { PM_CREDIBILITY, pmCredibilityText } from "../home-r4/content.ts";
import { HOME_CLAIMS, canQuotePublicClaim } from "../home-r4/claims.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

/**
 * The page's section-order contract, read from source rather than imported.
 *
 * `InteriorsConversionPage.tsx` imports stylesheets, which `node --test`
 * cannot load. Reading the literal is what the neighbouring suites do, and it
 * asserts the same thing: the array a developer would edit.
 */
function readInteriorsSectionOrder(): readonly string[] {
  const source = read(PAGE);
  const block = /export const INTERIORS_SECTION_ORDER = \[([\s\S]*?)\] as const;/.exec(
    source
  );
  assert.ok(block, "INTERIORS_SECTION_ORDER must be a literal array");
  return Array.from(block[1]!.matchAll(/"([^"]+)"/g)).map((match) => match[1]!);
}

const CAROUSEL = "src/features/public-site/interiors/InteriorsPromoCarousel.tsx";
const PAGE = "src/features/public-site/interiors/InteriorsConversionPage.tsx";
const HERO = "src/features/public-site/home-r4/HomeHero.tsx";
const CSS = "src/features/public-site/interiors/interiors.css";

/* -------------------------------------------------------------------------- */
/* 1. Slide configuration                                                      */
/* -------------------------------------------------------------------------- */

describe("the promo carousel is six configured slots, not six blocks of JSX", () => {
  test("exactly six slots with stable unique ids", () => {
    assert.equal(INTERIORS_PROMO_SLIDES.length, 6);
    const ids = INTERIORS_PROMO_SLIDES.map((slide) => slide.id);
    assert.equal(new Set(ids).size, 6, "slide ids must be unique");
    for (const id of ids) {
      assert.match(id, /^[a-z][a-z0-9-]*$/, `${id} must be a stable slug`);
    }
  });

  test("enabled filtering is what decides what renders", () => {
    assert.equal(getEnabledInteriorsPromoSlides().length, 6);
    const withOneOff = INTERIORS_PROMO_SLIDES.map((slide, index) =>
      index === 2 ? { ...slide, enabled: false } : slide
    );
    const enabled = getEnabledInteriorsPromoSlides(withOneOff);
    assert.equal(enabled.length, 5);
    assert.ok(!enabled.some((slide) => slide.id === INTERIORS_PROMO_SLIDES[2]!.id));
    // Order is the array order, not the filter's accident.
    assert.deepEqual(
      enabled.map((slide) => slide.id),
      withOneOff.filter((slide) => slide.enabled).map((slide) => slide.id)
    );
  });

  test("all slides disabled renders nothing at all", () => {
    const allOff = INTERIORS_PROMO_SLIDES.map((slide) => ({
      ...slide,
      enabled: false,
    }));
    assert.equal(getEnabledInteriorsPromoSlides(allOff).length, 0);
    /*
     * An empty section would leave a banner-height hole above the hero and
     * push the whole page down for nothing.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /if \(slideCount === 0\) \{\s*return null;/);
  });

  test("every slide has two DIFFERENT real image files", () => {
    for (const slide of INTERIORS_PROMO_SLIDES) {
      for (const [which, image] of [
        ["mobile", slide.mobileImage],
        ["desktop", slide.desktopImage],
      ] as const) {
        assert.ok(
          image.src.startsWith("/assets/"),
          `${slide.id} ${which} must be a repository asset`
        );
        assert.ok(
          existsSync(join(root, "public", image.src)),
          `${slide.id} ${which} asset ${image.src} must exist on disk`
        );
        assert.ok(image.width > 0 && image.height > 0, `${slide.id} ${which} size`);
        assert.match(image.focalPoint, /^\d+% \d+%$/, `${slide.id} ${which} focal`);
      }
      /*
       * The two sources must be different files. If a slide used one asset for
       * both, the `<picture>` switch would be decorative and the desktop
       * banner would be the tall mobile artwork stretched wide — the exact
       * thing the responsive source exists to prevent.
       */
      assert.notEqual(
        slide.mobileImage.src,
        slide.desktopImage.src,
        `${slide.id} must not use one asset for both breakpoints`
      );
    }
  });

  test("no slide invents an offer, a price, or a metric", () => {
    const forbidden =
      /\b(\d+\s*%\s*off|% off|flat \d|discount|coupon|promo code|sale ends|offer ends|limited period|EMI|no cost|cashback|free gift|lowest price|starting at ₹|₹\s*\d|guaranteed delivery|award|rated \d)\b/i;
    for (const slide of INTERIORS_PROMO_SLIDES) {
      const copy = [slide.eyebrow, slide.title, slide.body, slide.ctaLabel]
        .filter(Boolean)
        .join(" ");
      assert.doesNotMatch(copy, forbidden, `${slide.id} copy invents an offer`);
      /*
       * No bare numbers in banner copy either. Every figure on this site is
       * claim-gated, and a banner is the easiest place for an ungoverned one
       * to appear.
       */
      assert.doesNotMatch(copy, /\d/, `${slide.id} copy must carry no figures`);
    }
  });

  test("alt text describes the photograph, never a completed project", () => {
    for (const slide of INTERIORS_PROMO_SLIDES) {
      assert.ok(slide.imageAlt.length > 12, `${slide.id} needs honest alt text`);
      assert.doesNotMatch(
        slide.imageAlt,
        /completed project|delivered project|client home|our factory|our showroom/i,
        `${slide.id} alt must not claim provenance the photo does not have`
      );
    }
  });

  test("the authored artwork formats are 9:16 and 12:5", () => {
    assert.equal(INTERIORS_PROMO_MOBILE_RATIO, "9 / 16");
    assert.equal(INTERIORS_PROMO_DESKTOP_RATIO, "12 / 5");
    const css = read(CSS);
    assert.match(css, /aspect-ratio: 9 \/ 16/);
    assert.match(css, /aspect-ratio: 12 \/ 5/);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. CTA destinations                                                         */
/* -------------------------------------------------------------------------- */

describe("banner CTAs point only at destinations that exist", () => {
  test("every href is an on-page anchor or a known route", () => {
    const known = new Set(["/portfolio", "/interiors", "/shop", "/"]);
    for (const slide of INTERIORS_PROMO_SLIDES) {
      if (!slide.href) continue;
      assert.ok(
        slide.href.startsWith("#") || known.has(slide.href),
        `${slide.id} href ${slide.href} is neither an anchor nor a known route`
      );
      assert.doesNotMatch(slide.href, /^https?:/, `${slide.id} must stay internal`);
    }
  });

  test("every anchor target is actually rendered somewhere on /interiors", () => {
    /*
     * A CTA pointing at a missing anchor fails silently: the visitor taps and
     * the page does not move. Checking the source of the components this page
     * composes is the cheapest way to catch a renamed section.
     */
    const rendered = [
      "src/features/public-site/home-r4/HomeServicesRooms.tsx",
      "src/features/public-site/home-r4/HomeFactory.tsx",
      "src/features/public-site/home-r4/HomePlan.tsx",
      "src/features/public-site/home-r4/HomeBudgetEstimator.tsx",
      "src/features/public-site/interiors/InteriorsServiceBlocks.tsx",
      "src/features/public-site/home-r4/content.ts",
    ]
      .map(read)
      .join("\n");

    for (const slide of INTERIORS_PROMO_SLIDES) {
      if (!slide.href?.startsWith("#")) continue;
      const anchor = slide.href.slice(1);
      const literal = new RegExp(`id="${anchor}"`);
      const viaConstant = new RegExp(`${anchor}:\\s*"${anchor}"`);
      assert.ok(
        literal.test(rendered) || viaConstant.test(rendered),
        `${slide.id} targets #${anchor}, which nothing on /interiors renders`
      );
    }
  });

  test("a CTA needs both a label and a destination, or neither renders", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /slide\.ctaLabel && slide\.href \?/);
    // And no banner ships its own lead form.
    assert.doesNotMatch(carousel, /<form|useForm|lead-intake|leadIntake/i);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. Carousel behaviour                                                       */
/* -------------------------------------------------------------------------- */

describe("carousel interaction", () => {
  test("autoplay dwells between five and six seconds", () => {
    assert.ok(
      INTERIORS_PROMO_AUTOPLAY_MS >= 5000 && INTERIORS_PROMO_AUTOPLAY_MS <= 6000,
      `autoplay ${INTERIORS_PROMO_AUTOPLAY_MS}ms must sit in the 5-6s band`
    );
    // Never faster than 4s, which is the floor a reader can keep up with.
    assert.ok(INTERIORS_PROMO_AUTOPLAY_MS > 4000);
  });

  test("autoplay loops and starts on the first slide", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /useState\(0\)/);
    // Modulo wrap in goTo is what makes next-from-last return to the first.
    assert.match(carousel, /\(\(index % slideCount\) \+ slideCount\) % slideCount/);
    assert.match(carousel, /goTo\(active \+ 1\)/);
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
    assert.match(carousel, /onPointerDown=\{\(\) => setPointerDown\(true\)\}/);
    // A cancelled gesture must clear the pause too, or autoplay never restarts.
    assert.match(carousel, /onPointerCancel=\{\(\) => setPointerDown\(false\)\}/);
    assert.match(carousel, /if \(paused \|\| slideCount < 2\) return;/);
  });

  test("swipe is the platform's, not a hand-rolled drag handler", () => {
    /*
     * A scroll-snap rail gets momentum, rubber-banding and snap points from
     * the browser. A JS drag approximates all three and never quite matches
     * how every other swipe on the device feels.
     */
    const css = read(CSS);
    assert.match(css, /scroll-snap-type: x mandatory/);
    assert.match(css, /scroll-snap-align: start/);
    assert.match(css, /overflow-x: auto/);
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /onTouchMove|onDragStart|clientX/);
  });

  test("the rail scrolls but the document never does", () => {
    const css = read(CSS);
    // `clip`, not `hidden`: hidden would make the section a scroll container.
    assert.match(css, /\.od-int-promo \{[^}]*overflow: clip/);
    assert.match(css, /overscroll-behavior-x: contain/);
  });

  test("dots are buttons in a group, not fake tabs", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /role="group" aria-label="Choose promotion"/);
    assert.match(carousel, /aria-pressed=\{index === active\}/);
    assert.doesNotMatch(carousel, /role="tab"|role="tablist"|role="tabpanel"/);
    // Every control is a real button with a name.
    assert.match(carousel, /aria-label="Previous promotion"/);
    assert.match(carousel, /aria-label="Next promotion"/);
    assert.doesNotMatch(carousel, /<div[^>]*onClick/);
  });

  test("arrow keys, Home and End move between slides", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /event\.key === "ArrowRight"/);
    assert.match(carousel, /event\.key === "ArrowLeft"/);
    assert.match(carousel, /event\.key === "Home"/);
    assert.match(carousel, /event\.key === "End"/);
    // Focus follows selection, or a keyboard user loses their place.
    assert.match(carousel, /dotRefs\.current\[nextIndex\]\?\.focus\(\)/);
  });

  test("the active slide is observed from the rail, not assumed", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /new IntersectionObserver/);
    assert.match(carousel, /root: rail/);
    // scrollTo, not scrollIntoView: the latter drags the PAGE to the rail.
    assert.match(carousel, /rail\.scrollTo\(/);
    assert.doesNotMatch(carousel, /scrollIntoView/);
  });

  test("reduced motion disables autoplay and the sliding animation", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /usePrefersReducedMotion/);
    assert.match(carousel, /reducedMotion \|\| hovered/);
    assert.match(carousel, /behavior: reducedMotion \? "auto" : behavior/);
    const css = read(CSS);
    assert.match(
      css,
      /@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\.od-int-promo__rail \{\s*scroll-behavior: auto/
    );
  });

  test("nothing is announced on a timer", () => {
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /aria-live/);
    assert.match(carousel, /aria-roledescription="carousel"/);
    assert.match(carousel, /aria-roledescription="slide"/);
  });

  test("only the first banner is hinted; nothing else is preloaded", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /priority=\{index === 0\}/);
    /*
     * `fetchPriority`, not `priority`. `priority` emits a preload for one
     * specific URL, which on a desktop would fetch the mobile artwork the
     * browser is about to discard in favour of the landscape source.
     */
    assert.match(carousel, /fetchPriority=\{priority \? "high" : undefined\}/);
    assert.doesNotMatch(carousel, /priority=\{priority\}|loading="eager"/);
    assert.match(carousel, /PROMO_SIZES = "\(min-width: 64rem\) 92vw/);
  });

  test("responsive sources switch the file, and both are optimised", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /<picture>/);
    assert.match(carousel, /media="\(min-width: 48rem\)"/);
    /*
     * `getImageProps` for each source: a hand-written `srcSet={path}` would
     * walk past the image optimiser and ship the original at full width, and
     * two CSS-hidden `<Image>` elements would download both files.
     */
    assert.match(carousel, /getImageProps\(\{/);
    assert.match(carousel, /srcSet: desktopSrcSet/);
    assert.match(carousel, /srcSet: mobileSrcSet/);
    assert.match(carousel, /src: slide\.desktopImage\.src/);
    assert.match(carousel, /src: slide\.mobileImage\.src/);
  });

  test("each source is framed by its own focal point", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /"--promo-focal-mobile": slide\.mobileImage\.focalPoint/);
    assert.match(carousel, /"--promo-focal-desktop": slide\.desktopImage\.focalPoint/);
    const css = read(CSS);
    assert.match(css, /object-position: var\(--promo-focal-mobile, 50% 50%\)/);
    assert.match(
      css,
      /@media \(min-width: 48rem\) \{\s*\.od-int-promo__img \{\s*object-position: var\(--promo-focal-desktop/
    );
  });

  test("no carousel library was added", () => {
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const banned of ["swiper", "slick-carousel", "react-slick", "embla-carousel", "keen-slider"]) {
      assert.ok(!all.includes(banned), `${banned} must not be a dependency`);
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Page composition                                                         */
/* -------------------------------------------------------------------------- */

describe("/interiors composition", () => {
  test("the carousel precedes the hero, and the hero is mounted once", () => {
    const page = code(read(PAGE));
    const promo = page.indexOf("<InteriorsPromoCarousel />");
    const hero = page.indexOf("<HomeHero />");
    assert.ok(promo > 0, "the carousel must be mounted");
    assert.ok(hero > 0, "the hero must be mounted");
    assert.ok(promo < hero, "the carousel must come before the hero");
    assert.equal(
      (page.match(/<HomeHero \/>/g) ?? []).length,
      1,
      "exactly one hero"
    );
    assert.equal(
      (page.match(/<InteriorsPromoCarousel \/>/g) ?? []).length,
      1,
      "exactly one carousel"
    );
  });

  test("the section order contract matches what is rendered", () => {
    const order = readInteriorsSectionOrder();
    assert.deepEqual(order.slice(0, 3), ["header", "promo-carousel", "hero"]);
    // The obsolete second-proof slot is gone from the contract.
    assert.ok(!order.includes("trust"));
    // And the contract still describes the rest of the page it always did.
    assert.ok(order.includes("modular-kitchen"));
    assert.ok(order.includes("estimator"));
    assert.ok(order.includes("consultation"));
  });

  test("the second proof counter no longer renders on /interiors", () => {
    // Comment-stripped: the page explains in prose WHY the strip left, and
    // that explanation names it.
    const page = code(read(PAGE));
    assert.doesNotMatch(page, /DiscoveryProofStrip/);
    // But the component survives for a surface with no credibility row.
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
      assert.doesNotMatch(page, new RegExp(second), `${second} must not render here`);
    }
    assert.match(code(read(HERO)), /pm-hero__credibility/);
  });

  test("the carousel logic did not leak into the page file", () => {
    /*
     * The page should read as a running order. Carousel state living here
     * would mean the next campaign change touches the file that describes the
     * whole page.
     */
    const page = code(read(PAGE));
    assert.doesNotMatch(page, /useState|useEffect|IntersectionObserver|scrollTo/);
    assert.ok(page.split("\n").length < 90, "the page should stay a running order");
  });

  test("the hero itself was moved, not redesigned", () => {
    const hero = code(read(HERO));
    for (const kept of [
      "pm-hero__title",
      "PM_HERO.serviceLine",
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
/* 5. The one animated counter                                                 */
/* -------------------------------------------------------------------------- */

describe("hero credibility counts numbers and prints words", () => {
  test("cells declare what they are instead of being parsed", () => {
    for (const item of PM_CREDIBILITY) {
      assert.ok(
        item.kind === "count" || item.kind === "static",
        `${item.id} must declare a kind`
      );
      if (item.kind === "count") {
        assert.equal(typeof item.value, "number");
        assert.ok(Number.isFinite(item.value));
        /*
         * Integers only. `useCountUp` floors its intermediate values, so a
         * decimal would climb to the wrong number and settle there.
         */
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
      const projects = byId.get("projects");
      assert.equal(projects?.kind, "count");
      assert.equal(projects?.kind === "count" && projects.value, HOME_CLAIMS.projectsDelivered);
      assert.equal(pmCredibilityText(projects!), `${HOME_CLAIMS.projectsDelivered}+`);
    }
    if (canQuotePublicClaim("warranty-years")) {
      const warranty = byId.get("warranty");
      assert.equal(warranty?.kind, "count");
      assert.equal(pmCredibilityText(warranty!), `${HOME_CLAIMS.warrantyYears}-Year`);
    }
    const hero = code(read(HERO));
    // Only the digits are animated; prefix and suffix are printed as-is.
    assert.match(hero, /\{item\.prefix \?\? ""\}\s*\{value\}\s*\{item\.suffix \?\? ""\}/);
  });

  test("assistive technology gets the final value once, not every frame", () => {
    const hero = code(read(HERO));
    assert.match(hero, /<span className="od-sr-only">\s*\{finalText\} \{item\.label\}/);
    assert.match(hero, /className="pm-hero__credStat" aria-hidden="true"/);
    assert.match(hero, /className="pm-hero__credLabel" aria-hidden="true"/);
  });

  test("the server render carries the real figure", () => {
    const hook = code(read("src/features/public-site/motion/useCountUp.ts"));
    assert.match(hook, /useState<number>\(target\)/);
    assert.doesNotMatch(hook, /useState\(0\)/);
    assert.match(hook, /finished\.current = true/);
    assert.match(hook, /reduced \? target : value/);
    // One engine, reused — not a second animation implementation.
    assert.match(read(HERO), /from "@\/features\/public-site\/motion\/useCountUp"/);
  });

  test("claim gating is unchanged", () => {
    const content = code(read("src/features/public-site/home-r4/content.ts"));
    assert.match(content, /canQuotePublicClaim\("projects-delivered"\)/);
    assert.match(content, /canQuotePublicClaim\("average-rating"\)/);
    assert.match(content, /canQuotePublicClaim\("warranty-years"\)/);
    // No cell may exist without passing a gate or being a plain statement.
    for (const item of PM_CREDIBILITY) {
      if (item.id === "projects") assert.ok(canQuotePublicClaim("projects-delivered"));
      if (item.id === "rating") assert.ok(canQuotePublicClaim("average-rating"));
    }
  });
});

/* -------------------------------------------------------------------------- */
/* 6. Contact UI must not regress while the page is rearranged                  */
/* -------------------------------------------------------------------------- */

describe("the previous commit's contact work still holds", () => {
  test("header CTA absent, sticky Call Now present, one FAB", () => {
    const shell = code(read("src/features/public-site/home-r4/HomeShell.tsx"));
    assert.match(shell, /showConsultation=\{false\}/);

    const sticky = code(read("src/features/public-site/home-r4/HomeStickyActions.tsx"));
    assert.match(sticky, /data-conversion-action="sticky-continue"/);
    assert.match(sticky, /data-conversion-action="sticky-call"/);
    assert.match(sticky, /href=\{callHref\}/);
    assert.doesNotMatch(sticky, /sticky-estimate/);

    const page = code(read(PAGE));
    assert.equal(
      (page.match(/<DiscoveryWhatsAppFab \/>/g) ?? []).length,
      1,
      "exactly one WhatsApp FAB"
    );
  });

  test("the estimator survived the sticky change and the reorder", () => {
    assert.match(code(read(PAGE)), /<HomeBudgetEstimator \/>/);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. Headings                                                                 */
/* -------------------------------------------------------------------------- */

describe("the page keeps exactly one H1", () => {
  test("the hero owns it and the carousel does not compete", () => {
    assert.match(code(read(HERO)), /<h1 id="pm-hero-title"/);
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /<h1[\s>]/);
    // The carousel labels itself with a visually hidden h2 and titles slides
    // as h3, so the outline stays h1 > h2 > h3.
    assert.match(carousel, /<h2 id=\{labelId\} className="od-sr-only">/);
    assert.match(carousel, /<h3 id=\{headingId\} className="od-int-promo__title">/);
  });
});
