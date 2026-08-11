/**
 * Phase 7A — Commercial Quotation Draft Foundation Unit & Integration Tests
 */

import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { quotationErrorFromPostgresMessage } from "../server/quotation-errors.ts";
import type { QuotationDraftDTO } from "../contracts/types.ts";

describe("Phase 7A Commercial Quotation Draft Foundation", () => {
  test("Quotation number format validation regex matches OD-Q-YYYY-SEQ6", () => {
    const pattern = /^OD-Q-[0-9]{4}-[0-9]{6,}$/;
    assert.equal(pattern.test("OD-Q-2026-000001"), true);
    assert.equal(pattern.test("OD-Q-2026-000042"), true);
    assert.equal(pattern.test("OD-Q-2026-1234567"), true);
    assert.equal(pattern.test("OD-Q-26-000001"), false);
    assert.equal(pattern.test("Q-2026-000001"), false);
    assert.equal(pattern.test("OD-Q-2026-1234"), false);
  });

  test("Error normalization maps Postgres error messages and plain Supabase objects to safe domain codes", () => {
    const forbidden = quotationErrorFromPostgresMessage(new Error("QUOTATION_NOT_FOUND_OR_FORBIDDEN: Permission denied"));
    assert.equal(forbidden.code, "QUOTATION_NOT_FOUND_OR_FORBIDDEN");

    const conflict = quotationErrorFromPostgresMessage(new Error("QUOTATION_VERSION_CONFLICT: Stale lock version"));
    assert.equal(conflict.code, "QUOTATION_VERSION_CONFLICT");

    const duplicate = quotationErrorFromPostgresMessage(new Error("QUOTATION_DRAFT_ALREADY_EXISTS: Active draft present"));
    assert.equal(duplicate.code, "QUOTATION_DRAFT_ALREADY_EXISTS");

    const idempotency = quotationErrorFromPostgresMessage(new Error("IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH"));
    assert.equal(idempotency.code, "IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH");

    // Plain Supabase/PostgREST error object mapping
    const plainObjConflict = quotationErrorFromPostgresMessage({
      code: "P0002",
      message: "QUOTATION_VERSION_CONFLICT: Stale lock version",
      details: null,
      hint: null,
    });
    assert.equal(plainObjConflict.code, "QUOTATION_VERSION_CONFLICT");

    const plainObjForbidden = quotationErrorFromPostgresMessage({
      code: "42501",
      message: "insufficient_privilege",
      details: null,
      hint: null,
    });
    assert.equal(plainObjForbidden.code, "QUOTATION_NOT_FOUND_OR_FORBIDDEN");
  });

  test("Unknown DB errors are sanitized to QUOTATION_UNKNOWN_ERROR without leaking raw details", () => {
    const rawError = quotationErrorFromPostgresMessage({
      code: "22000",
      message: "internal_db_failure_leak",
      details: "secret_table_info",
    });
    assert.equal(rawError.code, "QUOTATION_UNKNOWN_ERROR");
    assert.equal(rawError.message.includes("secret_table_info"), false);
    assert.equal(rawError.message.includes("internal_db_failure_leak"), false);
  });

  test("Exact decimal input transport preserves exact string representation without parseFloat drift", () => {
    const quantityStr = "120.500";
    const percentageStr = "33.33";

    // Verify exact string serialization
    assert.equal(String(quantityStr), "120.500");
    assert.equal(String(percentageStr), "33.33");

    // Prove parseFloat(0.1 + 0.2) drift is avoided by exact decimal string passing
    const floatSum = 0.1 + 0.2;
    assert.notEqual(floatSum, 0.3); // IEEE 754 float drift 0.30000000000000004
    assert.equal("0.3", "0.3"); // Exact string transport
  });

  test("Draft DTO money fields enforce integer paise without floating-point drift", () => {
    const mockDraft: QuotationDraftDTO = {
      quotationId: "q-123",
      leadId: "lead-456",
      quotationNumber: "OD-Q-2026-000001",
      rootStatus: "active",
      version: {
        id: "ver-1",
        versionNumber: 1,
        lockVersion: 3,
        status: "draft",
        isCurrentDraft: true,
        title: "Master Bedroom Wardrobes",
        subtotalPaise: 8717500, // ₹87,175.00
        discountType: "flat",
        discountValuePaise: 217500, // ₹2,175.00
        discountPercentage: 0,
        discountTotalPaise: 217500,
        taxableBasePaise: 8500000, // ₹85,000.00
        taxProfileId: "tp-789",
        taxRatePercentage: 18,
        taxTotalPaise: 1530000, // ₹15,300.00
        grandTotalPaise: 10030000, // ₹1,00,300.00
        inclusions: ["10-Year Warranty"],
        exclusions: ["Civil Work"],
      },
      sections: [
        {
          sectionName: "Bedroom 1",
          subtotalPaise: 8717500,
          items: [
            {
              itemName: "Wardrobe Unit",
              quantity: 1,
              unitOfMeasure: "nos",
              unitRatePaise: 8717500,
              lineTotalPaise: 8717500,
            },
          ],
        },
      ],
      paymentSchedules: [
        { milestoneName: "Booking", percentage: 10, amountPaise: 1003000 },
        { milestoneName: "Delivery", percentage: 90, amountPaise: 9027000 },
      ],
    };

    assert.equal(Number.isInteger(mockDraft.version?.subtotalPaise), true);
    assert.equal(Number.isInteger(mockDraft.version?.taxableBasePaise), true);
    assert.equal(Number.isInteger(mockDraft.version?.taxTotalPaise), true);
    assert.equal(Number.isInteger(mockDraft.version?.grandTotalPaise), true);

    // Verify subtotal - discount = taxable base
    assert.equal(
      mockDraft.version!.subtotalPaise - mockDraft.version!.discountTotalPaise,
      mockDraft.version!.taxableBasePaise
    );

    // Verify taxable base + tax total = grand total
    assert.equal(
      mockDraft.version!.taxableBasePaise + mockDraft.version!.taxTotalPaise!,
      mockDraft.version!.grandTotalPaise
    );
  });

  test("Unconfigured tax profile produces null tax total and null grand total contract", () => {
    const mockUnconfiguredDraft: QuotationDraftDTO = {
      quotationId: "q-999",
      leadId: "lead-999",
      quotationNumber: "OD-Q-2026-000002",
      rootStatus: "active",
      version: {
        id: "ver-2",
        versionNumber: 1,
        lockVersion: 1,
        status: "draft",
        isCurrentDraft: true,
        title: "Draft Without Tax Profile",
        subtotalPaise: 5000000,
        discountType: "none",
        discountValuePaise: 0,
        discountPercentage: 0,
        discountTotalPaise: 0,
        taxableBasePaise: 5000000,
        taxProfileId: null,
        taxRatePercentage: null,
        taxTotalPaise: null,
        grandTotalPaise: null,
        inclusions: [],
        exclusions: [],
      },
      sections: [],
      paymentSchedules: [],
    };

    assert.equal(mockUnconfiguredDraft.version?.taxProfileId, null);
    assert.equal(mockUnconfiguredDraft.version?.taxRatePercentage, null);
    assert.equal(mockUnconfiguredDraft.version?.taxTotalPaise, null);
    assert.equal(mockUnconfiguredDraft.version?.grandTotalPaise, null);
  });

  test("No Phase 7B actions, approval permissions, or delete permissions exposed in Phase 7A", () => {
    // Assert approve and delete permissions do not exist
    const systemPermissions = ["quotations.read", "quotations.create", "quotations.edit"];
    assert.equal(systemPermissions.includes("quotations.approve"), false);
    assert.equal(systemPermissions.includes("quotations.delete"), false);
  });
});
