/**
 * Manual CRM lead phone — 10-digit Indian input policy tests.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import {
  canonicalizeOptionalPhone,
  MANUAL_LEAD_PHONE_ERROR_MESSAGE,
  normalizeManualLeadPhone,
  sanitizeManualLeadPhoneInput,
} from "../lib/phone-e164.ts";
import {
  validateManualLeadDuplicatePreviewInput,
  validateManualLeadFormInput,
} from "../contracts/manual-lead-contracts.ts";

const root = process.cwd();

describe("sanitizeManualLeadPhoneInput", () => {
  test("caps typing/paste to 10 digits", () => {
    assert.equal(
      sanitizeManualLeadPhoneInput("98786875654764564563"),
      "9878687565"
    );
  });

  test("strips non-digits and caps at 10", () => {
    assert.equal(
      sanitizeManualLeadPhoneInput("abcd9878687565xyz"),
      "9878687565"
    );
    assert.equal(
      sanitizeManualLeadPhoneInput("98abc786-8756"),
      "987868756"
    );
  });

  test("strips plus and country-code punctuation from paste", () => {
    assert.equal(
      sanitizeManualLeadPhoneInput("+919876543210"),
      "9876543210"
    );
    assert.equal(
      sanitizeManualLeadPhoneInput("919876543210"),
      "9876543210"
    );
  });
});

describe("normalizeManualLeadPhone", () => {
  test("accepts 9876543210 and canonicalizes to +919876543210", () => {
    assert.deepEqual(normalizeManualLeadPhone("9876543210"), {
      kind: "valid",
      digits: "9876543210",
      e164: "+919876543210",
    });
    assert.deepEqual(canonicalizeOptionalPhone("9876543210"), {
      phone: "+919876543210",
      error: null,
    });
  });

  test("accepts 1234567890 structurally (no separate prefix rule)", () => {
    assert.deepEqual(normalizeManualLeadPhone("1234567890"), {
      kind: "valid",
      digits: "1234567890",
      e164: "+911234567890",
    });
  });

  test("rejects 9 digits", () => {
    assert.equal(normalizeManualLeadPhone("987654321").kind, "invalid");
  });

  test("rejects 11+ digit strings server-side", () => {
    assert.equal(normalizeManualLeadPhone("98765432101").kind, "invalid");
  });

  test("rejects +919876543210 as manual raw input", () => {
    assert.equal(normalizeManualLeadPhone("+919876543210").kind, "invalid");
  });

  test("rejects 919876543210", () => {
    assert.equal(normalizeManualLeadPhone("919876543210").kind, "invalid");
  });

  test("rejects letters and punctuation", () => {
    assert.equal(normalizeManualLeadPhone("98abc54321").kind, "invalid");
    assert.equal(normalizeManualLeadPhone("98765-43210").kind, "invalid");
  });

  test("empty phone is empty", () => {
    assert.deepEqual(normalizeManualLeadPhone(""), { kind: "empty" });
    assert.deepEqual(normalizeManualLeadPhone("   "), { kind: "empty" });
    assert.deepEqual(normalizeManualLeadPhone(null), { kind: "empty" });
  });
});

describe("manual lead phone contract integration", () => {
  test("empty phone + valid email accepted", () => {
    const errors = validateManualLeadDuplicatePreviewInput({
      phone: null,
      email: "client@example.com",
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      locality: null,
    });
    assert.equal(errors.length, 0);
  });

  test("empty phone + empty email rejected by contact-channel rule", () => {
    const errors = validateManualLeadDuplicatePreviewInput({
      phone: "",
      email: null,
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      locality: null,
    });
    assert.ok(errors.some((entry) => entry.field === "contact"));
  });

  test("duplicate preview rejects malformed phone before proceed", () => {
    const errors = validateManualLeadDuplicatePreviewInput({
      phone: "+919876543210",
      email: null,
      serviceCode: "complete-home-interiors",
      propertyCode: "apartment-2bhk",
      locality: null,
    });
    assert.ok(errors.some((entry) => entry.field === "phone"));
    assert.equal(
      errors.find((entry) => entry.field === "phone")?.message,
      MANUAL_LEAD_PHONE_ERROR_MESSAGE
    );
  });

  test("10-digit phone passes and service canonicalizes to +91", () => {
    const errors = validateManualLeadFormInput(
      {
        submittedName: "Test Client",
        phone: "9876543210",
        email: null,
        serviceCode: "complete-home-interiors",
        propertyCode: "apartment-2bhk",
        timelineCode: "within-1-month",
        primarySourceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        locality: null,
        budgetComfortCode: null,
        roomCodes: [],
        message: null,
        sourceDetail: null,
        assigneeId: null,
        duplicateOverride: false,
        duplicateOverrideReason: null,
      },
      { mode: "manager", allowSelf: true }
    );
    assert.equal(errors.filter((entry) => entry.field === "phone").length, 0);
    assert.equal(
      canonicalizeOptionalPhone("9876543210").phone,
      "+919876543210"
    );
  });

  test("canonicalizeOptionalPhone returns friendly 10-digit error", () => {
    const result = canonicalizeOptionalPhone("abc");
    assert.equal(result.phone, null);
    assert.equal(result.error, MANUAL_LEAD_PHONE_ERROR_MESSAGE);
  });
});

describe("ManualLeadForm phone UI policy", () => {
  test("enforces digit-only 10-char field wiring", () => {
    const src = readFileSync(
      join(root, "src/features/crm/components/leads/ManualLeadForm.tsx"),
      "utf8"
    );
    assert.match(src, /sanitizeManualLeadPhoneInput/);
    assert.match(src, /maxLength=\{10\}/);
    assert.match(src, /inputMode="numeric"/);
    assert.match(src, /placeholder="9876543210"/);
    assert.match(src, /MANUAL_LEAD_PHONE_ERROR_MESSAGE/);
    assert.doesNotMatch(src, /placeholder="\+91/);
  });
});
