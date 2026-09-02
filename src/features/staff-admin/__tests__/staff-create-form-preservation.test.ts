/**
 * Staff create form — value preservation and field-level error regression tests.
 *
 * Production defect: a single invalid field cleared every entered value on
 * /admin/staff/new. These tests pin the contract that makes that impossible:
 * submitted values are echoed back, and errors are attached to specific fields
 * from STRUCTURED sources (validation `field`, staff error `code`) rather than
 * by matching message text.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";
import { validateCreateStaffMemberInput } from "../contracts/dto.ts";
import { STAFF_ERROR_CODES } from "../contracts/errors.ts";
import {
  EMPTY_STAFF_CREATE_FORM_VALUES,
  firstInvalidStaffCreateField,
  hasStaffCreateFieldErrors,
  readStaffCreateFormValues,
  staffErrorCodeToField,
  STAFF_CREATE_FORM_FIELD_ORDER,
  STAFF_CREATE_FORM_FIELDS,
  STAFF_FORM_CORRECTION_SUMMARY,
  toStaffCreateFieldErrors,
} from "../contracts/staff-form-state.ts";

const root = process.cwd();
const FORM_COMPONENT = join(
  root,
  "src/features/staff-admin/components/StaffCreateForm.tsx"
);
const PICKER_COMPONENT = join(
  root,
  "src/features/staff-admin/components/ReportingManagerPicker.tsx"
);
const FORM_ACTIONS = join(
  root,
  "src/features/staff-admin/server/staff-form-actions.ts"
);

const MANAGER_ID = "22222222-2222-4222-8222-222222222222";
const POLICY_ID = "33333333-3333-4333-8333-333333333333";
const CLIENT_REQUEST_ID = "11111111-1111-4111-8111-111111111111";

/** A fully populated submission, mirroring what a Super Admin would type. */
function populatedFormData(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData();
  const base: Record<string, string> = {
    clientRequestId: CLIENT_REQUEST_ID,
    employeeCode: "OD-014",
    displayName: "Priya Nair",
    email: "priya.nair@onedecore.in",
    phoneE164: "+919876543210",
    designation: "Sales Executive",
    joiningDate: "2026-09-01",
    roleCode: "sales_executive",
    reportingManagerId: MANAGER_ID,
    attendancePolicyId: POLICY_ID,
    ...overrides,
  };
  for (const [key, value] of Object.entries(base)) {
    formData.set(key, value);
  }
  formData.set("attendanceEligible", "on");
  return formData;
}

function validateFrom(formData: FormData) {
  const values = readStaffCreateFormValues(formData);
  return {
    values,
    fieldErrors: toStaffCreateFieldErrors(
      validateCreateStaffMemberInput({
        clientRequestId: String(formData.get("clientRequestId") ?? ""),
        employeeCode: values.employeeCode,
        displayName: values.displayName,
        email: values.email,
        phoneE164: values.phoneE164 || null,
        designation: values.designation,
        joiningDate: values.joiningDate,
        // Cast mirrors the action: an invalid role is reported as a field error.
        roleCode: values.roleCode as never,
        reportingManagerId: values.reportingManagerId || null,
        attendanceEligible: values.attendanceEligible,
        attendancePolicyId: values.attendancePolicyId || null,
      })
    ),
  };
}

describe("staff create form — value preservation", () => {
  test("reads every editable control off FormData", () => {
    const values = readStaffCreateFormValues(populatedFormData());

    assert.deepEqual(values, {
      employeeCode: "OD-014",
      displayName: "Priya Nair",
      email: "priya.nair@onedecore.in",
      phoneE164: "+919876543210",
      designation: "Sales Executive",
      joiningDate: "2026-09-01",
      roleCode: "sales_executive",
      reportingManagerId: MANAGER_ID,
      attendanceEligible: true,
      attendancePolicyId: POLICY_ID,
    });

    // Every declared field must be covered, so a new control cannot be added
    // without also being preserved.
    for (const field of STAFF_CREATE_FORM_FIELDS) {
      assert.ok(field in values, `${field} missing from echoed values`);
    }
  });

  test("invalid phone preserves all other values and flags only phone", () => {
    const { values, fieldErrors } = validateFrom(
      populatedFormData({ phoneE164: "9876543210" })
    );

    assert.deepEqual(Object.keys(fieldErrors), ["phoneE164"]);
    assert.equal(values.employeeCode, "OD-014");
    assert.equal(values.displayName, "Priya Nair");
    assert.equal(values.email, "priya.nair@onedecore.in");
    assert.equal(values.designation, "Sales Executive");
    assert.equal(values.joiningDate, "2026-09-01");
    assert.equal(values.roleCode, "sales_executive");
    assert.equal(values.reportingManagerId, MANAGER_ID);
    assert.equal(values.attendanceEligible, true);
    assert.equal(values.attendancePolicyId, POLICY_ID);
    // The rejected value itself is echoed so the user can correct it in place.
    assert.equal(values.phoneE164, "9876543210");
  });

  test("invalid employee code preserves all other values and flags only the code", () => {
    const { values, fieldErrors } = validateFrom(
      populatedFormData({ employeeCode: "@@" })
    );

    assert.deepEqual(Object.keys(fieldErrors), ["employeeCode"]);
    assert.equal(values.displayName, "Priya Nair");
    assert.equal(values.email, "priya.nair@onedecore.in");
    assert.equal(values.phoneE164, "+919876543210");
    assert.equal(values.designation, "Sales Executive");
    assert.equal(values.joiningDate, "2026-09-01");
    assert.equal(values.reportingManagerId, MANAGER_ID);
    assert.equal(values.attendancePolicyId, POLICY_ID);
  });

  test("missing reporting manager highlights only the manager field", () => {
    const { values, fieldErrors } = validateFrom(
      populatedFormData({ reportingManagerId: "" })
    );

    assert.deepEqual(Object.keys(fieldErrors), ["reportingManagerId"]);
    assert.match(fieldErrors.reportingManagerId ?? "", /reporting manager/i);
    assert.equal(values.employeeCode, "OD-014");
    assert.equal(values.email, "priya.nair@onedecore.in");
  });

  test("attendance enabled without a policy highlights only the policy field", () => {
    const formData = populatedFormData();
    formData.set("attendancePolicyId", "");
    const { values, fieldErrors } = validateFrom(formData);

    assert.deepEqual(Object.keys(fieldErrors), ["attendancePolicyId"]);
    assert.equal(values.attendanceEligible, true);
    assert.equal(values.employeeCode, "OD-014");
    assert.equal(values.reportingManagerId, MANAGER_ID);
  });

  test("success path produces no field errors", () => {
    const { fieldErrors } = validateFrom(populatedFormData());

    assert.equal(hasStaffCreateFieldErrors(fieldErrors), false);
    assert.equal(firstInvalidStaffCreateField(fieldErrors), null);
  });

  test("multiple invalid fields are all reported in one pass", () => {
    const { fieldErrors } = validateFrom(
      populatedFormData({ employeeCode: "@@", email: "not-an-email" })
    );

    assert.ok(fieldErrors.employeeCode);
    assert.ok(fieldErrors.email);
    // First invalid follows DOM order, not insertion order.
    assert.equal(firstInvalidStaffCreateField(fieldErrors), "employeeCode");
  });

  test("non-visible validation fields stay form-wide", () => {
    // clientRequestId is a hidden control; it must not become a field error.
    const errors = toStaffCreateFieldErrors([
      { field: "clientRequestId", message: "Client request id must be a valid UUID." },
    ]);

    assert.equal(hasStaffCreateFieldErrors(errors), false);
  });

  test("empty defaults expose every field", () => {
    for (const field of STAFF_CREATE_FORM_FIELDS) {
      assert.ok(
        field in EMPTY_STAFF_CREATE_FORM_VALUES,
        `${field} missing from empty defaults`
      );
    }
    assert.equal(EMPTY_STAFF_CREATE_FORM_VALUES.attendanceEligible, false);
  });
});

describe("staff create form — structured error mapping", () => {
  test("server error codes map to fields without message matching", () => {
    assert.equal(staffErrorCodeToField("STAFF_EMPLOYEE_CODE_CONFLICT"), "employeeCode");
    assert.equal(staffErrorCodeToField("STAFF_EMAIL_CONFLICT"), "email");
    assert.equal(staffErrorCodeToField("STAFF_EMAIL_INVALID"), "email");
    assert.equal(staffErrorCodeToField("STAFF_PHONE_INVALID"), "phoneE164");
    assert.equal(staffErrorCodeToField("STAFF_INVALID_ROLE"), "roleCode");
    assert.equal(staffErrorCodeToField("STAFF_MANAGER_REQUIRED"), "reportingManagerId");
    assert.equal(staffErrorCodeToField("STAFF_MANAGER_INACTIVE"), "reportingManagerId");
    assert.equal(staffErrorCodeToField("STAFF_REPORTING_CYCLE"), "reportingManagerId");
    assert.equal(
      staffErrorCodeToField("STAFF_ATTENDANCE_POLICY_MISSING"),
      "attendancePolicyId"
    );
  });

  test("form-wide codes map to no field", () => {
    assert.equal(staffErrorCodeToField("STAFF_PERMISSION_DENIED"), null);
    assert.equal(staffErrorCodeToField("STAFF_UNAUTHORIZED"), null);
    assert.equal(staffErrorCodeToField("STAFF_IDEMPOTENCY_CONFLICT"), null);
    assert.equal(staffErrorCodeToField("STAFF_RPC_FAILED"), null);
  });

  test("every mapped field is a real form field and every code is known", () => {
    for (const code of STAFF_ERROR_CODES) {
      const field = staffErrorCodeToField(code);
      if (field !== null) {
        assert.ok(
          (STAFF_CREATE_FORM_FIELDS as readonly string[]).includes(field),
          `${code} maps to unknown field ${field}`
        );
      }
    }
  });

  test("field order matches the declared field list", () => {
    assert.deepEqual(
      [...STAFF_CREATE_FORM_FIELD_ORDER],
      [...STAFF_CREATE_FORM_FIELDS]
    );
  });
});

describe("staff create form — component contract", () => {
  test("action echoes values and never matches error messages", () => {
    const source = readFileSync(FORM_ACTIONS, "utf8");

    assert.match(source, /readStaffCreateFormValues/);
    assert.match(source, /staffErrorCodeToField/);
    assert.match(source, /toStaffCreateFieldErrors/);
    // The whole point: rejection paths carry values back.
    assert.match(source, /values,\s*\n\s*fieldErrors,/);
    // redirect() must still escape the StaffError branch.
    assert.match(source, /throw error;/);
    // No message-text matching for field routing.
    assert.doesNotMatch(source, /error\.message\.includes\(/);
  });

  test("every control is bound to an echoed default value", () => {
    const source = readFileSync(FORM_COMPONENT, "utf8");

    assert.match(source, /defaultValue=\{values\.employeeCode\}/);
    assert.match(source, /defaultValue=\{values\.displayName\}/);
    assert.match(source, /defaultValue=\{values\.email\}/);
    assert.match(source, /defaultValue=\{values\.phoneE164\}/);
    assert.match(source, /defaultValue=\{values\.designation\}/);
    assert.match(source, /defaultValue=\{values\.joiningDate\}/);
    assert.match(source, /defaultValue=\{values\.roleCode\}/);
    assert.match(source, /defaultValue=\{values\.reportingManagerId\}/);
    assert.match(source, /defaultChecked=\{values\.attendanceEligible\}/);
    assert.match(source, /defaultValue=\{values\.attendancePolicyId\}/);
  });

  test("invalid controls are accessible and focus-managed", () => {
    const source = readFileSync(FORM_COMPONENT, "utf8");

    assert.match(source, /aria-invalid=/);
    assert.match(source, /aria-describedby=/);
    assert.match(source, /firstInvalidStaffCreateField/);
    assert.match(source, /\.focus\(\)/);
    assert.match(source, /scrollIntoView/);
    // Browser validation must not pre-empt the server's structured errors.
    assert.match(source, /noValidate/);
  });

  test("reporting manager picker supports inline errors", () => {
    const source = readFileSync(PICKER_COMPONENT, "utf8");

    assert.match(source, /aria-invalid=/);
    assert.match(source, /aria-describedby=/);
    assert.match(source, /error \? errorId : undefined/);
  });

  test("correction summary wording is the locked copy", () => {
    assert.equal(
      STAFF_FORM_CORRECTION_SUMMARY,
      "Please correct the highlighted field(s)."
    );
  });
});
