/**
 * Production homepage plan-state unit tests.
 */
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  completedStepCount,
  formatInteriorBrief,
  getNextIncompleteStep,
  planProgressPercent,
  toggleRoom,
  type PlanSnapshot,
} from "../plan-state.ts";

function base(overrides: Partial<PlanSnapshot> = {}): PlanSnapshot {
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

const READY = base({
  service: "modular-kitchens",
  property: "apartment-3bhk",
  timeline: "within-1-month",
  locality: "Baner",
  rooms: ["kitchen"],
});

describe("getNextIncompleteStep", () => {
  test("empty plan starts at the service step", () => {
    assert.equal(getNextIncompleteStep(base()), 1);
  });

  test("service chosen moves to the property step", () => {
    assert.equal(
      getNextIncompleteStep(base({ service: "modular-kitchens" })),
      2
    );
  });

  test("service and property move to the timeline step", () => {
    assert.equal(
      getNextIncompleteStep(
        base({ service: "modular-kitchens", property: "apartment-3bhk" })
      ),
      3
    );
  });

  test("core choices move to the brief step", () => {
    assert.equal(getNextIncompleteStep(READY), 4);
  });
});

describe("progress", () => {
  test("counts each satisfied step", () => {
    assert.equal(completedStepCount(base()), 0);
    assert.equal(completedStepCount(base({ service: "modular-kitchens" })), 1);
    assert.equal(completedStepCount(READY), 4);
  });

  test("reports percent between 0 and 100", () => {
    assert.equal(planProgressPercent(base()), 0);
    assert.equal(planProgressPercent(READY), 100);
  });
});

describe("formatInteriorBrief", () => {
  test("includes selected plan fields without contact submission", () => {
    const text = formatInteriorBrief(READY);
    assert.match(text, /ONEDECORE — My Interior Brief/);
    assert.match(text, /modular-kitchens/);
    assert.match(text, /Baner/);
    assert.doesNotMatch(text, /9876543210/);
    assert.doesNotMatch(text, /Budget comfort:/);
  });
});

describe("room toggle", () => {
  test("adds then removes a room without mutating the input", () => {
    const initial = ["living"] as const;
    const added = toggleRoom(initial, "kitchen");
    assert.deepEqual([...added], ["living", "kitchen"]);
    assert.deepEqual([...initial], ["living"]);
    assert.deepEqual([...toggleRoom(added, "living")], ["kitchen"]);
  });
});
