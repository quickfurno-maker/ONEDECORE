import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  LANDING_BLOCK_TYPES,
  LANDING_ITEM_LIMITS,
  LANDING_MAX_BLOCKS,
  LANDING_TEXT_LIMITS,
  explainBlockRemovalBlocked,
  reportLandingPageBlockValidation,
  validateLandingBlock,
  validateLandingPageBlocks,
  type LandingBlock,
  type LandingBlockType,
} from "../contracts/blocks.ts";
import {
  LANDING_BLOCK_DESCRIPTIONS,
  LANDING_BLOCK_LABELS,
  createLandingBlock,
  duplicateLandingBlock,
  moveLandingBlock,
  nextBlockId,
  reorderLandingBlocks,
} from "../domain/block-factory.ts";
import {
  DEFAULT_LANDING_TEMPLATE_ID,
  LANDING_TEMPLATES,
  getLandingTemplate,
} from "../domain/landing-templates.ts";
import { PUBLIC_CLAIM_IDS, isClaimDisplayable } from "../../legal/claim-evidence.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
/** Source with comments removed, so prose about a rule is not the rule. */
const code = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const BUILDER = "src/features/landing-lab/components/LandingPageBuilder.tsx";
const INSPECTOR = "src/features/landing-lab/components/BlockInspector.tsx";
const FIELDS = "src/features/landing-lab/components/BuilderFields.tsx";
const WORKSPACE = "src/features/landing-lab/components/LandingPageWorkspaceClient.tsx";
const CREATE = "src/features/landing-lab/components/CreateLandingPageForm.tsx";
const EXPERIMENT = "src/features/landing-lab/components/ExperimentEditor.tsx";
const BLOCKS_UI = "src/features/landing-lab/public/LandingBlocks.tsx";
const BODY = "src/features/landing-lab/public/LandingPageBody.tsx";
const CTA = "src/features/landing-lab/public/LandingCta.tsx";
const RENDERER = "src/features/landing-lab/components/LandingPublicRenderer.tsx";
const RESOLVER = "src/features/landing-lab/public/resolve-landing-projects.ts";
const LP_ROUTE = "src/app/lp/[slug]/page.tsx";
const PAGE_CSS = "src/features/landing-lab/public/landing-page.css";
const ADMIN_LIST = "src/app/admin/landing-pages/page.tsx";

/** A complete, valid page to mutate in tests. */
function samplePage(): LandingBlock[] {
  return [...(getLandingTemplate("complete-home")!.buildBlocks() as LandingBlock[])];
}

/* ========================================================================== */
/* The owner never has to touch JSON                                          */
/* ========================================================================== */

describe("authoring is structured, not JSON", () => {
  test("no JSON textarea survives anywhere in the admin", () => {
    /*
     * THE THING THIS REPLACES.
     *
     * Authoring was a 16-row box labelled "Structured blocks JSON", and the
     * experiment editor was a second one in which the owner hand-wrote version
     * UUIDs. Both are gone; neither may come back as "advanced mode" without
     * this test being deliberately changed.
     */
    for (const rel of [WORKSPACE, CREATE, EXPERIMENT]) {
      assert.doesNotMatch(read(rel), /<textarea/, `${rel} still has a textarea`);
    }
    assert.doesNotMatch(read(WORKSPACE), /Structured blocks JSON/);
    assert.doesNotMatch(read(WORKSPACE), /JSON\.stringify\(latest\.blocks/);
  });

  test("the blocks still travel to the server as JSON, just not by hand", () => {
    // The action's contract is unchanged — only who serialises it changed.
    assert.match(read(WORKSPACE), /formData\.set\("blocks", JSON\.stringify\(blocks\)\)/);
    assert.match(read(WORKSPACE), /formData\.set\("lockVersion", String\(latest\.lockVersion\)\)/);
  });

  test("the builder validates before the round trip, because the server cannot", () => {
    /*
     * `parseBlocks` in the server action discards the validator's message and
     * answers "Structured blocks failed validation." with no field named. If
     * the browser did not validate, an author would have no way to learn what
     * was wrong.
     */
    assert.match(read(WORKSPACE), /const error = validateLandingPageBlocks\(blocks\);/);
    assert.match(read(WORKSPACE), /if \(error\) \{[\s\S]{0,120}setMessage\(error\);/);
  });

  test("a successful save refreshes, because the action revalidates the other route", () => {
    // saveLandingDraftAction revalidates /admin/landing-pages, not this detail
    // route, so the lockVersion in hand would go stale and the next save would
    // fail a lock check the author cannot see.
    assert.match(read(WORKSPACE), /router\.refresh\(\)/);
  });
});

/* ========================================================================== */
/* Add / edit / remove / duplicate / reorder                                  */
/* ========================================================================== */

describe("every structural edit produces a valid page", () => {
  test("every block type has a default that passes the contract on its own", () => {
    for (const type of LANDING_BLOCK_TYPES) {
      const block = createLandingBlock(type, []);
      assert.equal(block.type, type);
      const page = [
        block,
        createLandingBlock("lead_form_placeholder", [block.blockId]),
        createLandingBlock("footer", [block.blockId, "enquiry"]),
      ];
      assert.equal(
        validateLandingPageBlocks(page),
        null,
        `adding a ${type} produced an unsavable page`
      );
    }
  });

  test("every block type has a label and a description for the palette", () => {
    for (const type of LANDING_BLOCK_TYPES) {
      assert.ok(LANDING_BLOCK_LABELS[type]?.length > 0, type);
      assert.ok(LANDING_BLOCK_DESCRIPTIONS[type]?.length > 0, type);
      // Labels are for an owner, not a developer: no snake_case leaks through.
      assert.doesNotMatch(LANDING_BLOCK_LABELS[type], /_/, type);
    }
  });

  test("ids are unique, id-shaped, and never derived from customer copy", () => {
    const ids: string[] = [];
    for (let i = 0; i < 6; i += 1) {
      const id = nextBlockId("hero", ids);
      assert.match(id, /^[a-z0-9][a-z0-9_-]{2,48}$/i, id);
      assert.ok(!ids.includes(id), `${id} was issued twice`);
      ids.push(id);
    }
    // Derived from the type, so renaming a headline cannot orphan an id.
    assert.equal(ids[0], "hero");
    assert.equal(ids[1], "hero-2");
  });

  test("duplicating a block copies the content under a fresh id", () => {
    const page = samplePage();
    const hero = page.find((block) => block.type === "hero")!;
    const copy = duplicateLandingBlock(hero, page.map((block) => block.blockId));

    assert.notEqual(copy.blockId, hero.blockId);
    assert.equal(copy.type, hero.type);
    assert.deepEqual(
      { ...copy, blockId: hero.blockId },
      hero,
      "a duplicate must differ only by id"
    );
    assert.equal(validateLandingPageBlocks([...page, copy]), null);
  });

  test("reordering preserves every block and keeps the page valid", () => {
    const page = samplePage();
    const moved = moveLandingBlock(page, 0, 1);
    assert.equal(moved.length, page.length);
    assert.equal(moved[1]!.blockId, page[0]!.blockId);
    assert.equal(moved[0]!.blockId, page[1]!.blockId);
    assert.equal(validateLandingPageBlocks(moved), null);

    // Same set of ids, different order.
    assert.deepEqual(
      [...moved].map((b) => b.blockId).sort(),
      [...page].map((b) => b.blockId).sort()
    );
  });

  test("an impossible move returns the original array, so nothing is marked dirty", () => {
    const page = samplePage();
    assert.equal(moveLandingBlock(page, 0, -1), page);
    assert.equal(moveLandingBlock(page, page.length - 1, 1), page);
    assert.equal(moveLandingBlock(page, -5, 1), page);
    assert.equal(reorderLandingBlocks(page, 2, 2), page);
  });

  test("drag-style reorder moves a block to an arbitrary position", () => {
    const page = samplePage();
    const moved = reorderLandingBlocks(page, 0, 3);
    assert.equal(moved[3]!.blockId, page[0]!.blockId);
    assert.equal(moved.length, page.length);
  });
});

/* ========================================================================== */
/* The two blocks a page cannot lose                                          */
/* ========================================================================== */

describe("the page cannot be edited into an unpublishable state", () => {
  test("the last enquiry section cannot be removed, and says why", () => {
    const page = samplePage();
    const enquiry = page.find((b) => b.type === "lead_form_placeholder")!;
    const reason = explainBlockRemovalBlocked(page, enquiry.blockId);
    assert.ok(reason, "removal should be blocked");
    assert.match(reason!, /only enquiry section/i);
    // And the reason is true: removing it really does break the contract.
    assert.equal(
      validateLandingPageBlocks(page.filter((b) => b.blockId !== enquiry.blockId)),
      "Page must include a lead_form_placeholder block."
    );
  });

  test("the last footer cannot be removed, and says why", () => {
    const page = samplePage();
    const footer = page.find((b) => b.type === "footer")!;
    const reason = explainBlockRemovalBlocked(page, footer.blockId);
    assert.ok(reason);
    assert.match(reason!, /only footer/i);
  });

  test("a SECOND enquiry section can be removed", () => {
    /*
     * The rule is "the page must have one", not "this block is sacred". With a
     * duplicate present, either copy may go — otherwise an author who
     * duplicated a section by accident could never undo it.
     */
    const page = samplePage();
    const enquiry = page.find((b) => b.type === "lead_form_placeholder")!;
    const copy = duplicateLandingBlock(enquiry, page.map((b) => b.blockId));
    const withBoth = [...page, copy];
    assert.equal(explainBlockRemovalBlocked(withBoth, enquiry.blockId), null);
    assert.equal(explainBlockRemovalBlocked(withBoth, copy.blockId), null);
  });

  test("a block the page does not contain blocks nothing", () => {
    assert.equal(explainBlockRemovalBlocked(samplePage(), "no-such-block"), null);
  });

  test("the builder disables the control and shows the reason", () => {
    const builder = read(BUILDER);
    assert.match(builder, /explainBlockRemovalBlocked\(blocks, block\.blockId\)/);
    assert.match(builder, /disabled=\{readOnly \|\| Boolean\(blocked\)\}/);
    assert.match(builder, /title=\{blocked \?\? undefined\}/);
  });

  test("removal asks first", () => {
    const builder = read(BUILDER);
    assert.match(builder, /pendingRemoval/);
    assert.match(builder, /Remove this section\?/);
  });
});

/* ========================================================================== */
/* Per-block error reporting                                                  */
/* ========================================================================== */

describe("validation errors reach the block that caused them", () => {
  test("a bad field is attributed to its own block, and the rest stay editable", () => {
    const page = samplePage();
    const index = page.findIndex((b) => b.type === "faq");
    page[index] = {
      ...(page[index] as Extract<LandingBlock, { type: "faq" }>),
      items: [{ question: "Q", answer: "x".repeat(LANDING_TEXT_LIMITS.long + 1) }],
    };

    const report = reportLandingPageBlockValidation(page);
    assert.equal(report.valid, false);
    assert.equal(report.blockErrors.length, 1);
    assert.equal(report.blockErrors[0]!.blockId, page[index]!.blockId);
    assert.equal(report.blockErrors[0]!.index, index);
    assert.match(report.blockErrors[0]!.message, /exceeds 600 characters/);
  });

  test("a missing required block is a page error, not a block error", () => {
    const page = samplePage().filter((b) => b.type !== "footer");
    const report = reportLandingPageBlockValidation(page);
    assert.equal(report.valid, false);
    assert.equal(report.blockErrors.length, 0);
    assert.match(report.pageErrors.join(" "), /footer/i);
  });

  test("every block is checked, not just the first bad one", () => {
    /*
     * The contract's own validator short-circuits — correct for a gate,
     * useless for an editor. With two broken blocks the report names both.
     */
    const page = samplePage();
    const faq = page.findIndex((b) => b.type === "faq");
    const process = page.findIndex((b) => b.type === "process");
    page[faq] = { ...(page[faq] as Extract<LandingBlock, { type: "faq" }>), title: "" };
    page[process] = {
      ...(page[process] as Extract<LandingBlock, { type: "process" }>),
      title: "",
    };

    const report = reportLandingPageBlockValidation(page);
    assert.equal(report.blockErrors.length, 2);
    assert.equal(validateLandingPageBlocks(page)?.includes("required"), true);
  });

  test("a valid page reports clean", () => {
    const report = reportLandingPageBlockValidation(samplePage());
    assert.deepEqual(report.blockErrors, []);
    assert.deepEqual(report.pageErrors, []);
    assert.equal(report.valid, true);
  });

  test("the exported limits are the ones the validator enforces", () => {
    // The counters in the editor read these. If they drifted, the editor would
    // accept text the contract rejects.
    const page = samplePage();
    const hero = page.findIndex((b) => b.type === "hero");
    page[hero] = {
      ...(page[hero] as Extract<LandingBlock, { type: "hero" }>),
      headline: "x".repeat(LANDING_TEXT_LIMITS.medium),
    };
    assert.equal(validateLandingPageBlocks(page), null);

    page[hero] = {
      ...(page[hero] as Extract<LandingBlock, { type: "hero" }>),
      headline: "x".repeat(LANDING_TEXT_LIMITS.medium + 1),
    };
    assert.match(String(validateLandingPageBlocks(page)), /exceeds 280/);
  });

  test("the page block cap is the exported constant", () => {
    const page = samplePage();
    const filler: LandingBlock[] = [];
    const ids = page.map((b) => b.blockId);
    while (page.length + filler.length <= LANDING_MAX_BLOCKS) {
      const block = createLandingBlock("faq", [...ids, ...filler.map((b) => b.blockId)]);
      filler.push(block);
    }
    assert.match(
      String(validateLandingPageBlocks([...page, ...filler])),
      /maximum block count/
    );
  });
});

/* ========================================================================== */
/* Templates                                                                  */
/* ========================================================================== */

describe("templates are structure, never invented proof", () => {
  test("every template produces a page that saves as-is", () => {
    for (const template of LANDING_TEMPLATES) {
      assert.equal(
        validateLandingPageBlocks(template.buildBlocks()),
        null,
        `${template.id} does not pass the contract`
      );
    }
  });

  test("the campaigns the brief named all exist, plus a blank", () => {
    const ids = LANDING_TEMPLATES.map((template) => template.id);
    for (const required of [
      "blank",
      "complete-home",
      "modular-kitchen",
      "1bhk",
      "2bhk",
      "3bhk",
      "villa",
    ]) {
      assert.ok(ids.includes(required), `missing template: ${required}`);
    }
    assert.ok(getLandingTemplate(DEFAULT_LANDING_TEMPLATE_ID));
    assert.equal(getLandingTemplate("not-a-template"), null);
  });

  test("no template quotes a figure", () => {
    /*
     * THE RULE, AND WHY IT IS ABSOLUTE.
     *
     * `getUnevidencedClaimIds()` currently returns every public claim id —
     * ratings, client counts, warranty years, satisfaction percentages. A
     * template is chosen by someone in a hurry and published, so a seeded
     * "4.9 from 500+ clients" would put an unevidenced claim on a paid page
     * without anyone typing it.
     *
     * Room descriptors (1/2/3 BHK) are the one numeric exception and live in
     * the template name and headline, so the check runs over the block copy.
     */
    for (const template of LANDING_TEMPLATES) {
      for (const block of template.buildBlocks()) {
        const { blockId, type, ...content } = block as unknown as Record<string, unknown>;
        void blockId;
        void type;
        const text = JSON.stringify(content);
        const digits = text.replace(/\b[123] BHK\b/g, "").match(/\d/g);
        assert.equal(
          digits,
          null,
          `${template.id} has a figure in a ${String(type)} block: ${text.slice(0, 120)}`
        );
      }
    }
  });

  test("no template ships a testimonial or a project slug", () => {
    for (const template of LANDING_TEMPLATES) {
      for (const block of template.buildBlocks()) {
        assert.notEqual(
          block.type,
          "testimonials",
          `${template.id} templates a quote — a templated quote is a fabricated one`
        );
        assert.notEqual(
          block.type,
          "portfolio_preview",
          `${template.id} templates project slugs it cannot know are published`
        );
      }
    }
  });

  test("no template ships trust points, but the palette still offers them", () => {
    /*
     * A template cannot know what is provably true about the business, and the
     * two things it could put in a trust section are both worse than nothing:
     * an invented figure, or "Add a short, factual point" three times, shipped
     * live because the author moved on. The section stays one click away in
     * the palette for when there is real proof to show.
     */
    for (const template of LANDING_TEMPLATES) {
      for (const block of template.buildBlocks()) {
        assert.notEqual(
          block.type,
          "trust_proof",
          `${template.id} templates trust points it cannot substantiate`
        );
      }
    }

    // Still addable, with a label, a description and a valid default.
    assert.ok(LANDING_BLOCK_TYPES.includes("trust_proof"));
    assert.equal(LANDING_BLOCK_LABELS.trust_proof, "Trust points");
    assert.ok(LANDING_BLOCK_DESCRIPTIONS.trust_proof.length > 0);
    const added = createLandingBlock("trust_proof", []);
    assert.equal(validateLandingBlock(added), null);
  });

  test("no template leaves a fill-me-in prompt in published copy", () => {
    /*
     * Block DEFAULTS still prompt — an author who adds a section should see
     * what goes in it. A TEMPLATE is different: it is chosen and published,
     * often without every section being opened, so nothing it produces may
     * read as an instruction to the reader.
     */
    for (const template of LANDING_TEMPLATES) {
      const copy = JSON.stringify(template.buildBlocks());
      for (const prompt of [
        "Add a short, factual point",
        "Replace this with",
        "Add a service",
        "Add a step",
        "replace-with-a-published-project",
        "Add a question",
      ]) {
        assert.ok(
          !copy.includes(prompt),
          `${template.id} would publish the prompt: ${prompt}`
        );
      }
    }
  });

  test("no claim currently carries public evidence, which is why the rule holds", () => {
    // If this ever changes, the no-figures rule above deserves revisiting
    // deliberately rather than by accident.
    const evidenced = PUBLIC_CLAIM_IDS.filter((id) => isClaimDisplayable(id));
    assert.ok(
      evidenced.length < PUBLIC_CLAIM_IDS.length,
      "unexpected: every claim is now displayable"
    );
  });

  test("the create form offers templates and no longer seeds the test fixture", () => {
    // Comment-stripped: the file's docblock NAMES the old seed while
    // explaining why it is gone, and prose about a thing is not the thing.
    const create = code(read(CREATE));
    assert.match(create, /LANDING_TEMPLATES\.map/);
    assert.doesNotMatch(create, /buildSampleLandingBlocks/);
    // The old seed put Gurgaon project slugs in a Pune business's pages.
    assert.doesNotMatch(create, /gurgaon/i);
  });

  test("the fixture no longer tells public visitors submissions are disabled", () => {
    /*
     * `buildSampleLandingBlocks()` set the enquiry helper text to "Prebuild
     * preview only — submissions are disabled." and the create form stamped it
     * into every new page — copy that would have shipped to a live campaign.
     */
    const fixtures = read("src/features/landing-lab/fixtures/landing-fixtures.ts");
    assert.doesNotMatch(fixtures, /submissions are disabled/i);
  });
});

/* ========================================================================== */
/* The premium public renderer                                                */
/* ========================================================================== */

describe("the public page is a real landing page", () => {
  test("CTAs are controls, not paragraphs", () => {
    /*
     * The previous renderer printed every call to action as `<p>` — including
     * the hero's. Each of the contract's four URL shapes now has a behaviour.
     */
    const cta = read(CTA);
    assert.match(cta, /target\.startsWith\("#"\)/);
    assert.match(cta, /target\.startsWith\("\/"\)/);
    assert.match(cta, /target\.startsWith\("http:\/\/"\) \|\| target\.startsWith\("https:\/\/"\)/);
    assert.match(cta, /<button/);
    assert.match(cta, /rel="noreferrer noopener"/);
  });

  test("an empty CTA url opens the one canonical form", () => {
    const cta = code(read(CTA));
    assert.match(cta, /onClick=\{openForm \?\? undefined\}/);
    assert.match(cta, /data-landing-cta-opens-form/);
  });

  test("no public landing component renders a form or posts the intake API", () => {
    // The single-lead-form rule, restated where this work could break it.
    for (const rel of [BLOCKS_UI, BODY, CTA, RENDERER, LP_ROUTE]) {
      const src = code(read(rel));
      assert.doesNotMatch(src, /<form/, `${rel} renders a form`);
      assert.doesNotMatch(src, /<input/, `${rel} renders an input`);
      assert.doesNotMatch(src, /api\/public\/lead-intake/, `${rel} posts the intake API`);
    }
  });

  test("the renderer still carries the signed context to the canonical host", () => {
    const renderer = read(RENDERER);
    assert.match(renderer, /LeadConsultationHost/);
    assert.match(renderer, /landingPublicationContext: signedContext/);
    assert.match(renderer, /campaignExecutionContext/);
  });

  test("nothing sets raw HTML", () => {
    for (const rel of [BLOCKS_UI, BODY, CTA, RENDERER, BUILDER, INSPECTOR, FIELDS]) {
      assert.doesNotMatch(read(rel), /dangerouslySetInnerHTML/, rel);
    }
  });

  test("the portfolio block shows photographs, never raw slugs", () => {
    const blocks = read(BLOCKS_UI);
    assert.doesNotMatch(blocks, /projectSlugs\.join/);
    assert.match(blocks, /projects\.map\(\(project\)/);
    assert.match(blocks, /project\.imageUrl/);
    assert.match(blocks, /href=\{project\.href\}/);
  });

  test("an unresolved slug removes the section instead of breaking the page", () => {
    const blocks = read(BLOCKS_UI);
    assert.match(blocks, /if \(projects\.length === 0\) return null;/);
    const resolver = read(RESOLVER);
    assert.match(resolver, /if \(!project\) return null;/);
    assert.match(resolver, /catch \{/);
    assert.match(resolver, /card !== null/);
  });

  test("the resolver reads the public model, so drafts can never surface", () => {
    const resolver = read(RESOLVER);
    assert.match(resolver, /^import "server-only";/m);
    assert.match(resolver, /getProjectBySlug/);
    assert.doesNotMatch(code(resolver), /service_role|createLandingLabServiceClient/);
  });

  test("the FAQ uses the platform's own disclosure element", () => {
    const blocks = read(BLOCKS_UI);
    assert.match(blocks, /<details className="lp-faq__item"/);
    assert.match(blocks, /<summary className="lp-faq__q">/);
  });

  test("the footer makes the phone and email tappable", () => {
    const blocks = read(BLOCKS_UI);
    assert.match(blocks, /`tel:\$\{block\.contactPhone\.replace\(/);
    assert.match(blocks, /`mailto:\$\{block\.contactEmail\}`/);
    // Nothing internal is linked from a public page.
    assert.doesNotMatch(blocks, /\/admin|\/manager/);
  });

  test("exactly one h1, and it is the first hero", () => {
    const blocks = read(BLOCKS_UI);
    assert.equal((blocks.match(/<h1/g) ?? []).length, 1);
    assert.match(read(BODY), /block\.blockId === firstHeroId/);
  });

  test("testimonials render no stars, scores or aggregate rating", () => {
    const blocks = code(read(BLOCKS_UI));
    assert.doesNotMatch(blocks, /★|⭐|rating|stars|reviewCount/i);
  });

  test("campaign pages stay out of the search index", () => {
    const route = read(LP_ROUTE);
    assert.match(route, /robots/);
    assert.match(route, /index: false/);
  });
});

/* ========================================================================== */
/* Responsive and premium, as enforceable properties                          */
/* ========================================================================== */

describe("the page is built mobile-first and cannot scroll sideways", () => {
  test("the page clips horizontal overflow at the root", () => {
    const css = read(PAGE_CSS);
    assert.match(css, /\.lp-page \{[\s\S]*?overflow-x: clip;/);
  });

  test("spacing and type scale fluidly rather than by breakpoint stacking", () => {
    const css = read(PAGE_CSS);
    assert.match(css, /--lp-gutter: clamp\(/);
    assert.match(css, /--lp-section-y: clamp\(/);
    assert.match(css, /\.lp-hero__title \{[\s\S]*?font-size: clamp\(/);
  });

  test("every media query widens rather than narrows", () => {
    /*
     * Mobile-first means the base rules ARE the phone. A `max-width` query is
     * a correction, not a layout, so the few that exist are deliberate — the
     * sticky bar, and letting the preview frame shrink below its own width.
     */
    const css = read(PAGE_CSS);
    const maxWidth = [...css.matchAll(/@media \(max-width: (\d+)px\)/g)];
    assert.ok(maxWidth.length <= 3, `too many max-width corrections: ${maxWidth.length}`);
  });

  test("primary controls clear a 44px touch target", () => {
    const css = read(PAGE_CSS);
    assert.match(css, /\.lp-btn \{[\s\S]*?min-height: 52px;/);
    assert.match(css, /\.lp-faq__q \{[\s\S]*?min-height: 60px;/);
    assert.match(css, /\.lp-footer__contact a \{[\s\S]*?min-height: 44px;/);
  });

  test("the sticky CTA respects the safe area and yields to the cookie banner", () => {
    const css = read(PAGE_CSS);
    assert.match(css, /env\(safe-area-inset-bottom/);
    assert.match(css, /@media \(max-width: 1079px\)[\s\S]{0,200}\.lp-sticky \{\s*display: block;/);
    // Room is reserved so the footer is never trapped under the bar.
    assert.match(css, /padding-block-end: 84px;/);
  });

  test("motion is disabled for visitors who ask for that", () => {
    assert.match(read(PAGE_CSS), /@media \(prefers-reduced-motion: reduce\)/);
  });

  test("the renderer owns its own palette so the preview cannot drift", () => {
    /*
     * The admin shell `.od-ops` redefines --od-gold and --od-radius. A
     * renderer reading those directly would look different inside the builder
     * than in production — the one thing a preview must not do.
     */
    const css = read(PAGE_CSS);
    assert.match(css, /\.lp-page \{[\s\S]*?--lp-gold: var\(--od-gold, #d8a24a\);/);
    assert.match(css, /--lp-bg: var\(--od-bg-page, #0d0a09\);/);
  });
});

/* ========================================================================== */
/* The preview is the page, and is inert                                      */
/* ========================================================================== */

describe("the preview shows the real page and can do nothing", () => {
  test("it renders the same component the live route renders", () => {
    assert.match(read(BUILDER), /<LandingPageBody blocks=\{blocks\}/);
    assert.match(read(RENDERER), /<LandingPageBody/);
  });

  test("it cannot open the enquiry form", () => {
    /*
     * A preview able to open the real form is a preview able to create a real
     * lead from an unsaved draft. The opener is `null` here, and that is the
     * whole mechanism — not a flag the CTA is trusted to honour.
     */
    assert.match(read(BUILDER), /<LandingActionProvider mode="preview" openForm=\{null\}>/);
  });

  test("it records no exposure and mounts no tracking", () => {
    const builder = code(read(BUILDER));
    assert.doesNotMatch(builder, /record_landing_exposure|recordExposure/);
    assert.doesNotMatch(builder, /fbq|MetaPixel|trackMetaLead/);
  });

  test("it offers mobile, tablet and desktop widths", () => {
    const builder = read(BUILDER);
    for (const width of ["390px", "768px", "1280px"]) {
      assert.ok(builder.includes(width), `missing preview width ${width}`);
    }
    assert.match(builder, /aria-pressed=\{viewport === item\.id\}/);
  });

  test("selection does not nest interactive elements", () => {
    /*
     * Wrapping each section in a <button> to make it clickable would put the
     * page's own links and buttons inside a button. Delegation instead.
     */
    const builder = read(BUILDER);
    assert.match(builder, /closest\(\s*"\[data-lp-block-id\]"\s*\)/);
    assert.doesNotMatch(builder, /className="od-lb__hit"/);
  });

  test("selection is real state, not hard-coded to the first block", () => {
    const builder = read(BUILDER);
    assert.match(builder, /const \[selectedId, setSelectedId\] = useState/);
    assert.match(builder, /data-select-block=\{block\.blockId\}/);
    // The shell this replaces did: const selectedBlockId = blocks[0]?.blockId
    assert.doesNotMatch(builder, /selectedBlockId = blocks\[0\]/);
  });

  test("the preview's editing affordances cannot reach a visitor", () => {
    const css = read("src/features/landing-lab/components/landing-builder.css");
    assert.match(css, /\[data-preview-surface\] \[data-lp-selected="true"\]::after/);
    // The live page never sets the attribute and never loads this stylesheet.
    assert.doesNotMatch(read(LP_ROUTE), /landing-builder\.css/);
  });
});

/* ========================================================================== */
/* Frozen versions                                                            */
/* ========================================================================== */

describe("frozen versions stay immutable", () => {
  test("the builder is read-only unless the latest version is an unfrozen draft", () => {
    const workspace = read(WORKSPACE);
    assert.match(workspace, /const editable = Boolean\(latest && latest\.frozenAt == null\);/);
    assert.match(workspace, /readOnly=\{!canManage \|\| !editable\}/);
  });

  test("read-only disables adding, removing, reordering and editing", () => {
    const builder = read(BUILDER);
    assert.match(builder, /disabled=\{readOnly \|\| atBlockLimit\}/);
    assert.match(builder, /disabled=\{readOnly \|\| index === 0\}/);
    assert.match(builder, /readOnly=\{readOnly\}/);
    assert.match(read(INSPECTOR), /const disabled = Boolean\(readOnly\);/);
  });

  test("a frozen version offers the next-version route instead of a save", () => {
    const workspace = read(WORKSPACE);
    assert.match(workspace, /createNextLandingVersionAction/);
    assert.match(workspace, /Create next version/);
    assert.match(read(INSPECTOR), /Create next.{0,3}\n?\s*version/);
  });

  test("freezing is blocked while there are unsaved changes", () => {
    // Freezing a version whose edits are still in the browser would publish
    // the version WITHOUT them, silently.
    assert.match(read(WORKSPACE), /disabled=\{dirty\}/);
  });
});

/* ========================================================================== */
/* Unsaved work                                                               */
/* ========================================================================== */

describe("unsaved work is visible and protected", () => {
  test("the dirty state is derived from the blocks, not tracked by hand", () => {
    const builder = read(BUILDER);
    assert.match(builder, /const dirty = JSON\.stringify\(blocks\) !== baseline;/);
  });

  test("closing the tab with unsaved blocks warns", () => {
    const builder = read(BUILDER);
    assert.match(builder, /if \(!dirty\) return;/);
    assert.match(builder, /addEventListener\("beforeunload", warn\)/);
    assert.match(builder, /removeEventListener\("beforeunload", warn\)/);
  });

  test("saving is explicit, and disabled when there is nothing to save", () => {
    const workspace = read(WORKSPACE);
    assert.match(workspace, /disabled=\{saving \|\| !dirty \|\| Boolean\(blocksError\)\}/);
    // No autosave: it would race the optimistic lock the RPC checks.
    assert.doesNotMatch(code(read(BUILDER)), /setInterval|setTimeout\([^)]*save/i);
  });

  test("an empty optional field is stored as null, not an empty string", () => {
    /*
     * The contract types optional fields `string | null` and treats "" as
     * absent. Writing "" would persist a meaningless field and — because ""
     * and null compare differently — light the unsaved marker when an author
     * merely clicked into a field and back out.
     */
    assert.match(read(INSPECTOR), /const orNull = \(value: string\): string \| null =>/);
    assert.match(read(INSPECTOR), /value\.trim\(\)\.length === 0 \? null : value/);
  });
});

/* ========================================================================== */
/* Field controls                                                             */
/* ========================================================================== */

describe("the inspector is real controls for real fields", () => {
  test("every block type has an editor branch", () => {
    const inspector = read(INSPECTOR);
    for (const type of LANDING_BLOCK_TYPES) {
      assert.ok(inspector.includes(`case "${type}":`), `no editor for ${type}`);
    }
  });

  test("repeatable sections can add, remove and reorder their items", () => {
    const fields = read(FIELDS);
    assert.match(fields, /export function RepeatableList/);
    assert.match(fields, /aria-label=\{`Move \$\{itemNoun\} \$\{index \+ 1\} up`\}/);
    assert.match(fields, /aria-label=\{`Remove \$\{itemNoun\} \$\{index \+ 1\}`\}/);
    assert.match(fields, /onChange\(\[\.\.\.items, create\(\)\]\)/);
  });

  test("the last item of a repeatable section cannot be removed", () => {
    // Every repeatable block requires at least one item.
    assert.match(read(FIELDS), /const atMinimum = items\.length <= 1;/);
  });

  test("item limits come from the contract, and FAQ's larger cap is honoured", () => {
    assert.equal(LANDING_ITEM_LIMITS.default, 12);
    assert.equal(LANDING_ITEM_LIMITS.faq, 20);
    const inspector = read(INSPECTOR);
    assert.match(inspector, /limit=\{LANDING_ITEM_LIMITS\.faq\}/);
    assert.match(inspector, /limit=\{LANDING_ITEM_LIMITS\.default\}/);
  });

  test("counters use the contract's own limits", () => {
    assert.match(read(FIELDS), /limit = LANDING_TEXT_LIMITS\.short/);
    assert.match(read(INSPECTOR), /LANDING_TEXT_LIMITS\.(medium|long)/);
  });

  test("the angle-bracket rule is explained rather than reported raw", () => {
    /*
     * UNSAFE_TEXT_PATTERN rejects any < or > anywhere. Real copy walks into
     * this constantly — "Concept > Design > Handover" — and the contract's own
     * message ("contains unsafe HTML or script patterns") makes no sense for
     * that input.
     */
    const fields = read(FIELDS);
    assert.match(fields, /Angle brackets/);
    assert.match(fields, /if \(\/\[<>\]\/\.test\(value\)\) return UNSAFE_HINT;/);
  });

  test("the URL field explains the four shapes the contract accepts", () => {
    const fields = read(FIELDS);
    for (const shape of ["anchor", "internal", "external", "invalid"]) {
      assert.ok(fields.includes(`${shape}:`), `URL field does not explain ${shape}`);
    }
    assert.match(fields, /Email and phone links are not accepted here/);
  });

  test("the enquiry block offers no custom lead fields", () => {
    /*
     * One lead contract, everywhere. A per-page field would make leads
     * incomparable in the CRM and would need a second intake schema.
     */
    const inspector = read(INSPECTOR);
    const section = inspector.slice(
      inspector.indexOf('case "lead_form_placeholder":'),
      inspector.indexOf('case "footer":')
    );
    assert.doesNotMatch(section, /RepeatableList/);
    assert.match(section, /cannot\s*\n?\s*be changed per page/);
  });

  test("testimonial and trust editors warn against unevidenced claims", () => {
    const inspector = read(INSPECTOR);
    assert.match(inspector, /permission to use/i);
    assert.match(inspector, /not currently approved for publication/i);
  });
});

/* ========================================================================== */
/* Experiments                                                                */
/* ========================================================================== */

describe("the experiment editor surfaces the rules it cannot enforce", () => {
  test("versions are chosen from frozen ones only", () => {
    const editor = read(EXPERIMENT);
    assert.match(editor, /workspace\.versions\.filter\(\(version\) => version\.frozenAt != null\)/);
    assert.match(editor, /<select/);
    assert.doesNotMatch(editor, /<textarea/);
  });

  test("it explains the constraints the database enforces", () => {
    const editor = read(EXPERIMENT);
    assert.match(editor, /must total 100%/);
    assert.match(editor, /needs two frozen versions/);
    assert.match(editor, /same version/);
  });

  test("saving is blocked while any constraint is unmet", () => {
    assert.match(read(EXPERIMENT), /disabled=\{disabled \|\| problems\.length > 0\}/);
  });

  test("the winner stays a human decision", () => {
    const editor = read(EXPERIMENT);
    assert.match(editor, /winner is always chosen by a person/i);
    assert.doesNotMatch(code(editor), /autoPromote|declareWinner\(/);
    assert.match(
      read("src/features/landing-lab/components/HumanWinnerControl.tsx"),
      /Nothing is promoted automatically/
    );
  });

  test("a running experiment cannot have its variants edited", () => {
    assert.match(read(WORKSPACE), /disabled=\{workspace\.experiments\[0\]\?\.status === "running"\}/);
  });
});

/* ========================================================================== */
/* Stale language                                                             */
/* ========================================================================== */

describe("the admin no longer describes a prebuild", () => {
  test("the list page does not claim public serving is gated until a phase", () => {
    const list = read(ADMIN_LIST);
    assert.doesNotMatch(list, /Phase 10/);
    assert.doesNotMatch(list, /Phase 9B/);
    assert.match(list, /ONEDECORE_LANDING_LAB_PUBLIC_ENABLED/);
  });

  test("no live authoring surface says 'prebuild'", () => {
    /*
     * Comment-stripped, deliberately. Several of these files explain in a
     * docblock what they replaced, and one of the things they replaced was
     * called the prebuild. Banning the word from the comments too would mean
     * deleting the explanation of why the change was made.
     */
    for (const rel of [WORKSPACE, BUILDER, INSPECTOR, FIELDS, CREATE, EXPERIMENT]) {
      assert.doesNotMatch(code(read(rel)), /prebuild/i, `${rel} still says prebuild`);
    }
  });

  test("the palette no longer says drag-and-drop is unavailable", () => {
    const palette = read("src/features/landing-lab/components/BlockPalette.tsx");
    assert.doesNotMatch(palette, /not enabled in prebuild/i);
  });
});
