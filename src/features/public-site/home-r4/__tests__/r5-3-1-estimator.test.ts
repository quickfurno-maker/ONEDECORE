/**
 * R5.3.1 estimator-to-plan atomic state and mapping tests.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import { computeEstimate } from "../budget-config.ts";
import {
  buildNoscriptPriceGuide,
  mapEstimatorToPlanSelection,
  toEstimateSummary,
} from "../estimator-plan-map.ts";
import {
  ensureRoom,
  formatInteriorBrief,
  getNextIncompleteStep,
  type PlanSnapshot,
} from "../plan-state.ts";
import { HOME_PROJECT_PROOF_MODE } from "../project-proof.ts";
import { HOME_CLAIMS } from "../claims.ts";

const root = process.cwd();
const home = join(root, "src/features/public-site/home-r4");

function read(name: string) {
  return readFileSync(join(home, name), "utf8");
}

function empty(overrides: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
    service: null,
    property: null,
    timeline: null,
    rooms: [],
    budgetComfort: null,
    estimateSummary: null,
    name: "",
    mobile: "",
    locality: "",
    message: "",
    whatsappConsent: false,
    privacyConsent: false,
    ...overrides,
  };
}

function applySelection(
  current: PlanSnapshot,
  serviceId: Parameters<typeof mapEstimatorToPlanSelection>[0],
  sizeId: string,
  finishId: Parameters<typeof mapEstimatorToPlanSelection>[2]
) {
  const selection = mapEstimatorToPlanSelection(serviceId, sizeId, finishId);
  assert.ok(selection);
  let rooms = current.rooms;
  for (const room of selection.rooms) {
    rooms = ensureRoom(rooms, room);
  }
  const prospective: PlanSnapshot = {
    ...current,
    service: selection.service,
    property: selection.property,
    rooms,
    budgetComfort: selection.budgetComfort,
    estimateSummary: toEstimateSummary(selection),
  };
  return {
    selection,
    prospective,
    step: getNextIncompleteStep(prospective),
  };
}

describe("R5.3.1 complete-home mapping", () => {
  test("empty + 1 BHK Essential opens at timeline step 3", () => {
    const { selection, prospective, step } = applySelection(
      empty(),
      "complete-home",
      "1bhk",
      "essential"
    );
    assert.equal(selection.service, "complete-home-interiors");
    assert.equal(selection.property, "apartment-1bhk");
    assert.deepEqual([...selection.rooms], []);
    assert.equal(prospective.property, "apartment-1bhk");
    assert.equal(step, 3);
  });

  test("empty + 2 BHK Premium carries ₹5.9L – ₹10.4L and apartment-2bhk", () => {
    const estimate = computeEstimate("complete-home", "2bhk", "premium");
    assert.ok(estimate);
    assert.equal(estimate.label, "₹5.9L – ₹10.4L");
    const { selection, step } = applySelection(
      empty(),
      "complete-home",
      "2bhk",
      "premium"
    );
    assert.equal(selection.property, "apartment-2bhk");
    assert.equal(selection.estimatorRangeLabel, "₹5.9L – ₹10.4L");
    assert.equal(step, 3);
  });

  test("existing timeline/locality/notes preserved → step 4", () => {
    const { prospective, step } = applySelection(
      empty({
        timeline: "within-3-months",
        locality: "Baner",
        message: "Prefer warm oak",
      }),
      "complete-home",
      "2bhk",
      "premium"
    );
    assert.equal(prospective.timeline, "within-3-months");
    assert.equal(prospective.locality, "Baner");
    assert.equal(prospective.message, "Prefer warm oak");
    assert.equal(step, 4);
  });
});

describe("R5.3.1 kitchen wardrobe selected-room mapping", () => {
  test("L-Shaped Premium kitchen maps rooms and service", () => {
    const { selection, step } = applySelection(
      empty(),
      "modular-kitchen",
      "l-shape",
      "premium"
    );
    assert.equal(selection.service, "modular-kitchens");
    assert.equal(selection.property, "single-room");
    assert.deepEqual([...selection.rooms], ["kitchen"]);
    assert.ok(selection.budgetComfort);
    assert.equal(step, 3);
  });

  test("7–10 ft Essential wardrobes dedupe on repeat", () => {
    const first = applySelection(empty(), "custom-wardrobes", "7-10", "essential");
    const second = applySelection(
      first.prospective,
      "custom-wardrobes",
      "7-10",
      "essential"
    );
    assert.equal(second.selection.service, "custom-wardrobes");
    assert.equal(second.selection.property, "single-room");
    assert.deepEqual([...second.prospective.rooms], ["wardrobes"]);
  });

  test("selected rooms map living bedrooms dining other", () => {
    const living = mapEstimatorToPlanSelection("selected-room", "living", "essential");
    const bedroom = mapEstimatorToPlanSelection("selected-room", "bedroom", "essential");
    const dining = mapEstimatorToPlanSelection("selected-room", "dining", "essential");
    const study = mapEstimatorToPlanSelection("selected-room", "study", "essential");
    assert.deepEqual(living?.rooms, ["living"]);
    assert.deepEqual(bedroom?.rooms, ["bedrooms"]);
    assert.deepEqual(dining?.rooms, ["dining"]);
    assert.deepEqual(study?.rooms, ["other"]);
    for (const selection of [living, bedroom, dining, study]) {
      assert.equal(selection?.service, "complete-home-interiors");
      assert.equal(selection?.property, "single-room");
    }
  });
});

describe("R5.3.1 CTA parity and brief", () => {
  test("both estimator CTAs call applyEstimateToPlanAndOpen", () => {
    const source = read("HomeBudgetEstimator.tsx");
    assert.match(source, /applyEstimateToPlanAndOpen/);
    assert.match(source, /data-conversion-action="estimator-refine"/);
    assert.match(source, /data-conversion-action="estimator-start-plan"/);
    assert.doesNotMatch(
      source,
      /estimator-start-plan[\s\S]*openPlanner\(plan\.getNextIncompleteStep/
    );
    const refineIdx = source.indexOf('data-conversion-action="estimator-refine"');
    const startIdx = source.indexOf('data-conversion-action="estimator-start-plan"');
    assert.ok(refineIdx > 0 && startIdx > refineIdx);
    assert.match(source, /onClick=\{applyCurrentEstimate\}/);
    assert.equal(
      (source.match(/onClick=\{applyCurrentEstimate\}/g) ?? []).length,
      2
    );
  });

  test("PlanContext exposes atomic applyEstimateToPlanAndOpen", () => {
    const source = read("PlanContext.tsx");
    assert.match(source, /applyEstimateToPlanAndOpen/);
    assert.match(source, /computeNextStep\(prospective\)/);
    assert.doesNotMatch(source, /setTimeout|queueMicrotask|requestAnimationFrame/);
  });

  test("1bhk maps to apartment-1bhk not 2bhk", () => {
    assert.equal(
      mapEstimatorToPlanSelection("complete-home", "1bhk", "essential")?.property,
      "apartment-1bhk"
    );
    assert.doesNotMatch(read("estimator-plan-map.ts"), /"1bhk": "apartment-2bhk"/);
    assert.match(read("content.ts"), /id: "apartment-1bhk"/);
  });

  test("brief includes estimate when present and omits when absent", () => {
    const withEstimate = formatInteriorBrief(
      empty({
        service: "complete-home-interiors",
        property: "apartment-2bhk",
        estimateSummary: {
          serviceLabel: "Complete Home Interiors",
          sizeLabel: "2 BHK",
          finishLabel: "Premium",
          rangeLabel: "₹5.9L – ₹10.4L",
        },
      })
    );
    assert.match(withEstimate, /Indicative estimate: ₹5\.9L – ₹10\.4L/);
    assert.match(withEstimate, /Estimate basis: Complete Home Interiors · 2 BHK · Premium/);
    assert.match(withEstimate, /Planning estimate only — not a final quotation/);

    const without = formatInteriorBrief(empty({ service: "modular-kitchens" }));
    assert.doesNotMatch(without, /Indicative estimate:/);
  });
});

describe("R5.3.1 no-JS price guide", () => {
  test("guide derives configured ranges without duplicated literals in component", () => {
    const guide = buildNoscriptPriceGuide();
    assert.equal(guide.length, 4);
    assert.ok(guide.some((g) => g.serviceLabel.includes("Complete Home")));
    assert.ok(guide.some((g) => g.serviceLabel.includes("Modular Kitchen")));
    assert.ok(guide.some((g) => g.serviceLabel.includes("Custom Wardrobe")));
    assert.ok(guide.some((g) => g.serviceLabel.includes("Selected Room")));
    const complete = guide.find((g) => g.serviceLabel.includes("Complete Home"))!;
    assert.ok(complete.sizes.some((s) => s.range.includes("₹") && s.label.includes("2 BHK")));

    const source = read("HomeBudgetEstimator.tsx");
    assert.match(source, /buildNoscriptPriceGuide/);
    assert.match(source, /NOSCRIPT_FINISH_GUIDANCE/);
    assert.match(source, /NOSCRIPT_PRICE_DISCLAIMER/);
    assert.doesNotMatch(source, /ranges vary by finish/);
  });
});

describe("R5.3.1 regression", () => {
  test("project proof remains pending and claims unchanged", () => {
    assert.equal(HOME_PROJECT_PROOF_MODE, "pending");
    assert.equal(HOME_CLAIMS.projectsDelivered, 500);
    assert.equal(HOME_CLAIMS.warrantyYears, 10);
  });

  test("content contract comment updated", () => {
    const content = read("content.ts");
    assert.match(content, /Owner-approved commercial claims derive from claims\.ts/);
    assert.match(content, /Indicative planning prices derive from budget-config\.ts/);
    assert.doesNotMatch(
      content,
      /Nothing may assert a number, a price, a promise/
    );
  });
});
