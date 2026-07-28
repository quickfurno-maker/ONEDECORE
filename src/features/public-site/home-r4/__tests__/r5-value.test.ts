/**
 * R5 homeowner-value source and unit guards.
 */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import { HOME_PROJECT_PROOF_MODE } from "../project-proof.ts";
import { computeReadinessState, ensureRoom } from "../plan-state.ts";

const root = process.cwd();
const home = join(root, "src/features/public-site/home-r4");

function read(name: string) {
  return readFileSync(join(home, name), "utf8");
}

describe("R5 truth metrics", () => {
  test("exact public values are 3, 4 and 1", () => {
    const content = read("content.ts");
    assert.match(content, /value:\s*3/);
    assert.match(content, /value:\s*4/);
    assert.match(content, /value:\s*1/);
    assert.match(content, /Focused Interior Services/);
    assert.match(content, /Stages from Discovery to Handover/);
    assert.match(content, /Coordinated Design and Delivery Team/);
  });

  test("no project-count metric while proof pending", () => {
    assert.equal(HOME_PROJECT_PROOF_MODE, "pending");
    const source = read("content.ts");
    assert.doesNotMatch(source, /500\+|98%|10 Year Warranty|Client Satisfaction/i);
    assert.match(read("HomeTruthMetrics.tsx"), /PM_METRICS\.map/);
    assert.doesNotMatch(read("HomeTruthMetrics.tsx"), /value:\s*[5-9]\d+/);
  });

  test("counter uses IntersectionObserver and requestAnimationFrame without setInterval", () => {
    const source = read("VerifiedMetricCounter.tsx");
    assert.match(source, /IntersectionObserver/);
    assert.match(source, /requestAnimationFrame/);
    assert.doesNotMatch(source, /setInterval/);
    assert.match(source, /prefers-reduced-motion/);
    assert.match(source, /aria-hidden/);
  });
});

describe("R5 room explorer", () => {
  test("four categories with approved asset mapping", () => {
    const content = read("content.ts");
    assert.match(content, /title: "Living"/);
    assert.match(content, /title: "Kitchen"/);
    assert.match(content, /title: "Bedroom storage"/);
    assert.match(content, /title: "Dining and shared spaces"/);
    assert.match(content, /PM_ASSETS\.hero/);
    assert.match(content, /PM_ASSETS\.modularKitchens/);
    assert.match(content, /PM_ASSETS\.customWardrobes/);
    assert.match(content, /PM_ASSETS\.completeHomeInteriors/);
  });

  test("does not claim Category-C images as project photography", () => {
    const source = read("HomeRoomExplorer.tsx") + read("content.ts");
    assert.match(source, /Inspiration artwork/);
    assert.match(source, /not completed ONEDECORE project photography/);
  });

  test("ensureRoom preserves existing answers without duplicates", () => {
    const once = ensureRoom(["living"], "kitchen");
    assert.deepEqual(once, ["living", "kitchen"]);
    assert.deepEqual(ensureRoom(once, "kitchen"), ["living", "kitchen"]);
  });

  test("room explorer updates PlanContext via addRoom", () => {
    const source = read("HomeRoomExplorer.tsx");
    assert.match(source, /addRoom/);
    assert.match(source, /openPlanner/);
    assert.match(source, /getNextIncompleteStep/);
  });
});

describe("R5 scope approach process materials readiness", () => {
  test("six scope areas and planner CTA", () => {
    const content = read("content.ts");
    assert.match(content, /Space and room planning/);
    assert.match(content, /Final detailing and handover/);
    assert.match(read("HomeScopeIncluded.tsx"), /PM_SCOPE_COPY\.cta|Build My Interior Brief/);
  });

  test("four safe USPs without forbidden claims", () => {
    const content = read("content.ts");
    assert.match(content, /One coordinated team/);
    assert.match(content, /Materials decided with you/);
    assert.match(content, /Room-by-room planning/);
    assert.match(content, /Design and delivery stay connected/);
    assert.doesNotMatch(
      content,
      /warranty|own factory|BOQ transparency|zero hidden|project manager|on-time guarantee/i
    );
  });

  test("four process stages with three substeps each", () => {
    const content = read("content.ts");
    assert.match(content, /understand the home/);
    assert.match(content, /organise layouts and storage/);
    assert.match(content, /develop materials and finishes/);
    assert.match(content, /coordinate execution and installation/);
  });

  test("five material decision steps without brand/cost claims", () => {
    const content = read("content.ts");
    assert.match(content, /Look and feel/);
    assert.match(content, /Functional requirement/);
    assert.match(content, /Material shortlist/);
    assert.match(content, /Finish approval/);
    assert.match(content, /Execution reference/);
    assert.doesNotMatch(
      content.slice(content.indexOf("PM_MATERIAL_DECISION_STEPS")),
      /durability|brand claim|cost claim|factory|supplier/i
    );
  });

  test("readiness states are exploring / planning / brief-ready", () => {
    assert.equal(
      computeReadinessState({
        service: null,
        property: null,
        timeline: null,
        rooms: [],
        name: "",
        mobile: "",
        locality: "",
        message: "",
        whatsappConsent: false,
        privacyConsent: false,
      }),
      "exploring"
    );
    assert.equal(
      computeReadinessState({
        service: "modular-kitchens",
        property: "apartment-2bhk",
        timeline: null,
        rooms: [],
        name: "",
        mobile: "",
        locality: "",
        message: "",
        whatsappConsent: false,
        privacyConsent: false,
      }),
      "planning"
    );
    assert.equal(
      computeReadinessState({
        service: "modular-kitchens",
        property: "apartment-2bhk",
        timeline: "within-3-months",
        rooms: ["kitchen"],
        name: "",
        mobile: "",
        locality: "Koregaon Park",
        message: "",
        whatsappConsent: false,
        privacyConsent: false,
      }),
      "brief-ready"
    );
    assert.doesNotMatch(read("HomeReadiness.tsx"), /percent|AI score|qualified lead|quotation/i);
  });
});

describe("R5 FAQ and composition", () => {
  test("FAQ covers required homeowner questions and pending portfolio truth", () => {
    const content = read("content.ts");
    assert.match(content, /as authentic completed-project media is approved/);
    assert.match(content, /Is anything submitted from this page/);
    assert.match(content, /Can I change my plan later/);
    assert.doesNotMatch(
      content,
      /Yes\. Published projects are available in the ONEDECORE portfolio/
    );
  });

  test("production page order includes new sections", () => {
    const page = read("ProductionHomePage.tsx");
    const body = page.slice(page.indexOf("return ("));
    const order = [
      "HomeHero",
      "HomeTruthMetrics",
      "HomeVision",
      "HomeServices",
      "HomeRoomExplorer",
      "HomeScopeIncluded",
      "HomeProjects",
      "HomeApproach",
      "HomeProcess",
      "HomeMaterials",
      "HomeReadiness",
      "HomeFaq",
      "HomePlan",
    ];
    let last = -1;
    for (const name of order) {
      const idx = body.indexOf(`<${name}`);
      assert.ok(idx > last, name);
      last = idx;
    }
  });

  test("no design-concepts runtime and no QuickFurno identity", () => {
    assert.equal(existsSync(join(root, "src/app/design-concepts")), false);
    const blob = read("content.ts") + read("ProductionHomePage.tsx");
    assert.doesNotMatch(blob, /QuickFurno|500\+ Projects|Google rating/i);
  });
});
