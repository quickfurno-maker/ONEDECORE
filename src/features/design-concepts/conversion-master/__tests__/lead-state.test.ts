import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  getNextIncompleteStep,
  hasRequiredContact,
  isValidIndianMobile,
  type LeadSnapshot,
} from "../lead-state.ts";

function base(overrides: Partial<LeadSnapshot> = {}): LeadSnapshot {
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

describe("getNextIncompleteStep", () => {
  test("returns 1 when service is missing", () => {
    assert.equal(getNextIncompleteStep(base()), 1);
  });

  test("returns 2 when property is missing", () => {
    assert.equal(
      getNextIncompleteStep(base({ service: "modular-kitchens" })),
      2
    );
  });

  test("returns 3 when timeline is missing", () => {
    assert.equal(
      getNextIncompleteStep(
        base({ service: "modular-kitchens", property: "2bhk" })
      ),
      3
    );
  });

  test("returns 4 when contact incomplete", () => {
    assert.equal(
      getNextIncompleteStep(
        base({
          service: "modular-kitchens",
          property: "2bhk",
          timeline: "ready-now",
        })
      ),
      4
    );
  });

  test("returns 4 when everything complete", () => {
    assert.equal(
      getNextIncompleteStep(
        base({
          service: "complete-home-interiors",
          property: "3bhk",
          timeline: "exploring",
          name: "Keshav",
          mobile: "9876543210",
          locality: "Baner",
          privacyConsent: true,
        })
      ),
      4
    );
  });
});

describe("mobile and contact validation", () => {
  test("accepts valid Indian mobiles", () => {
    assert.equal(isValidIndianMobile("9876543210"), true);
    assert.equal(isValidIndianMobile("6123456789"), true);
  });

  test("rejects invalid mobiles", () => {
    assert.equal(isValidIndianMobile("0876543210"), false);
    assert.equal(isValidIndianMobile("98765"), false);
    assert.equal(isValidIndianMobile(""), false);
  });

  test("hasRequiredContact requires privacy", () => {
    assert.equal(
      hasRequiredContact(
        base({
          name: "A",
          mobile: "9876543210",
          locality: "Koregaon Park",
          privacyConsent: false,
        })
      ),
      false
    );
    assert.equal(
      hasRequiredContact(
        base({
          name: "A",
          mobile: "9876543210",
          locality: "Koregaon Park",
          privacyConsent: true,
        })
      ),
      true
    );
  });
});
