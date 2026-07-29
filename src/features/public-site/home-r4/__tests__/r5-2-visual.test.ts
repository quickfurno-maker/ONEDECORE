/**
 * R5.2 V2 — hero, areas, counter, and visual polish source guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import { HOME_PROJECT_PROOF_MODE } from "../project-proof.ts";

const home = join(process.cwd(), "src/features/public-site/home-r4");

function read(name: string) {
  return readFileSync(join(home, name), "utf8");
}

describe("R5.2 Pune areas", () => {
  test("exactly 26 unique approved areas in content", () => {
    const content = read("content.ts");
    const block = content.match(
      /export const PM_PUNE_AREAS = \[([\s\S]*?)\] as const/
    );
    assert.ok(block);
    const areas = [...block![1]!.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
    assert.equal(areas.length, 26);
    assert.equal(new Set(areas).size, 26);
    assert.ok(areas.includes("NIBM"));
    assert.ok(areas.includes("Kharadi"));
    assert.ok(!areas.includes("Mumbai"));
    assert.match(content, /value:\s*PM_PUNE_AREAS\.length/);
    assert.match(content, /suffix:\s*"\+"/);
  });
});

describe("R5.2 hero copy and structure", () => {
  test("approved eyebrow H1 and lede", () => {
    const content = read("content.ts");
    assert.match(content, /Pune's Interior Design & Build Studio/);
    assert.match(content, /Complete Home Interiors, Designed & Built By Us/);
    assert.match(content, /ONEDECORE plans, coordinates and installs/);
  });

  test("no QuickFurno commercial claims in public UI sources", () => {
    const blob =
      read("HomeHero.tsx") +
      read("HomeTruthMetrics.tsx") +
      read("VerifiedMetricCounter.tsx") +
      read("HomeProjects.tsx");
    assert.doesNotMatch(
      blob,
      /500\+|4\.9|200\+ Google|10-Year Warranty|Own Manufacturing|instant estimate|free consultation|98%|Book Free/i
    );
    assert.doesNotMatch(blob, /QuickFurno/);
  });

  test("hero has no inline planner", () => {
    const source = read("HomeHero.tsx");
    assert.doesNotMatch(source, /HomePlannerInline|HomePlannerEntry/);
    assert.match(source, /openPlanner/);
    assert.match(source, /pm-hero__credibility/);
    assert.match(source, /PM_PUNE_AREAS/);
  });

  test("credibility strip uses truthful values", () => {
    const content = read("content.ts");
    assert.match(content, /Focused Services/);
    assert.match(content, /Stages to Handover/);
    assert.match(content, /Pune Areas Covered/);
    assert.match(content, /Coordinated Team/);
    assert.match(
      content,
      /value: "3"[\s\S]*value: "4"[\s\S]*PM_PUNE_AREAS\.length[\s\S]*value: "1"/
    );
  });
});

describe("R5.2 counter mechanics", () => {
  test("reference-style timing and cleanup", () => {
    const source = read("VerifiedMetricCounter.tsx");
    assert.match(source, /threshold:\s*0\.4/);
    assert.match(source, /durationMs\s*=\s*2000/);
    assert.match(source, /delayMs\s*=\s*200/);
    assert.match(source, /easeOutCubic|Math\.pow\(1 - t, 3\)/);
    assert.match(source, /requestAnimationFrame/);
    assert.match(source, /setTimeout/);
    assert.doesNotMatch(source, /setInterval/);
    assert.match(source, /cancelAnimationFrame/);
    assert.match(source, /clearTimeout/);
    assert.match(source, /aria-hidden/);
  });

  test("public metric labels", () => {
    const content = read("content.ts");
    assert.match(content, /id: "areas"/);
    assert.match(content, /id: "services"/);
    assert.match(content, /id: "stages"/);
    assert.match(content, /id: "team"/);
    assert.match(content, /Focused Interior Services/);
    assert.match(content, /Stages from Planning to Handover/);
    assert.match(content, /Coordinated Design & Delivery Team/);
  });
});

describe("R5.2 pending projects and close copy", () => {
  test("pending proof mode and single copy keys", () => {
    assert.equal(HOME_PROJECT_PROOF_MODE, "pending");
    const content = read("content.ts");
    assert.match(content, /Project photography is being prepared\./);
    assert.doesNotMatch(content, /emptyHeading|emptyBody/);
    const source = read("HomeProjects.tsx");
    assert.match(source, /pm-projects__pending/);
    assert.doesNotMatch(source, /emptyHeading/);
  });

  test("final brief copy is truthful", () => {
    const content = read("content.ts");
    assert.match(content, /Take your interior plan with you\./);
    assert.match(content, /Nothing is submitted from this page\./);
    assert.doesNotMatch(content, /Ready to continue the conversation/);
  });
});

describe("R5.2 mobile CTA hierarchy", () => {
  test("nav plan CTA is desktop-classed and sticky observes hero", () => {
    assert.match(read("HomeNavigation.tsx"), /pm-nav__planCta/);
    assert.match(read("HomeNavigation.tsx"), /data-drawer-open/);
    assert.match(read("HomeStickyActions.tsx"), /data-hero-primary-cta/);
    assert.match(read("HomeStickyActions.tsx"), /PM_CTA_SHORT/);
  });
});
