/**
 * Phase 2F-R4 pure plan-state unit tests.
 */
import assert from "node:assert/strict";
import test, { describe } from "node:test";
import {
  completedStepCount,
  getNextIncompleteStep,
  hasRequiredContact,
  isValidIndianMobile,
  planProgressPercent,
  toggleRoom,
  validateContact,
  type PlanSnapshot,
} from "../plan-state.ts";

function base(overrides: Partial<PlanSnapshot> = {}): PlanSnapshot {
  return {
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
    ...overrides,
  };
}

const COMPLETE = base({
  service: "modular-kitchens",
  property: "apartment-3bhk",
  timeline: "within-3-months",
  name: "Keshav",
  mobile: "9876543210",
  locality: "Baner",
  privacyConsent: true,
});

describe("R4 getNextIncompleteStep", () => {
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

  test("all choices made move to the contact step", () => {
    assert.equal(
      getNextIncompleteStep(
        base({
          service: "modular-kitchens",
          property: "apartment-3bhk",
          timeline: "exploring",
        })
      ),
      4
    );
  });

  test("a complete plan stays on the contact step", () => {
    assert.equal(getNextIncompleteStep(COMPLETE), 4);
  });
});

describe("R4 mobile validation", () => {
  test("accepts a valid Indian mobile", () => {
    assert.equal(isValidIndianMobile("9876543210"), true);
    assert.equal(isValidIndianMobile(" 6012345678 "), true);
  });

  test("rejects short, long, and out-of-range numbers", () => {
    assert.equal(isValidIndianMobile("12345"), false);
    assert.equal(isValidIndianMobile("98765432100"), false);
    assert.equal(isValidIndianMobile("5876543210"), false);
    assert.equal(isValidIndianMobile(""), false);
  });
});

describe("R4 contact requirements", () => {
  test("privacy consent is required", () => {
    assert.equal(hasRequiredContact({ ...COMPLETE, privacyConsent: false }), false);
  });

  test("whatsapp consent is not required", () => {
    assert.equal(hasRequiredContact({ ...COMPLETE, whatsappConsent: false }), true);
  });

  test("locality is required", () => {
    assert.equal(hasRequiredContact({ ...COMPLETE, locality: "  " }), false);
  });

  test("validateContact reports every missing field", () => {
    const errors = validateContact(base());
    assert.equal(errors.length, 4);
    assert.ok(errors.some((error) => /Name/.test(error)));
    assert.ok(errors.some((error) => /mobile/.test(error)));
    assert.ok(errors.some((error) => /locality/.test(error)));
    assert.ok(errors.some((error) => /Privacy/.test(error)));
  });

  test("validateContact is empty for a complete plan", () => {
    assert.deepEqual(validateContact(COMPLETE), []);
  });
});

describe("R4 progress", () => {
  test("counts each satisfied step", () => {
    assert.equal(completedStepCount(base()), 0);
    assert.equal(completedStepCount(base({ service: "modular-kitchens" })), 1);
    assert.equal(completedStepCount(COMPLETE), 4);
  });

  test("reports percent between 0 and 100", () => {
    assert.equal(planProgressPercent(base()), 0);
    assert.equal(planProgressPercent(COMPLETE), 100);
  });
});

describe("R4 room toggle", () => {
  test("adds then removes a room without mutating the input", () => {
    const initial = ["living"] as const;
    const added = toggleRoom(initial, "kitchen");
    assert.deepEqual([...added], ["living", "kitchen"]);
    assert.deepEqual([...initial], ["living"]);
    assert.deepEqual([...toggleRoom(added, "living")], ["kitchen"]);
  });
});
