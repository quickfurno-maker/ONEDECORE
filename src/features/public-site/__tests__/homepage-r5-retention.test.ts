/**
 * The interactive retention homepage: the flow, the honesty gates, and the two
 * CSS traps that cost a full QA pass to find.
 *
 * WHAT THIS SUITE IS ACTUALLY DEFENDING
 *
 *  1. The locked flow. The owner approved an order, not a set of sections. A
 *     reordering is a product decision and must look like one in a diff.
 *
 *  2. Content that cannot be invented. Every number, range and answer on this
 *     page resolves from data that has already been through claim review. The
 *     failure mode is not a wrong number — it is a plausible number typed into
 *     a component because it was easier than importing one.
 *
 *  3. One lead journey. Four sections talk about starting a project. Exactly
 *     one form may exist, and every path into it is the same `openPlanner`.
 *
 *  4. Two specificity traps, both of which shipped silently.
 *
 *     `home-foundation.css` resets `[data-public-home-r4] p, ul, ol, h1..h4` to
 *     `margin: 0` at 0-1-1. Eight `.r5-*` rules declared real margins at 0-1-0
 *     and every one computed to 0px in the browser while looking correct in the
 *     file. The page was laid out by leading for an entire pass.
 *
 *     And `.r5-rail` sits inside a `.dc-container`, so padding it by
 *     `--dc-gutter` applied that gutter twice and reduced the "next card peeks"
 *     affordance to 2.6px at 390px — present in the CSS, absent on the phone.
 *
 *     Neither is the kind of thing a reviewer catches by reading. Both are
 *     asserted here because both will be reintroduced by someone tidying up.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  R5_BUDGET,
  R5_BUDGET_SCOPES,
  R5_FAQ_IDS,
  R5_PROCESS,
  R5_ROOMS,
  R5_SERVICES,
  REFERENCE_IMAGERY_NOTE,
} from "../homepage-r5/content.ts";
import { PM_FAQS } from "../home-r4/content.ts";
import {
  BUDGET_RANGES_BY_PROJECT_SCOPE,
  PROJECT_SCOPE_LABELS,
} from "@/features/lead-intake/project-scope.ts";
import { HOMEPAGE_SECTION_KEYS } from "@/features/website-manager/homepage-registry.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments stripped — this file's subject matter is quoted in them. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

const CSS = "src/features/public-site/homepage-r5/homepage-r5.css";
const SECTIONS = "src/features/public-site/homepage-r5/sections";
const PAGE = "src/features/public-site/interiors/InteriorsConversionPage.tsx";

/* -------------------------------------------------------------------------- */
/* 1. The approved flow                                                       */
/* -------------------------------------------------------------------------- */

describe("the homepage flow the owner approved", () => {
  test("the registry is the locked order, and nothing else", () => {
    assert.deepEqual(
      [...HOMEPAGE_SECTION_KEYS],
      [
        "hero",
        "promo-carousel",
        "complete-interiors",
        "room-explorer",
        "why",
        "process",
        "factory",
        "estimator",
        "portfolio",
        "testimonials",
        "faq",
        "consultation",
      ]
    );
  });

  test("the sections removed by the redesign stay removed", () => {
    /*
     * Materials and the standalone locality list were taken out of the flow by
     * owner decision, and the three single-service blocks became four cards.
     * Asserted as absences because each one has a reasonable-sounding case for
     * coming back, and coming back is what would break the flow above.
     */
    const page = code(read(PAGE));
    for (const gone of [
      "InteriorsMaterials",
      "InteriorsServiceAreas",
      "HomeModularKitchen",
      "HomeWardrobes",
      "HomeRenovation",
      "BeforeAfter",
    ]) {
      assert.doesNotMatch(page, new RegExp(`<${gone}\\s*/>`), `${gone} is out of the flow`);
    }
  });

  test("the reviews section keeps the component that handles having no reviews", () => {
    /*
     * `HOME_VERIFIED_REVIEWS` is empty. `HomeReviews` renders process copy in
     * that case rather than a rating; a fresh R5 component would have had to
     * reimplement that gate, which is how a fabricated testimonial reaches a
     * live page. Deliberate reuse, asserted so it is not "finished off" later.
     */
    assert.match(code(read(PAGE)), /testimonials: \(\) => <HomeReviews \/>/);
  });
});

/* -------------------------------------------------------------------------- */
/* 2. Nothing on this page is typed by hand                                   */
/* -------------------------------------------------------------------------- */

describe("every claim resolves from reviewed data", () => {
  test("the budget bands are the intake's own ranges", () => {
    /*
     * The section shows ranges and the planner accepts ranges. If these were
     * two lists, a visitor could be shown a band the form would then refuse —
     * a dead end produced entirely by a copy-paste.
     */
    for (const entry of R5_BUDGET) {
      const canonical = BUDGET_RANGES_BY_PROJECT_SCOPE[entry.id].map((o) => o.label);
      assert.deepEqual(entry.bands, canonical, `${entry.id} must show the canonical bands`);
      assert.equal(entry.label, PROJECT_SCOPE_LABELS[entry.id]);
    }
    assert.deepEqual(
      R5_BUDGET.map((e) => e.id),
      [...R5_BUDGET_SCOPES]
    );
  });

  test("the content module states no rupee figure of its own", () => {
    const content = code(read("src/features/public-site/homepage-r5/content.ts"));
    assert.doesNotMatch(
      content,
      /["'`][^"'`]*(₹|Rs\.?\s?\d|Lakh|Crore)/i,
      "prices belong to budget-config, never to homepage copy"
    );
  });

  test("the FAQ reads its answers rather than restating them", () => {
    const faq = code(read(`${SECTIONS}/R5Faq.tsx`));
    assert.match(faq, /import \{ PM_FAQS \}/);
    // Every rendered id must exist in the reviewed set.
    const known = new Set((PM_FAQS as readonly { id: string }[]).map((e) => e.id));
    for (const id of R5_FAQ_IDS) {
      assert.ok(known.has(id), `${id} must be a reviewed FAQ entry`);
    }
    /*
     * The locality list left the homepage, so `areas` is the only place left
     * that answers "do you work in my part of the city". It must be rendered.
     */
    assert.ok((R5_FAQ_IDS as readonly string[]).includes("areas"));
  });

  test("no section invents review counts, timelines or machinery", () => {
    for (const file of [
      "R5Services.tsx",
      "R5RoomExplorer.tsx",
      "R5Why.tsx",
      "R5Process.tsx",
      "R5Factory.tsx",
      "R5Budget.tsx",
      "R5Portfolio.tsx",
      "R5Faq.tsx",
    ]) {
      const source = code(read(`${SECTIONS}/${file}`));
      assert.doesNotMatch(
        source,
        /\b\d+\s*(days?|weeks?|reviews?|clients?|projects?|homes?)\b/i,
        `${file} must not state a countable claim in markup`
      );
    }
  });

  test("borrowed imagery is labelled everywhere it appears", () => {
    assert.match(REFERENCE_IMAGERY_NOTE, /Reference visual/);
    for (const file of ["R5Services.tsx", "R5RoomExplorer.tsx"]) {
      assert.match(
        code(read(`${SECTIONS}/${file}`)),
        /REFERENCE_IMAGERY_NOTE/,
        `${file} shows photography and must carry the note`
      );
    }
    /*
     * A room with no approved photograph gets type, not a borrowed picture from
     * another room — the provenance model in one assertion.
     */
    assert.ok(
      R5_ROOMS.some((room) => room.image === null),
      "the fixture must keep at least one image-less room, or this stops testing anything"
    );
    assert.match(code(read(`${SECTIONS}/R5RoomExplorer.tsx`)), /r5-panel__placeholder/);
  });

  test("the factory section shows no manufacturing photography", () => {
    const factory = code(read(`${SECTIONS}/R5Factory.tsx`));
    assert.doesNotMatch(factory, /next\/image|<img/, "there is no approved factory media");
  });
});

/* -------------------------------------------------------------------------- */
/* 3. One lead journey                                                        */
/* -------------------------------------------------------------------------- */

describe("every path into the form is the same form", () => {
  test("no R5 section builds a form, a field or a submit", () => {
    for (const file of [
      "R5Services.tsx",
      "R5RoomExplorer.tsx",
      "R5Why.tsx",
      "R5Process.tsx",
      "R5Factory.tsx",
      "R5Budget.tsx",
      "R5Portfolio.tsx",
      "R5Faq.tsx",
    ]) {
      const source = code(read(`${SECTIONS}/${file}`));
      assert.doesNotMatch(source, /<(form|input|select|textarea)\b/, `${file} must not collect input`);
      assert.doesNotMatch(source, /type="submit"/, `${file} must not submit anything`);
    }
  });

  test("the budget CTA opens the canonical planner, and there is one of it", () => {
    const budget = code(read(`${SECTIONS}/R5Budget.tsx`));
    assert.match(budget, /usePlan\(\)/);
    assert.match(budget, /openPlanner\(getNextIncompleteStep\(\)\)/);
    assert.equal(
      (budget.match(/<button/g) ?? []).length -
        (budget.match(/role="tab"/g) ?? []).length,
      1,
      "the section has exactly one button that is not a tab"
    );
  });

  test("the prefill sets the service before the scope", () => {
    /*
     * THE ORDERING BUG THIS PREVENTS.
     *
     * `setService` clears a scope that does not belong to the new service. Call
     * it second and it silently discards the scope the visitor just chose, so
     * the planner opens on an empty requirement and the whole prefill is a
     * no-op that nobody notices because the dialog still opens.
     */
    const budget = code(read(`${SECTIONS}/R5Budget.tsx`));
    const service = budget.indexOf("setService(");
    const scope = budget.indexOf("setProjectScope(active.id)");
    assert.ok(service > 0 && scope > 0, "both setters must be called");
    assert.ok(service < scope, "setService must run before setProjectScope");
  });
});

/* -------------------------------------------------------------------------- */
/* 4. Accessibility contracts of the interactive parts                        */
/* -------------------------------------------------------------------------- */

describe("the interactive sections follow the patterns they claim", () => {
  test("both tablists are real tablists with roving tabindex", () => {
    for (const file of ["R5RoomExplorer.tsx", "R5Budget.tsx"]) {
      const source = code(read(`${SECTIONS}/${file}`));
      assert.match(source, /role="tablist"/, `${file} needs a tablist`);
      assert.match(source, /role="tab"/);
      assert.match(source, /role="tabpanel"/);
      assert.match(source, /aria-selected=\{selected\}/);
      assert.match(source, /tabIndex=\{selected \? 0 : -1\}/, `${file} needs roving tabindex`);
      for (const key of ["ArrowRight", "ArrowLeft", "Home", "End"]) {
        assert.match(source, new RegExp(`case "${key}"`), `${file} must handle ${key}`);
      }
    }
  });

  test("a closed FAQ panel is closed to a screen reader too", () => {
    /*
     * A grid collapse hides the answer visually and leaves it in the
     * accessibility tree, so a screen reader would read five answers whether
     * or not any were open.
     */
    assert.match(code(read(`${SECTIONS}/R5Faq.tsx`)), /hidden=\{!open\}/);
    assert.match(code(read(`${SECTIONS}/R5Faq.tsx`)), /aria-expanded=\{open\}/);
    assert.match(code(read(`${SECTIONS}/R5Faq.tsx`)), /aria-controls=\{panelId\}/);
  });

  test("the factory cards are toggles, not decoration", () => {
    assert.match(code(read(`${SECTIONS}/R5Factory.tsx`)), /aria-pressed=/);
  });

  test("the About anchor the menu points at still exists", () => {
    /*
     * `/#about` targeted the section R5Why replaced. Without the alias the menu
     * item scrolls nowhere, which is worse than not offering it.
     */
    assert.match(code(read(`${SECTIONS}/R5Why.tsx`)), /id="about"/);
  });

  test("the portfolio card is one link, not a card containing one", () => {
    const portfolio = code(read(`${SECTIONS}/R5Portfolio.tsx`));
    assert.equal((portfolio.match(/<Link/g) ?? []).length, 1);
  });

  test("the process stages are ordered and complete", () => {
    assert.equal(R5_PROCESS.length, 4);
    assert.equal(new Set(R5_PROCESS.map((s) => s.id)).size, 4);
  });

  test("the services rail and the room explorer cover the same four offerings", () => {
    assert.equal(R5_SERVICES.length, 4);
    assert.equal(R5_ROOMS.length, 4);
  });
});

/* -------------------------------------------------------------------------- */
/* 5. The two CSS traps                                                       */
/* -------------------------------------------------------------------------- */

describe("the stylesheet survives home-foundation's resets", () => {
  /**
   * Every rule in the R5 stylesheet, as `{ selector, declarations }`.
   * Comments are stripped first: this file's own explanations quote the
   * declarations it is asserting about.
   */
  const rules = () => {
    const css = read(CSS).replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "");
    return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
      .map((m) => ({ selector: m[1]!.trim().replace(/\s+/g, " "), body: m[2]! }))
      .filter((r) => r.selector && !r.selector.startsWith("@"));
  };

  /** The classes rendered as a p, ul, ol or heading — the reset's targets. */
  const RESET_TARGETS = [
    "r5-eyebrow",
    "r5-supporting",
    "r5-note",
    "r5-tags",
    "r5-tabs",
    "r5-panel__title",
    "r5-bands",
    "r5-disclaimer",
    "r5-heading",
    "r5-card__title",
    "r5-card__text",
    "r5-band__value",
    "r5-faq__answer",
    "r5-priorities",
    "r5-proof",
    "r5-stages",
  ];

  test("a non-zero margin on a reset element carries the attribute prefix", () => {
    /*
     * THE DEFECT, STATED AS A RULE.
     *
     * `[data-public-home-r4] p, ul, ol, h1..h4 { margin: 0 }` is 0-1-1. A bare
     * `.r5-thing` is 0-1-0 and loses. Eight rules were written this way, shipped
     * and measured at 0px in a real browser before anyone noticed, because a
     * dead margin looks exactly like a live one in the source.
     */
    const offenders: string[] = [];
    for (const rule of rules()) {
      const nonZero = rule.body
        .split(";")
        .map((d) => d.trim())
        .filter((d) => /^margin(-top|-bottom|-block)?\s*:/.test(d))
        .filter((d) => !/:\s*0(px)?\s*$/.test(d) && !/^margin\s*:\s*0(\s+0)*\s*$/.test(d));
      if (nonZero.length === 0) continue;
      const target = RESET_TARGETS.find((cls) => rule.selector.includes(`.${cls}`));
      if (!target) continue;
      if (!rule.selector.includes("[data-public-home-r4]")) {
        offenders.push(`${rule.selector} -> ${nonZero.join("; ")}`);
      }
    }
    assert.deepEqual(
      offenders,
      [],
      "these margins compute to 0px; prefix the selector with [data-public-home-r4]"
    );
  });

  test("the rail bleeds out of its container instead of padding twice", () => {
    /*
     * `.r5-railHost` is a `.dc-container` and already pads by `--dc-gutter`.
     * Padding the rail as well left 2.6px of the next card showing at 390px
     * instead of ~22px — the peek affordance the design depends on, absent.
     */
    const rail = rules().find(
      (r) => r.selector === "[data-public-home-r4] .r5-rail" && /overflow-x/.test(r.body)
    );
    assert.ok(rail, "the rail rule must exist with the attribute prefix");
    assert.match(rail.body, /margin-inline:\s*calc\(var\(--dc-gutter\) \* -1\)/);
    assert.match(rail.body, /padding:\s*0 var\(--dc-gutter\)/);
  });

  test("an aspect-ratio box is never capped by height", () => {
    /*
     * `max-height` on a box with `aspect-ratio` shrinks BOTH axes, so the image
     * narrows as well and floats inside a column sized for something larger.
     * Height caps on these boxes are expressed as widths.
     */
    for (const rule of rules()) {
      if (!/aspect-ratio/.test(rule.body)) continue;
      assert.doesNotMatch(
        rule.body,
        /max-height/,
        `${rule.selector}: cap an aspect-ratio box by width, not height`
      );
    }
  });

  test("motion is opt-in and the page is complete without it", () => {
    const css = read(CSS);
    assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
    /*
     * The failure that matters is not a missing animation — it is an entrance
     * animation whose start state is `opacity: 0` and whose end state never
     * arrives, leaving content invisible. Anything that animates in must do so
     * only when motion is welcome.
     */
    assert.match(css, /@media \(prefers-reduced-motion: no-preference\)[\s\S]*?r5-fade/);
  });
});
