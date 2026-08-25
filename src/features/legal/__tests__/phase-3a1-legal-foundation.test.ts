/**
 * Phase 3A1 — legal foundation guards (node:test).
 */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test, { describe } from "node:test";
import {
  LEGAL_PUBLICATION_MODE,
  LEGAL_ROUTE_PATHS,
  canPublishLegalPolicies,
} from "../legal-publication.ts";
import {
  BUSINESS_IDENTITY,
  getMissingLegalPublicationFields,
} from "../business-identity.ts";
import {
  CONSENT_VERSIONS,
  marketingConsentIsOptional,
  type ConsentPurposeCode,
} from "../consent-registry.ts";
import { allWarrantyPeriodsPending } from "../warranty-matrix.ts";
import { allRetentionPeriodsUnresolved } from "../retention-matrix.ts";
import { noSignedDpaClaimed } from "../processor-register.ts";
import { BUSINESS_TRUTH_REGISTRY } from "../business-truth-registry.ts";
import { DATA_INVENTORY_CURRENT_TRUTH } from "../data-inventory.ts";
import { WARRANTY_MARKETING_CLAIM_YEARS } from "../warranty-policy.ts";
import { PRIVACY_POLICY_CONTENT } from "../privacy-policy-content.ts";
import { TERMS_OF_USE_CONTENT } from "../terms-content.ts";
import { HOME_CLAIMS } from "../../public-site/home-r4/claims.ts";

const root = process.cwd();
const legalAppDir = join(root, "src/app/(legal)");

const REQUIRED_CONSENT_PURPOSES: readonly ConsentPurposeCode[] = [
  "SERVICE_ENQUIRY",
  "WHATSAPP_SERVICE",
  "MARKETING",
  "AI_ASSISTANCE_DISCLOSURE",
  "PORTFOLIO_MEDIA",
];

function flattenLegalSections(
  sections: readonly { readonly body: readonly string[] }[]
): string {
  return sections.flatMap((section) => section.body).join("\n");
}

describe("Phase 3A1 legal publication gate", () => {
  test("LEGAL_PUBLICATION_MODE is draft-review", () => {
    assert.equal(LEGAL_PUBLICATION_MODE, "draft-review");
  });

  test("canPublishLegalPolicies() is false in draft-review", () => {
    assert.equal(canPublishLegalPolicies(), false);
  });

  test("getMissingLegalPublicationFields() has pending mandatory fields", () => {
    assert.ok(getMissingLegalPublicationFields().length > 0);
  });

  test("LEGAL_ROUTE_PATHS lists five draft legal routes", () => {
    assert.equal(LEGAL_ROUTE_PATHS.length, 5);
    assert.deepEqual([...LEGAL_ROUTE_PATHS], [
      "/privacy",
      "/terms",
      "/warranty",
      "/data-rights",
      "/communication-consent",
    ]);
  });
});

describe("Phase 3A1 consent architecture", () => {
  test("marketingConsentIsOptional() and MARKETING defaultChecked false", () => {
    assert.equal(marketingConsentIsOptional(), true);
    const marketing = CONSENT_VERSIONS.find(
      (version) => version.purposeCode === "MARKETING"
    );
    assert.ok(marketing);
    assert.equal(marketing.defaultChecked, false);
    assert.equal(marketing.required, false);
  });

  test("consent versions cover six purpose codes including required set", () => {
    assert.equal(CONSENT_VERSIONS.length, 6);
    const codes = CONSENT_VERSIONS.map((version) => version.purposeCode);
    for (const purpose of REQUIRED_CONSENT_PURPOSES) {
      assert.ok(codes.includes(purpose), `missing purpose ${purpose}`);
    }
    assert.ok(codes.includes("SERVICE_COMMUNICATION"));
  });
});

describe("Phase 3A1 warranty and retention truth", () => {
  test("allWarrantyPeriodsPending()", () => {
    assert.equal(allWarrantyPeriodsPending(), true);
  });

  test("allRetentionPeriodsUnresolved()", () => {
    // MVP lead/consent/audit/suppression periods were owner-approved; others remain open.
    assert.equal(allRetentionPeriodsUnresolved(), false);
  });

  test("HOME_CLAIMS.warrantyYears referenced via WARRANTY_MARKETING_CLAIM_YEARS", () => {
    assert.equal(WARRANTY_MARKETING_CLAIM_YEARS, HOME_CLAIMS.warrantyYears);
    assert.equal(HOME_CLAIMS.warrantyYears, 10);
  });
});

describe("Phase 3A1 processors and business truth", () => {
  test("noSignedDpaClaimed()", () => {
    assert.equal(noSignedDpaClaimed(), true);
  });

  test("BUSINESS_TRUTH_REGISTRY structuredDataPermission all false", () => {
    assert.ok(BUSINESS_TRUTH_REGISTRY.length > 0);
    assert.ok(
      BUSINESS_TRUTH_REGISTRY.every((entry) => entry.structuredDataPermission === false)
    );
  });

  test("DATA_INVENTORY_CURRENT_TRUTH mentions planner and excludes live channels", () => {
    const joined = DATA_INVENTORY_CURRENT_TRUTH.join(" ").toLowerCase();
    assert.match(joined, /planner/);
    assert.match(joined, /whatsapp.*not live/);
    assert.match(joined, /groq.*not live/);
    assert.match(joined, /no campaign/);
    assert.match(joined, /no payment/);
  });
});

describe("Phase 3A1 draft legal content", () => {
  test("privacy content states current-site processing truth", () => {
    const text = flattenLegalSections(PRIVACY_POLICY_CONTENT);
    assert.match(text, /WhatsApp is not live/i);
    assert.match(text, /Groq AI processing is not live/i);
    assert.match(text, /remain on your device/i);
  });

  test("terms content mentions indicative prices and pending jurisdiction approval", () => {
    const text = flattenLegalSections(TERMS_OF_USE_CONTENT);
    assert.match(text, /indicative/i);
    assert.match(text, /not yet owner-approved|Proposed owner draft/i);
  });
});

describe("Phase 3A1 business identity gate", () => {
  test("no fake @onedecore.com emails; confirmed owner fields allowed", () => {
    const confirmedKeys = new Set([
      "entityType",
      "registeredOfficeAddress",
      "operatingOfficeSameAsRegistered",
      "businessEmail",
      "registrationIdentifierRequirement",
      "gstinApplicability",
      "tradingName",
      "serviceRegion",
      "contactRoleMapping",
    ]);
    for (const [key, value] of Object.entries(BUSINESS_IDENTITY)) {
      if (key === "tradingName" || key === "serviceRegion") continue;
      if (key === "gstinApplicability") {
        assert.equal(value, "pending-owner-decision");
        continue;
      }
      if (key === "registrationIdentifierRequirement") {
        // Proprietorship: CIN/LLPIN not applicable.
        assert.equal(value, "not-applicable");
        continue;
      }
      if (key === "contactRoleMapping") {
        assert.equal(typeof value, "object");
        assert.ok(value !== null);
        continue;
      }
      if (key === "entityType") {
        assert.equal(value, "proprietorship");
        continue;
      }
      if (key === "registeredOfficeAddress") {
        assert.equal(
          value,
          "SHOP NO 3, UBALE NAGAR, BEHIND RUDRA TATA MOTORS, WAGHOLI-412207"
        );
        continue;
      }
      if (key === "operatingOfficeSameAsRegistered") {
        assert.equal(value, true);
        continue;
      }
      if (key === "businessEmail") {
        assert.equal(value, "onedecore@gmail.com");
        assert.doesNotMatch(value, /@onedecore\.com/i);
        continue;
      }
      if (typeof value === "string") {
        assert.doesNotMatch(
          value,
          /@onedecore\.com/i,
          `${key} must not invent @onedecore.com`
        );
        if (!confirmedKeys.has(key)) {
          // Remaining identity/legal fields stay null until owner fills them.
          // (string path only reached for non-null remaining fields)
        }
      } else if (typeof value === "boolean") {
        // Only operatingOfficeSameAsRegistered is confirmed boolean above.
        assert.fail(`${key} boolean unexpectedly set`);
      } else {
        assert.equal(value, null, `${key} should be null pending owner input`);
      }
    }
  });
});

describe("Phase 3A1 legal app routes", () => {
  test("legal pages exist under src/app/(legal)/", () => {
    const pages = [
      "privacy/page.tsx",
      "terms/page.tsx",
      "warranty/page.tsx",
      "data-rights/page.tsx",
      "communication-consent/page.tsx",
      "layout.tsx",
    ];
    for (const page of pages) {
      assert.ok(
        existsSync(join(legalAppDir, page)),
        `missing legal page: ${page}`
      );
    }
  });
});
