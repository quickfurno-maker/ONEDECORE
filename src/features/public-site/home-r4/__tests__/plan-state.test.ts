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
    projectScope: null,
    budgetRange: null,
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

/*
 * A plan whose HOME step is answered the way `public-consult-v4` requires: a
 * project scope and a budget band from that scope's own ladder. `property` is
 * left set because the estimator still writes it and the brief still prints it
 * — it is simply no longer what gates a step.
 */
const READY = base({
  service: "modular-kitchens",
  projectScope: "kitchen",
  budgetRange: "kitchen-1-2l",
  property: "apartment-3bhk",
  timeline: "within-1-month",
  locality: "Baner",
  rooms: ["kitchen"],
});

describe("getNextIncompleteStep", () => {
  test("empty plan starts at the service step", () => {
    assert.equal(getNextIncompleteStep(base()), 1);
  });

  test("service chosen moves to the home step", () => {
    assert.equal(
      getNextIncompleteStep(base({ service: "modular-kitchens" })),
      2
    );
  });

  test("a scope without its budget band is still the home step", () => {
    // Half an answer is not an answer: the budget belongs to the scope.
    assert.equal(
      getNextIncompleteStep(
        base({ service: "modular-kitchens", projectScope: "kitchen" })
      ),
      2
    );
  });

  test("a budget from the WRONG ladder does not complete the home step", () => {
    /*
     * `villa-above-20l` is a real code and nonsense on a kitchen enquiry. If
     * the rail let this through, the sheet would look finished and the request
     * would be refused at the RPC.
     */
    assert.equal(
      getNextIncompleteStep(
        base({
          service: "modular-kitchens",
          projectScope: "kitchen",
          budgetRange: "villa-above-20l",
        })
      ),
      2
    );
  });

  test("service and a matched scope/budget move to the timeline step", () => {
    assert.equal(
      getNextIncompleteStep(
        base({
          service: "modular-kitchens",
          projectScope: "kitchen",
          budgetRange: "kitchen-2-3l",
        })
      ),
      3
    );
  });

  test("wardrobes skip the home step, because it asks them nothing", () => {
    /*
     * No scope list describes a wardrobe job and no owner-approved wardrobe
     * budget ladder exists. Demanding either would force the sheet to invent an
     * answer, so the step is complete as soon as the service is chosen.
     */
    assert.equal(
      getNextIncompleteStep(base({ service: "custom-wardrobes" })),
      3
    );
    assert.equal(
      getNextIncompleteStep(
        base({ service: "custom-wardrobes", timeline: "immediate" })
      ),
      4
    );
  });

  test("core choices move to the brief step", () => {
    assert.equal(getNextIncompleteStep(READY), 4);
  });

  test("core choices move to the brief step", () => {
    assert.equal(getNextIncompleteStep(READY), 4);
  });
});

describe("progress", () => {
  test("counts each satisfied step", () => {
    assert.equal(completedStepCount(base()), 0);
    assert.equal(completedStepCount(base({ service: "modular-kitchens" })), 1);
    // Wardrobes get the home step for free — it asks them nothing.
    assert.equal(completedStepCount(base({ service: "custom-wardrobes" })), 2);
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
