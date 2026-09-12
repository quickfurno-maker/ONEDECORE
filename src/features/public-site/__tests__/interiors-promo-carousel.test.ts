/**
 * The promotional rail on the homepage: one 5:8 format, six empty slots.
 *
 * WHAT THIS SUITE IS DEFENDING
 *
 *  1. The single-source model. The previous build shipped a portrait file and
 *     a landscape file per campaign, which is two exports to keep in step and
 *     two chances for them to say different things. A `desktopImage` field
 *     creeping back would reintroduce that silently.
 *
 *  2. The 5:8 shape. It is the one thing the artwork depends on, and the
 *     easiest way to break it is a `max-height` on a box with `aspect-ratio` —
 *     the browser satisfies the cap by distorting or cropping rather than by
 *     refusing.
 *
 *  3. One card per step. The obvious implementation of "next" on a multi-card
 *     rail scrolls by a viewport, which skips three banners at a time and
 *     leaves a visitor wondering what they missed.
 *
 *  4. Empty meaning UNFILLED, not absent. A slot with no artwork is still a
 *     card: a 5:8 frame with a `Banner N` label, in the real rail, with a real
 *     dot. What it must never be is invented content — no image request, no
 *     copy, no CTA, no dead href. The gate for a card existing is `enabled`
 *     and nothing else; this was briefly changed to artwork and reversed.
 *
 *  5. Everything the previous two commits established on this page.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  getEnabledInteriorsPromoSlides,
  hasInteriorsPromoCreative,
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

  test("the authored format is 5:8 and the CSS agrees", () => {
    /*
     * 5:8, not 9:16. A 9:16 card is the shape of a phone screen, and a rail
     * built from it read as a story viewer however much width came off it —
     * the banner filled the fold and the hero was always a scroll away.
     */
    assert.equal(INTERIORS_PROMO_RATIO, "5 / 8");
    const css = read(CSS);
    assert.match(css, /aspect-ratio: 5 \/ 8/);
    // The old, taller frame must not survive in the active rule.
    assert.doesNotMatch(css, /aspect-ratio: 9 \/ 16/);
    // And no landscape frame survives anywhere.
    assert.doesNotMatch(css, /aspect-ratio: 12 \/ 5/);
  });

  test("the six empty slots are six cards — enabled is the only gate", () => {
    /*
     * THE DECISION THIS LOCKS.
     *
     * It has been taken in both directions. A pass made artwork the gate, so
     * the whole section vanished while the slots were empty; the owner asked
     * for the six-slot slider back, because the slider itself is what is being
     * reviewed and an absent section cannot be reviewed.
     *
     * So `enabled` decides whether a card exists and artwork decides only what
     * is inside it. If this test starts failing because a filter gained an
     * image check, that is the reversal, not a refactor.
     */
    assert.equal(getEnabledInteriorsPromoSlides().length, 6);
    for (const slide of getEnabledInteriorsPromoSlides()) {
      assert.equal(
        hasInteriorsPromoCreative(slide),
        false,
        `${slide.id} is on the rail with no artwork, which is the reviewed state`
      );
    }
  });

  test("a disabled slot is the one thing that removes a card", () => {
    const oneOff = INTERIORS_PROMO_SLIDES.map((slide, index) =>
      index === 2 ? { ...slide, enabled: false } : slide
    );
    const enabled = getEnabledInteriorsPromoSlides(oneOff);
    assert.equal(enabled.length, 5);
    assert.ok(!enabled.some((slide) => slide.id === INTERIORS_PROMO_SLIDES[2]!.id));

    // Artwork does not change the card count in either direction.
    const withArt = INTERIORS_PROMO_SLIDES.map((slide) => ({
      ...slide,
      image: `/assets/promo/${slide.id}.webp`,
    }));
    assert.equal(getEnabledInteriorsPromoSlides(withArt).length, 6);
  });

  test("a blank image string falls to the empty frame, not to a broken image", () => {
    /*
     * `image: ""` is what a cleared config field looks like, and it is the one
     * value a bare truthiness check gets wrong in a way that shows —
     * `<Image src="">` issues a broken request instead of rendering the frame.
     */
    assert.equal(hasInteriorsPromoCreative({ id: "x", enabled: true }), false);
    assert.equal(
      hasInteriorsPromoCreative({ id: "x", enabled: true, image: null }),
      false
    );
    assert.equal(
      hasInteriorsPromoCreative({ id: "x", enabled: true, image: "   " }),
      false
    );
    assert.equal(
      hasInteriorsPromoCreative({ id: "x", enabled: true, image: "/a.webp" }),
      true
    );
  });

  test("only an all-disabled rail renders nothing", () => {
    const allOff = INTERIORS_PROMO_SLIDES.map((slide) => ({
      ...slide,
      enabled: false,
    }));
    assert.equal(getEnabledInteriorsPromoSlides(allOff).length, 0);
    assert.match(code(read(CAROUSEL)), /if \(slideCount === 0\) \{\s*return null;/);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Empty frames — a real card, without its picture yet                      */
/* -------------------------------------------------------------------------- */

describe("an unfilled slot renders as a frame, not as finished content", () => {
  test("a Banner N label and nothing else", () => {
    assert.equal(INTERIORS_PROMO_PLACEHOLDER_PREFIX, "Banner");
    const carousel = code(read(CAROUSEL));
    assert.match(
      carousel,
      /const label = `\$\{INTERIORS_PROMO_PLACEHOLDER_PREFIX\} \$\{index \+ 1\}`/
    );
    assert.match(carousel, /className="od-int-promo__emptyLabel">\{label\}/);
  });

  test("the empty frame has its own styles, and they are not an uploader", () => {
    const css = read(CSS);
    const block = /\.od-int-promo__empty \{[\s\S]*?\n\}/.exec(css);
    assert.ok(block, "the empty frame needs its own rule");
    assert.doesNotMatch(block[0], /dashed|dotted/, "no drop-zone border");
    assert.match(css, /\.od-int-promo__emptyLabel \{/);
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /Upload|Drop |Choose file|placeholder\.(png|jpg)/i);
  });

  test("the card branches on the predicate, never on raw truthiness", () => {
    /*
     * `hasInteriorsPromoCreative(slide)`, not `slide.image ?`. One definition
     * of "has a picture", so the filter, the card and any future caller cannot
     * disagree about a blank string.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /hasInteriorsPromoCreative\(slide\) \? \(/);
    assert.doesNotMatch(carousel, /slide\.image \? \(/);
    assert.match(carousel, /getEnabledInteriorsPromoSlides\(\)/);
    assert.match(carousel, /<Image/);
    assert.match(carousel, /src=\{slide\.image!\}/);
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

  test("no image request is issued while every slot is empty", () => {
    /*
     * The six cards render, but as frames. Not one of them clears
     * `hasInteriorsPromoCreative`, so the `<Image>` branch never mounts and the
     * rail costs no image request at all in this state.
     */
    for (const slide of getEnabledInteriorsPromoSlides()) {
      assert.equal(hasInteriorsPromoCreative(slide), false);
    }
    assert.doesNotMatch(code(read(CAROUSEL)), /Upload|Drop |Choose file|placeholder\.(png|jpg)/i);
  });

  test("a filled slot swaps its frame for the artwork, and nothing else changes", () => {
    /*
     * The real-content path is the point of the empty frames: they are the
     * same card, the same geometry and the same dot as the finished banner
     * will be. Filling one is a config edit, not a component change.
     */
    const mixed = getEnabledInteriorsPromoSlides([
      { id: "promo-1", enabled: true },
      {
        id: "diwali-2026",
        enabled: true,
        image: "/assets/promo/diwali-2026.webp",
        imageAlt: "Diwali interior offer",
        href: "/portfolio",
      },
    ]);
    // Both are cards; only one has a picture.
    assert.equal(mixed.length, 2);
    assert.equal(hasInteriorsPromoCreative(mixed[0]!), false);
    assert.equal(hasInteriorsPromoCreative(mixed[1]!), true);

    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /alt=\{slide\.imageAlt \?\? ""\}/);
    assert.match(carousel, /priority=\{priority\}/);
    assert.match(carousel, /slide\.href \? \(/);
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
  test("each link type gets one control, and no link makes the card inert", () => {
    /*
     * The Website Manager added two more ways for a card to be clickable —
     * an https anchor and a button that opens the canonical planner — so this
     * now checks the whole set rather than just the internal `<Link>`. The
     * invariant is unchanged: the WHOLE CARD is the control, and there is
     * never a second one painted inside the artwork.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /<Link\s+href=\{slide\.href\}/);
    assert.match(carousel, /linkType === "external" && slide\.href \? \(/);
    assert.match(carousel, /linkType === "consultation" \? \(/);
    assert.match(carousel, /<article className=\{frameClass\}>\{body\}<\/article>/);
    // No click-div pretending to be a link.
    assert.doesNotMatch(carousel, /<div[^>]*onClick/);
    // The only button IS the card; nothing is nested inside the frame.
    assert.doesNotMatch(carousel, /\{body\}\s*<button/);
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
  test("mobile: 74vw capped at 60vh, exact 5:8, 20px radius, 12px gap, 16px inset", () => {
    /*
     * The width settled at 74vw a pass ago; the ratio is what changed. The
     * width the owner asked for and the height ceiling are one `min()`, so
     * whichever binds first still yields an exact 5:8 box.
     */
    const css = read(CSS);
    assert.match(css, /flex: 0 0 min\(74vw, calc\(60vh \* 5 \/ 8\)\)/);
    assert.match(css, /\.od-int-promo__frame \{[\s\S]*?aspect-ratio: 5 \/ 8/);
    assert.match(css, /\.od-int-promo__frame \{[\s\S]*?border-radius: 20px/);
    assert.match(css, /gap: 12px/);
    assert.match(css, /padding: 0 16px/);
    // Neither of the previous, taller cards may come back.
    assert.doesNotMatch(css, /flex: 0 0 min\(82vw/);
    assert.doesNotMatch(css, /calc\(60vh \* 9 \/ 16\)/);
  });

  test("the height ceiling is expressed as a WIDTH so the ratio stays exact", () => {
    /*
     * A `max-height` on a box with `aspect-ratio` is satisfied by distorting
     * or cropping. `60vh * 9/16` is the width that produces a 60vh-tall 9:16
     * card, so the ceiling is enforced without the ratio ever being the thing
     * that gives.
     */
    const css = read(CSS);
    const frame = /\.od-int-promo__frame \{[\s\S]*?\n\}/.exec(css);
    assert.ok(frame);
    assert.doesNotMatch(frame[0], /max-height/, "the frame must not cap height");
    assert.doesNotMatch(
      /\.od-int-promo__card \{[\s\S]*?\n\}/.exec(css)![0],
      /max-height/,
      "the card must not cap height either"
    );
    assert.match(css, /calc\(60vh \* 5 \/ 8\)/);
    assert.match(css, /calc\(70vh \* 5 \/ 8\)/);
  });

  test("desktop: more cards, not a bigger one — and never a billboard", () => {
    /*
     * The desktop cap stays at 70vh deliberately. Sweeping it against the
     * built page showed every value from 58vh to 65vh moves 1280 and 1440 from
     * three cards to four, so tightening it is not a shorter rail — it is a
     * different layout, reached by changing a number that looks like it only
     * controls height.
     */
    const css = read(CSS);
    assert.match(css, /flex: 0 0 min\(clamp\(300px, 26vw, 360px\), calc\(70vh \* 5 \/ 8\)\)/);
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
  /**
   * The whole page, in order, as it is actually composed.
   *
   * This is the regression that keeps costing money to rediscover: the rail
   * spent one build ABOVE the hero, and a visitor arriving at onedecore.in met
   * six unexplained frames before anything told them what the company does.
   * Nothing failed — the page rendered, every section was present, and the
   * order was simply wrong.
   *
   * So the order is asserted as one list rather than as a pair of "X before Y"
   * checks. A pairwise test passes happily while a section three places away
   * has moved.
   */
  /*
   * The R5 composition. Twelve sections, mapped by CMS key.
   *
   * The list shrank because three single-service sections, the materials
   * explorer and the locality list left the homepage — see the registry's
   * RETIRED_HOMEPAGE_SECTION_KEYS for what went where.
   */
  const EXPECTED_COMPOSITION = [
    "<HomeHero />",
    "<InteriorsPromoCarousel />",
    "<R5Services />",
    "<R5RoomExplorer />",
    "<R5Why />",
    "<R5Process />",
    "<R5Factory />",
    "<R5Budget />",
    "<R5Portfolio />",
    "<HomeReviews />",
    "<R5Faq />",
    "<HomePlan />",
  ] as const;

  test("the hero opens the page and the rail follows it", () => {
    const page = code(read(PAGE));
    const hero = page.indexOf("<HomeHero />");
    const promo = page.indexOf("<InteriorsPromoCarousel />");
    const services = page.indexOf("<R5Services />");
    assert.ok(hero > 0 && promo > 0 && services > 0);
    assert.ok(hero < promo, "the hero must come before the rail");
    assert.ok(promo < services, "the rail must come before the service sections");
    assert.equal((page.match(/<HomeHero \/>/g) ?? []).length, 1);
    assert.equal((page.match(/<InteriorsPromoCarousel \/>/g) ?? []).length, 1);
  });

  test("every established section is mounted once, in its established order", () => {
    const page = code(read(PAGE));
    const positions = EXPECTED_COMPOSITION.map((tag) => {
      const escaped = tag.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
      const matches = page.match(new RegExp(escaped, "g")) ?? [];
      assert.equal(matches.length, 1, `${tag} must be mounted exactly once`);
      return { tag, at: page.indexOf(tag) };
    });

    const actual = [...positions].sort((a, b) => a.at - b.at).map((p) => p.tag);
    assert.deepEqual(
      actual,
      [...EXPECTED_COMPOSITION],
      "the page composition drifted from the approved order"
    );
  });

  test("the section order contract matches what is rendered", () => {
    const order = readInteriorsSectionOrder();
    assert.deepEqual(order.slice(0, 3), ["header", "hero", "promo-carousel"]);
    // The contract still describes the rest of the established journey.
    assert.deepEqual(
      [...order],
      [
        "header",
        "hero",
        "promo-carousel",
        "complete-interiors",
        "modular-kitchen",
        "wardrobes",
        "renovation",
        "why",
        "factory",
        "estimator",
        "portfolio",
        "materials",
        "process",
        "service-areas",
        "testimonials",
        "faq",
        "consultation",
      ]
    );
    assert.ok(!order.includes("trust"));
    /*
     * The estimator sits between the factory and the portfolio bridge, which is
     * the sequence the page was approved with: prove the manufacturing, offer
     * the estimate, then show the work.
     */
    assert.ok(order.indexOf("factory") < order.indexOf("estimator"));
    assert.ok(order.indexOf("estimator") < order.indexOf("portfolio"));
    assert.ok(order.indexOf("portfolio") < order.indexOf("materials"));
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
    /*
     * The page grew a section map and a config prop when the Website Manager
     * arrived, so the line budget moved. What it must still not contain is
     * CAROUSEL logic — scroll measurement, observers, autoplay state. The page
     * composes; the rail behaves.
     */
    const page = code(read(PAGE));
    assert.doesNotMatch(page, /useState|useEffect|ResizeObserver|scrollTo/);
    assert.ok(page.split("\n").length < 160, "the page should stay a running order");
  });

  test("the hero kept its identity through the reorder and the cleanup", () => {
    /*
     * This test used to list the hero's text blocks as things that must
     * survive. They were removed deliberately in the cleanup pass, so what it
     * defends now is what the hero IS: its background image, its headline, its
     * single CTA and its credibility row. The removals have their own suite in
     * `hero-premium-cleanup.test.ts`.
     */
    const hero = code(read(HERO));
    for (const kept of [
      "pm-hero__title",
      "pm-hero__media",
      "hero-start-plan",
      "pm-hero__credibility",
      "PM_HERO.eyebrow",
      "PM_HERO.primaryCta",
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
    /*
     * The header CTA is off HERE because this shell mounts the sticky bar; the
     * shared header still supports the pill for surfaces that have no other
     * conversion affordance.
     */
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
    assert.match(code(read(PAGE)), /<R5Budget \/>/);
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

/* -------------------------------------------------------------------------- */
/* 10. The interiors experience is the canonical homepage                      */
/* -------------------------------------------------------------------------- */

describe("interiors is the homepage, at exactly one URL", () => {
  const ROOT = "src/app/page.tsx";

  test("the root route renders the shared interiors component", () => {
    /*
     * The SAME component, not a copy. Two implementations look identical on
     * the day they are written and diverge on the first edit — usually the one
     * nobody remembers to make twice.
     */
    const route = code(read(ROOT));
    // It now receives the published Website Manager config; it is still one
    // mount of one shared component.
    assert.match(route, /<InteriorsConversionPage config=\{config\} \/>/);
    assert.match(
      route,
      /from "@\/features\/public-site\/interiors\/InteriorsConversionPage"/
    );
    assert.equal(
      (route.match(/<InteriorsConversionPage /g) ?? []).length,
      1,
      "exactly one mount"
    );
  });

  test("/interiors is a permanent redirect, declared before the filesystem", () => {
    // The route file is gone: a page that renders and then redirects would
    // flash content at a visitor who has already begun reading.
    assert.equal(existsSync(join(root, "src/app/interiors/page.tsx")), false);
    assert.equal(existsSync(join(root, "src/app/interiors")), false);
    const config = read("next.config.ts");
    const block = /async redirects\(\)[\s\S]*?async headers\(\)/.exec(config);
    assert.ok(block, "next.config.ts must declare redirects()");
    assert.match(block[0], /source: "\/interiors"/);
    assert.match(block[0], /destination: "\/"/);
    // `permanent: true` is a 308, which preserves the request method.
    assert.match(block[0], /permanent: true/);
  });

  test("no client-side redirect was used instead", () => {
    const route = code(read(ROOT));
    assert.doesNotMatch(route, /useEffect|router\.(replace|push)|permanentRedirect/);
  });

  test("the root publishes the interiors metadata, canonical at the site root", () => {
    const route = read(ROOT);
    assert.match(route, /Home Interiors & Modular Kitchens in Pune/);
    assert.match(route, /alternates: \{ canonical: SITE_CONFIG\.url \}/);
    assert.match(route, /url: SITE_CONFIG\.url/);
    assert.match(route, /robots: \{ index: true, follow: true \}/);
    // The canonical must not point at the redirect.
    assert.doesNotMatch(route, /absoluteUrl\("interiors"\)/);
    assert.match(route, /export const revalidate = 300;/);
  });

  test("the root fetches nothing the interiors page does not render", () => {
    /*
     * The common homepage read featured commerce categories, featured products
     * and a portfolio preview before it could render. None of that is used
     * here, and leaving those reads running invisibly behind a page that
     * ignores their results would be a cost with no output.
     */
    const route = code(read(ROOT));
    for (const gone of [
      "getPublicCommerceCategories",
      "getPublicCommerceProducts",
      "getFeaturedProjects",
      "DiscoveryHomePage",
      "isShopPublicEnabled",
    ]) {
      assert.doesNotMatch(route, new RegExp(gone), `${gone} must not run from the root`);
    }
    // And nothing made the route dynamic.
    assert.doesNotMatch(route, /cookies\(\)|headers\(\)|force-dynamic/);
  });

  test("the sitemap lists the root and not the redirect", () => {
    const sitemap = read("src/app/sitemap.ts");
    assert.doesNotMatch(sitemap, /absoluteUrl\("interiors"\)/);
    assert.match(sitemap, /url: SITE_CONFIG\.url/);
  });

  test("nothing in the menu routes through the /interiors 308", () => {
    /*
     * The Interiors item used to be here, pointing at `/` so it would not send
     * every visitor through the redirect. It has since left the menu entirely
     * — it pointed at the wordmark's own destination — so what remains to
     * assert is that no menu entry reintroduces the redirect, and that no Home
     * item appears in its place.
     */
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    assert.doesNotMatch(nav, /label: "Interiors"/);
    assert.doesNotMatch(nav, /href: "\/interiors"/);
    // Still no Home item; the wordmark is the home affordance.
    assert.doesNotMatch(nav, /label: "Home"/);
    // And no menu entry points at the site root either.
    assert.doesNotMatch(
      code(read("src/features/public-site/chrome/PublicSiteHeader.tsx")),
      /href === "\/"/
    );
  });

  test("live surfaces link to the canonical URL rather than the redirect", () => {
    for (const rel of [
      "src/features/commerce/public/components/ShopPublicInactive.tsx",
      "src/features/commerce/public/shell/commerce-nav.ts",
    ]) {
      assert.doesNotMatch(
        code(read(rel)),
        /["']\/interiors["']/,
        `${rel} should link to / directly`
      );
    }
  });

  test("About and Contact resolve to real sections on the root page", () => {
    /*
     * The menu has offered these destinations since the common homepage
     * existed. They must still land somewhere now that the Interiors page is
     * the homepage — a menu item scrolling to nothing is worse than no item.
     *
     * Aliases on the sections that already make those arguments, not new
     * sections and certainly not a second contact form.
     */
    const nav = read("src/features/public-site/chrome/public-nav.ts");
    assert.match(nav, /href: "\/#about"/);
    assert.match(nav, /href: "\/#contact"/);

    // The About anchor moved with the section it lives in.
    const why = read("src/features/public-site/homepage-r5/sections/R5Why.tsx");
    assert.match(why, /id="about"/);
    const plan = read("src/features/public-site/home-r4/HomePlan.tsx");
    assert.match(plan, /id="contact"/);
    // The older alias survives for links that already point at it.
    assert.match(plan, /id="consultation"/);

    // Both sections are composed into the page the root renders.
    const page = code(read(PAGE));
    assert.match(page, /<R5Why \/>/);
    assert.match(page, /<HomePlan \/>/);

    // And the anchors carry an offset so the sticky header does not cover them.
    const css = read("src/features/public-site/discovery/discovery.css");
    assert.match(css, /#about,\s+#contact \{[\s\S]*?scroll-margin-top/);
    assert.match(css, /\.od-disc-anchor-alias \{[\s\S]*?scroll-margin-top/);
  });

  test("adding the anchors did not add a second lead path", () => {
    const page = code(read(PAGE));
    assert.equal(
      (page.match(/<LeadConsultationHost>/g) ?? []).length,
      1,
      "exactly one consultation host"
    );
    const plan = code(read("src/features/public-site/home-r4/HomePlan.tsx"));
    assert.doesNotMatch(plan, /<form|HomeLeadCapture/);
    assert.match(plan, /openPlanner/);
  });
});
