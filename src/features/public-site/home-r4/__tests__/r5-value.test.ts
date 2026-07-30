/**
 * R5.3 conversion master source and unit guards.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import { HOME_CLAIMS } from "../claims.ts";
import { HOME_PROJECT_PROOF_MODE } from "../project-proof.ts";
import { computeEstimate } from "../budget-config.ts";

const root = process.cwd();
const home = join(root, "src/features/public-site/home-r4");

function read(name: string) {
  return readFileSync(join(home, name), "utf8");
}

describe("R5.3 proof metrics", () => {
  test("owner-approved values derive from claims config", () => {
    assert.equal(HOME_CLAIMS.projectsDelivered, 500);
    assert.equal(HOME_CLAIMS.clientSatisfactionPercent, 98);
    assert.equal(HOME_CLAIMS.customDesignPercent, 100);
    assert.equal(HOME_CLAIMS.warrantyYears, 10);
    const content = read("content.ts");
    assert.match(content, /HOME_CLAIMS\.projectsDelivered/);
    assert.match(read("HomeTruthMetrics.tsx"), /PM_PROOF_METRICS\.map/);
  });

  test("counter uses IntersectionObserver, threshold 0.4, 2000ms, no setInterval", () => {
    const source = read("VerifiedMetricCounter.tsx");
    assert.match(source, /IntersectionObserver/);
    assert.match(source, /threshold: 0\.4/);
    assert.match(source, /durationMs = 2000/);
    assert.match(source, /requestAnimationFrame/);
    assert.doesNotMatch(source, /setInterval/);
    assert.match(source, /suffix/);
  });
});

describe("R5.3 room explorer", () => {
  test("four categories with approved asset mapping", () => {
    const content = read("content.ts");
    assert.match(content, /title: "Living Room"/);
    assert.match(content, /title: "Kitchen"/);
    assert.match(content, /title: "Bedroom & Wardrobes"/);
    assert.match(content, /title: "Dining & Shared Spaces"/);
  });

  test("combined services section uses addAreaToPlanAndOpen", () => {
    assert.match(read("HomeServicesRooms.tsx"), /addAreaToPlanAndOpen/);
  });
});

describe("R5.3 estimator", () => {
  test("computes complete home premium 2bhk range", () => {
    const result = computeEstimate("complete-home", "2bhk", "premium");
    assert.ok(result);
    assert.match(result!.label, /₹/);
  });

  test("estimator section exists with aria-live result", () => {
    const source = read("HomeBudgetEstimator.tsx");
    assert.match(source, /aria-live="polite"/);
    assert.match(source, /applyEstimateToPlanAndOpen/);
  });
});

describe("R5.3 FAQ and composition", () => {
  test("FAQ covers gate questions including warranty and factory", () => {
    const content = read("content.ts");
    assert.match(content, /How much do home interiors cost in Pune/);
    assert.match(content, /Does ONEDECORE manufacture its own furniture/);
    assert.match(content, /Is the design consultation free/);
    assert.equal((content.match(/question:/g) ?? []).length, 10);
  });

  test("production page order matches R5.4 architecture", () => {
    const page = read("ProductionHomePage.tsx");
    const body = page.slice(page.indexOf("return ("));
    const order = [
      "HomeHero",
      "HomeTruthMetrics",
      "HomeServicesRooms",
      "HomeBudgetEstimator",
      "HomeWhy",
      "HomeFactory",
      "HomeProcess",
      "HomeReviews",
      "HomeFaq",
      "HomePlan",
    ];
    let last = -1;
    for (const name of order) {
      const idx = body.indexOf(`<${name}`);
      assert.ok(idx > last, name);
      last = idx;
    }
    assert.doesNotMatch(body, /HomeProjects/);
  });

  test("project proof remains pending", () => {
    assert.equal(HOME_PROJECT_PROOF_MODE, "pending");
  });
});
