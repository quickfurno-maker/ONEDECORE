/**
 * The hero cleanup: what left, what must never leave, and what must stay gone.
 *
 * WHY A SUITE FOR REMOVALS
 *
 * Deletions are the changes that quietly come back. A paragraph is re-added
 * because a later brief asks for "a line explaining what we do"; a placeholder
 * frame is restored because someone wants to preview the geometry again; a
 * chip list reappears in the hero because the section lower down was not
 * noticed. Each one is individually reasonable and each one undoes a decision
 * the owner made after looking at the live page on a phone.
 *
 * So the removals are asserted as absences, next to the things they were
 * removed in FAVOUR of — because the real risk is not that a paragraph comes
 * back, it is that the counter or the CTA goes with it on the way.
 *
 * WHAT THE HERO IS NOW
 *
 *   eyebrow -> headline -> Get Free Consultation -> four credibility cells
 *
 * and then the page. Nothing between the button and the counter, nothing
 * between the counter and `HomeServicesRooms`.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { PM_CREDIBILITY, PM_HERO, pmCredibilityText } from "../home-r4/content.ts";
import { HOME_PUNE_AREAS } from "../home-r4/claims.ts";
import {
  getEnabledInteriorsPromoSlides,
  hasInteriorsPromoCreative,
  INTERIORS_PROMO_SLIDES,
} from "../interiors/interiors-promo.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/**
 * Source with comments stripped.
 *
 * Every `doesNotMatch` below would otherwise be tripped by the comments that
 * explain the removal — this file's own subject matter is words that must not
 * appear, and the explanations necessarily quote them.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const HERO = "src/features/public-site/home-r4/HomeHero.tsx";
const CONTENT = "src/features/public-site/home-r4/content.ts";
const HOME_CSS = "src/features/public-site/home-r4/styles/home-r4.css";
const PAGE = "src/features/public-site/interiors/InteriorsConversionPage.tsx";
const BLOCKS = "src/features/public-site/interiors/InteriorsServiceBlocks.tsx";
const CAROUSEL = "src/features/public-site/interiors/InteriorsPromoCarousel.tsx";
const PROMO_CSS = "src/features/public-site/interiors/interiors.css";

/* -------------------------------------------------------------------------- */
/* 1. The three text blocks are gone, and not replaced                         */
/* -------------------------------------------------------------------------- */

describe("the hero lost its text blocks", () => {
  test("the descriptive paragraph is gone from config and markup", () => {
    assert.ok(
      !("lede" in PM_HERO),
      "PM_HERO must not carry a hero lede at all — an unused field is an invitation"
    );
    assert.doesNotMatch(
      code(read(CONTENT)),
      /From modular kitchens and custom wardrobes/
    );
    assert.doesNotMatch(code(read(HERO)), /pm-hero__lede|PM_HERO\.lede/);
  });

  test("the service line is gone, not shortened", () => {
    assert.ok(!("serviceLine" in PM_HERO));
    assert.doesNotMatch(
      code(read(CONTENT)),
      /Complete Home Interiors · Modular Kitchens/
    );
    assert.doesNotMatch(code(read(HERO)), /pm-hero__serviceLine/);
    /*
     * And no middot-separated service list took its place under another name.
     * This is the shape the removed line had, and the shape a "shorter
     * version" of it would have.
     */
    assert.doesNotMatch(code(read(HERO)), /·[^<]*·/);
  });

  test("the CTA microcopy is gone", () => {
    assert.ok(!("reassurance" in PM_HERO));
    /*
     * The HERO's line, specifically. `PM_PLANNER.reassurance` is a different
     * string with a similar opening — it sits inside the lead form, which this
     * pass does not touch — so matching on "Free initial consultation" alone
     * would assert the wrong thing and fail for a good reason.
     */
    assert.doesNotMatch(
      code(read(CONTENT)),
      /Free initial consultation · No obligation · Edit your plan anytime/
    );
    assert.doesNotMatch(code(read(HERO)), /pm-hero__reassurance|PM_HERO\.reassurance/);
  });

  test("their stylesheet rules went with them", () => {
    // Comments stripped: the note explaining the removal names the old classes.
    const css = code(read(HOME_CSS));
    for (const gone of ["pm-hero__serviceLine", "pm-hero__reassurance"]) {
      assert.doesNotMatch(
        css,
        new RegExp(`\\.${gone}\\s*[,{]`),
        `${gone} has no element left to style`
      );
    }
  });

  test("nothing new was added between the headline and the button", () => {
    /*
     * The failure this catches is a replacement rather than a restoration:
     * a new `pm-hero__*` paragraph class appearing where the old ones were.
     * The hero's copy column may contain exactly these five things.
     */
    const hero = code(read(HERO));
    const copy = /<div className="pm-hero__copy">([\s\S]*?)\n {8}<\/div>/.exec(hero);
    assert.ok(copy, "the hero copy column must still exist");
    const classes = [...copy[1]!.matchAll(/className="(pm-hero__[a-zA-Z]+)"/g)].map(
      (match) => match[1]!
    );
    assert.deepEqual(
      [...new Set(classes)].sort(),
      [
        "pm-hero__actions",
        "pm-hero__credibility",
        "pm-hero__eyebrow",
        "pm-hero__eyebrowDot",
        "pm-hero__title",
      ].sort(),
      "the hero copy column grew or lost an element"
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 2. What the hero must still say                                             */
/* -------------------------------------------------------------------------- */

describe("the hero keeps its eyebrow, headline and one CTA", () => {
  test("the eyebrow is unchanged", () => {
    assert.equal(PM_HERO.eyebrow, "Pune's Complete Interior Design & Build Company");
    assert.match(code(read(HERO)), /\{PM_HERO\.eyebrow\}/);
  });

  test("the headline is unchanged, all four lines of it", () => {
    assert.deepEqual(
      PM_HERO.titleLines.map((line) => line.text),
      ["Beautiful Homes.", "Designed, Built", "& Delivered by", "One Team."]
    );
    // The gold emphasis sits on the second line and only there.
    assert.deepEqual(
      PM_HERO.titleLines.map((line) => line.emphasize),
      [false, true, false, false]
    );
    assert.match(code(read(HERO)), /<h1 id="pm-hero-title" className="pm-hero__title">/);
  });

  test("one button, still Get Free Consultation, still opening the planner", () => {
    const hero = code(read(HERO));
    assert.equal(PM_HERO.primaryCta, "Get Free Consultation");
    assert.match(hero, /\{PM_HERO\.primaryCta\}/);
    assert.match(hero, /data-conversion-action="hero-start-plan"/);
    assert.match(hero, /openPlanner\(getNextIncompleteStep\(\)\)/);

    const actions = /<div className="pm-hero__actions">([\s\S]*?)<\/div>/.exec(hero);
    assert.ok(actions);
    assert.equal((actions[1]!.match(/<button/g) ?? []).length, 1, "exactly one hero CTA");
    // The second CTA stays gone as well.
    assert.doesNotMatch(hero, /hero-estimate|Get Price Estimate|PM_HERO\.secondaryCta/);
  });

  test("the background image and its priority hint are untouched", () => {
    const hero = code(read(HERO));
    assert.match(hero, /className="pm-hero__media"/);
    assert.match(hero, /priority/);
    assert.match(hero, /fetchPriority="high"/);
    assert.match(hero, /objectPosition: HERO\.focalPoint/);
  });
});

/* -------------------------------------------------------------------------- */
/* 3. The four-card counter is the thing that must not move                    */
/* -------------------------------------------------------------------------- */

describe("the animated credibility block survives the cleanup intact", () => {
  test("exactly four cells, in their approved order", () => {
    assert.equal(PM_CREDIBILITY.length, 4, "the counter block is four cards");
    assert.deepEqual(
      PM_CREDIBILITY.map((item) => item.label),
      [
        "Projects Delivered",
        "Manufacturing Unit",
        "Warranty",
        "Design To Installation",
      ]
    );
  });

  test("every approved figure still reads exactly as approved", () => {
    const byLabel = new Map(
      PM_CREDIBILITY.map((item) => [item.label, pmCredibilityText(item)])
    );
    assert.equal(byLabel.get("Projects Delivered"), "1000+");
    assert.equal(byLabel.get("Manufacturing Unit"), "Own");
    assert.equal(byLabel.get("Warranty"), "10-Year");
    assert.equal(byLabel.get("Design To Installation"), "End To End");
  });

  test("End To End was not dropped in a three-item simplification", () => {
    /*
     * Named separately because it is the cell a "tidy the hero" pass removes
     * first: it is the longest label and the only one that is not a number.
     */
    const process = PM_CREDIBILITY.find((item) => item.id === "process");
    assert.ok(process, "the process cell must exist");
    assert.equal(pmCredibilityText(process), "End To End");
    assert.equal(process.kind, "static", "it is a word and must never animate");
  });

  test("the counting engine is still wired to the cells", () => {
    const hero = code(read(HERO));
    assert.match(hero, /useCountUp\(item\.value\)/);
    assert.match(hero, /function CountedCredibilityCell/);
    assert.match(hero, /className="pm-hero__credStat" aria-hidden="true"/);
    // The accessible text is still the final value, stated once.
    assert.match(hero, /<span className="od-sr-only">\s*\{finalText\} \{item\.label\}/);
  });

  test("the block is still mounted, and still as a 2x2 that becomes a row", () => {
    assert.match(
      code(read(HERO)),
      /<div className="pm-hero__credibility" aria-label="ONEDECORE credibility">/
    );
    const css = read(HOME_CSS);
    assert.match(
      css,
      /\.pm-hero__credibility \{[\s\S]*?grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/
    );
    assert.match(
      css,
      /@media \(min-width: 768px\) \{\s*\[data-public-home-r4\] \.pm-hero__credibility \{\s*grid-template-columns: repeat\(4, minmax\(0, 1fr\)\)/
    );
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Pune areas: removed from the hero, preserved lower down                  */
/* -------------------------------------------------------------------------- */

describe("the Pune area list lives in one place, and it is not the hero", () => {
  test("the hero no longer renders areas, a toggle or a noscript fallback", () => {
    const hero = code(read(HERO));
    assert.doesNotMatch(hero, /HOME_PUNE_AREAS/);
    assert.doesNotMatch(hero, /pm-hero__area/);
    assert.doesNotMatch(hero, /areasLabel|areasExpandLabel|areasCollapseLabel/);
    assert.doesNotMatch(hero, /Serving homeowners across Pune/i);
    assert.doesNotMatch(hero, /View all 26/);
    /*
     * The `<noscript>` block existed only to give the area chips a no-JS
     * fallback. The section that replaced them is server-rendered, so there is
     * nothing left for it to cover.
     */
    assert.doesNotMatch(hero, /<noscript>/);
  });

  test("removing the toggle removed the hero's client state with it", () => {
    /*
     * The expander was the only thing in this component holding state. If a
     * `useState` returns here it means something was re-added, not refactored.
     */
    const hero = code(read(HERO));
    assert.doesNotMatch(hero, /useState|useId|useRef|useCallback/);
    // It is still a client component, because the counter needs to be.
    assert.match(hero, /^"use client";/);
  });

  test("the area labels are gone from the hero config too", () => {
    for (const gone of [
      "areasLabel",
      "areasExpandLabel",
      "areasExpandMobileLabel",
      "areasCollapseLabel",
    ]) {
      assert.ok(!(gone in PM_HERO), `PM_HERO.${gone} must not survive`);
    }
  });

  test("the hero's chip stylesheet is gone", () => {
    const css = code(read(HOME_CSS));
    for (const gone of [
      "pm-hero__areas",
      "pm-hero__areasLabel",
      "pm-hero__areasList",
      "pm-hero__area",
      "pm-hero__areasToggleMobile",
      "pm-hero__areasToggleDesktop",
    ]) {
      assert.doesNotMatch(
        css,
        new RegExp(`\\.${gone}\\s*[,:{]`),
        `${gone} has no element left to style`
      );
    }
  });

  test("the dedicated section lower on the page carries all 26 localities", () => {
    /*
     * THE REASON THE HERO BLOCK COULD SIMPLY BE DELETED.
     *
     * `InteriorsServiceAreas` already existed and already rendered the full
     * list — the hero was showing the first six of the same array behind an
     * expander. Nothing had to be moved; the duplicate went.
     */
    const blocks = code(read(BLOCKS));
    assert.match(blocks, /export function InteriorsServiceAreas/);
    assert.match(blocks, /HOME_PUNE_AREAS\.map\(\(area\) => \(/);
    assert.match(blocks, /Interior execution across Pune/);
    assert.equal(HOME_PUNE_AREAS.length, 26);

    // And it is still composed into the homepage, in its established place.
    const page = code(read(PAGE));
    assert.match(page, /<InteriorsServiceAreas \/>/);
    assert.equal((page.match(/<InteriorsServiceAreas \/>/g) ?? []).length, 1);
  });

  test("no area names were invented while consolidating", () => {
    for (const area of ["Kharadi", "Viman Nagar", "Baner", "Wakad", "Hinjewadi", "Hadapsar"]) {
      assert.ok(
        (HOME_PUNE_AREAS as readonly string[]).includes(area),
        `${area} must still be listed`
      );
    }
    assert.equal(new Set(HOME_PUNE_AREAS).size, 26);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. The banner rail: six cards, filled or not                               */
/* -------------------------------------------------------------------------- */

describe("the six-slide rail renders even while the slots are empty", () => {
  test("six slots, six cards", () => {
    /*
     * REVERSED ON PURPOSE, AND THIS IS THE RECORD OF IT.
     *
     * A previous pass made artwork the gate, so an unfilled slot rendered
     * nothing and all six rendered no section at all. The owner asked for the
     * six-slide slider back: the slider is the thing under review, and a
     * section that renders nothing cannot be reviewed. `enabled` is the gate;
     * artwork decides only what is inside a card.
     */
    assert.equal(INTERIORS_PROMO_SLIDES.length, 6);
    assert.equal(getEnabledInteriorsPromoSlides().length, 6);
    for (const slide of getEnabledInteriorsPromoSlides()) {
      assert.equal(
        hasInteriorsPromoCreative(slide),
        false,
        `${slide.id} is on the rail without artwork, which is the reviewed state`
      );
    }
  });

  test("an unfilled card is a labelled frame, not an empty box", () => {
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /hasInteriorsPromoCreative\(slide\) \? \(/);
    assert.match(carousel, /INTERIORS_PROMO_PLACEHOLDER_PREFIX/);
    assert.match(carousel, /className="od-int-promo__empty"/);
    assert.match(code(read(PROMO_CSS)), /\.od-int-promo__empty \{/);
  });

  test("the controls are real: dots for every card, arrows on pointer widths", () => {
    /*
     * A rail whose dots disappeared with its cards would look like a static
     * banner. Six cards means six dots, minus whichever the measured rail
     * cannot actually reach at a given width.
     */
    const carousel = code(read(CAROUSEL));
    assert.match(carousel, /className="od-int-promo__dots"/);
    assert.match(carousel, /hidden=\{index > maxIndex\}/);
    assert.match(carousel, /aria-label="Previous promotion"/);
    assert.match(carousel, /aria-label="Next promotion"/);
  });

  test("swipe is still the platform's own, with the peek intact", () => {
    /*
     * No drag handler was introduced or removed: the rail is an overflow
     * container with scroll snapping, which is what makes touch dragging feel
     * native and keeps the next card peeking at the edge.
     */
    const carousel = code(read(CAROUSEL));
    assert.doesNotMatch(carousel, /onTouchMove|onDragStart|clientX/);
    const css = read(PROMO_CSS);
    assert.match(css, /overflow-x: auto/);
    assert.match(css, /scroll-snap-type: x mandatory/);
    assert.match(css, /flex: 0 0 min\(74vw, calc\(60vh \* 5 \/ 8\)\)/);
    assert.match(css, /aspect-ratio: 5 \/ 8/);
  });

  test("a filled slot still renders its artwork", () => {
    const mixed = getEnabledInteriorsPromoSlides([
      { id: "promo-1", enabled: true },
      {
        id: "promo-2",
        enabled: true,
        image: "/assets/promo/banner-2.webp",
        imageAlt: "Festive modular kitchen offer",
      },
    ]);
    assert.equal(mixed.length, 2);
    assert.equal(hasInteriorsPromoCreative(mixed[1]!), true);
    assert.match(code(read(CAROUSEL)), /src=\{slide\.image!\}/);
  });

  test("a disabled slot is still the way to take a card off the rail", () => {
    const allOff = INTERIORS_PROMO_SLIDES.map((slide) => ({ ...slide, enabled: false }));
    assert.equal(getEnabledInteriorsPromoSlides(allOff).length, 0);
    assert.match(code(read(CAROUSEL)), /if \(slideCount === 0\) \{\s*return null;/);
  });

  test("the rail sits between the hero and the service sections", () => {
    const page = code(read(PAGE));
    assert.equal((page.match(/<InteriorsPromoCarousel \/>/g) ?? []).length, 1);
    const hero = page.indexOf("<HomeHero />");
    const promo = page.indexOf("<InteriorsPromoCarousel />");
    const services = page.indexOf("<HomeServicesRooms />");
    assert.ok(hero < promo && promo < services);
  });
});

/* -------------------------------------------------------------------------- */
/* 6. The approved contact surfaces are untouched                              */
/* -------------------------------------------------------------------------- */

describe("the cleanup changed no call to action outside the hero", () => {
  test("exactly one WhatsApp FAB is still mounted on the homepage", () => {
    const page = code(read(PAGE));
    assert.equal((page.match(/<DiscoveryWhatsAppFab \/>/g) ?? []).length, 1);
  });

  test("the sticky bar still carries Free Consultation and Call Now", () => {
    const sticky = code(read("src/features/public-site/home-r4/HomeStickyActions.tsx"));
    assert.match(sticky, /data-conversion-action="sticky-continue"/);
    assert.match(sticky, /data-conversion-action="sticky-call"/);
    assert.match(sticky, /href=\{callHref\}/);
    assert.doesNotMatch(sticky, /sticky-estimate/);
  });

  test("no phone or WhatsApp number was written into the hero", () => {
    assert.doesNotMatch(read(HERO), /\+91\d|wa\.me\/\d|tel:/);
  });

  test("the hero CTA opens the same canonical form as everything else", () => {
    /*
     * One planner, one host. The hero button calls `openPlanner` through the
     * shared context rather than mounting anything of its own.
     */
    const hero = code(read(HERO));
    assert.match(hero, /usePlan\(\)/);
    assert.doesNotMatch(hero, /<form|UnifiedLeadBrief|LeadConsultationHost/);
    assert.equal((code(read(PAGE)).match(/<LeadConsultationHost>/g) ?? []).length, 1);
  });
});

/* -------------------------------------------------------------------------- */
/* 7. The hero entrance                                                        */
/* -------------------------------------------------------------------------- */

describe("the hero copy enters once, in reading order, without moving the page", () => {
  /*
   * The stylesheet with line endings normalised.
   *
   * The repo is checked out CRLF on Windows, and the assertions below anchor
   * blocks on a `}` at the start of a line. Without this they match nothing
   * and the section passes vacuously, which is worse than failing.
   */
  const css = () => read(HOME_CSS).replace(/\r\n/g, "\n");

  /** The `prefers-reduced-motion: no-preference` block that owns the entrance. */
  const entranceBlock = () => {
    const source = css();
    const start = source.indexOf(
      "@media (prefers-reduced-motion: no-preference) {\n  [data-public-home-r4] .pm-hero__mediaImg"
    );
    assert.ok(start > 0, "the hero entrance block must exist");
    const end = source.indexOf("\n}\n", start);
    assert.ok(end > start, "the hero entrance block must be closed");
    return source.slice(start, end);
  };

  test("it is CSS keyframes, and no dependency was added for it", () => {
    /*
     * The repo has no animation library and must not gain one for four fading
     * elements. `Reveal`/`RevealRuntime` exists but is an IntersectionObserver
     * for content a visitor scrolls to — pointing it at an above-the-fold hero
     * would make the opening of the page wait for hydration.
     */
    const pkg = JSON.parse(read("package.json")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const all = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const banned of [
      "framer-motion",
      "motion",
      "gsap",
      "animejs",
      "react-spring",
      "@react-spring/web",
      "aos",
      "lottie-web",
      "react-transition-group",
    ]) {
      assert.ok(!all.includes(banned), `${banned} must not be a dependency`);
    }
    assert.doesNotMatch(code(read(HERO)), /Reveal|framer|gsap/);
  });

  test("eyebrow, headline, CTA and counter each have a step, in that order", () => {
    const block = entranceBlock();
    const delayOf = (selector: string) => {
      const rule = new RegExp(
        "\\." +
          selector +
          " \\{[\\s\\S]*?animation: pm-[a-z-]+ \\d+ms var\\(--pm-ease-out\\) (\\d+)ms forwards"
      ).exec(block);
      assert.ok(rule, `${selector} must have a delayed entrance`);
      return Number(rule[1]);
    };

    const eyebrow = delayOf("pm-hero__eyebrow");
    const actions = delayOf("pm-hero__actions");
    const credibility = delayOf("pm-hero__credibility");

    // The headline is staggered arithmetically rather than by fixed delays.
    assert.match(
      block,
      /\.pm-hero__line \{[\s\S]*?animation-delay: calc\((\d+)ms \+ var\(--pm-line, 0\) \* (\d+)ms\)/
    );
    const [, base, step] = /animation-delay: calc\((\d+)ms \+ var\(--pm-line, 0\) \* (\d+)ms\)/.exec(
      block
    )!;
    const lastLine = Number(base) + 3 * Number(step);

    assert.ok(eyebrow < Number(base), "the eyebrow leads the headline");
    assert.ok(Number(step) >= 70 && Number(step) <= 110, `stagger ${step}ms must be 70-110ms`);
    assert.ok(actions >= lastLine, "the button follows the last headline line");
    assert.ok(credibility > actions, "the counter enters last");
  });

  test("the stagger is driven by --pm-line, set once per line in the component", () => {
    assert.match(code(read(HERO)), /style=\{\{ "--pm-line": index \} as React\.CSSProperties\}/);
  });

  test("only opacity and transform move, so the entrance cannot shift layout", () => {
    /*
     * A hero that animates height, margin or font-size reflows the page under
     * the visitor's thumb and shows up as CLS. Both keyframes used here move a
     * translate and an opacity, and nothing else.
     */
    const source = css();
    for (const name of ["pm-rise", "pm-line-in"]) {
      const frames = new RegExp("@keyframes " + name + " \\{[\\s\\S]*?\\n\\}").exec(source);
      assert.ok(frames, `${name} must exist`);
      const props = [...frames[0].matchAll(/^\s{4}([a-z-]+):/gm)].map((m) => m[1]);
      assert.deepEqual(
        [...new Set(props)].sort(),
        ["opacity", "transform"],
        `${name} may only animate opacity and transform`
      );
    }
    // And the travel stays in the restrained band the hero was tuned to.
    const rise = /@keyframes pm-rise \{[\s\S]*?translate3d\(0, (\d+)px, 0\)/.exec(source)!;
    const line = /@keyframes pm-line-in \{[\s\S]*?translate3d\(0, (\d+)px, 0\)/.exec(source)!;
    for (const [name, match] of [["pm-rise", rise], ["pm-line-in", line]] as const) {
      const px = Number(match[1]);
      assert.ok(px >= 14 && px <= 20, `${name} travels ${px}px, outside the 14-20px band`);
    }
  });

  test("it runs once — forwards, no iteration count, no infinite", () => {
    const block = entranceBlock();
    assert.doesNotMatch(block, /infinite|alternate/);
    // `forwards` holds the end state, so scrolling away and back replays nothing.
    const steps = block.match(/animation: pm-(?:rise|line-in)[^;]*;/g) ?? [];
    assert.ok(steps.length >= 4, "there must be a step per hero element");
    for (const step of steps) {
      assert.match(step, /forwards/, `"${step.trim()}" must hold its final frame`);
    }
  });

  test("reduced motion renders everything immediately", () => {
    const source = css();
    /*
     * Two independent guarantees. First, the `opacity: 0` start states live
     * INSIDE `no-preference`, so under `reduce` they are never applied at all —
     * this is what actually protects the content.
     */
    const block = entranceBlock();
    assert.match(block, /opacity: 0/);
    assert.doesNotMatch(
      source.replace(block, ""),
      /\.pm-hero__(eyebrow|line|actions|credibility) \{[^}]*opacity: 0/,
      "a start state outside the no-preference query would strand the text"
    );

    /*
     * Second, the reduce block cancels animation and forces the end state.
     *
     * The stylesheet has several `reduce` blocks; the one that matters is the
     * global kill-switch, so it is selected by content rather than by being
     * first — picking the first one silently tested a different rule.
     */
    const reduce = [
      ...source.matchAll(/@media \(prefers-reduced-motion: reduce\) \{[\s\S]*?\n\}\n/g),
    ]
      .map((match) => match[0])
      .find((block) => block.includes("animation: none !important"));
    assert.ok(reduce, "the global reduced-motion kill-switch must exist");
    const reduceBlock = [reduce];
    for (const selector of [
      "pm-hero__eyebrow",
      "pm-hero__line",
      "pm-hero__actions",
      "pm-hero__credibility",
    ]) {
      assert.match(
        reduceBlock[0],
        new RegExp("\\." + selector + ","),
        `${selector} must be forced visible under reduced motion`
      );
    }
    assert.match(reduceBlock[0], /opacity: 1 !important/);
    assert.match(reduceBlock[0], /transform: none !important/);
  });

  test("the count-up is untouched and not duplicated by the entrance", () => {
    /*
     * The counter's CONTAINER fades; the digits inside it are still driven by
     * `useCountUp`. Animating the four cells as well would put a second
     * stagger on top of four numbers that are already moving.
     */
    const block = entranceBlock();
    assert.doesNotMatch(block, /pm-hero__credItem|pm-hero__credStat/);
    assert.match(block, /\.pm-hero__credibility \{/);
    assert.match(code(read(HERO)), /useCountUp\(item\.value\)/);
  });

  test("the removed lede left no orphan step behind", () => {
    /*
     * There was a 420ms step for a paragraph that no longer exists. A delay
     * pointing at nothing is invisible until someone re-adds the element and
     * finds it animating on a schedule nobody chose.
     */
    assert.doesNotMatch(entranceBlock(), /pm-hero__lede/);
  });
});
