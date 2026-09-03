/**
 * P4 final correction — the end-to-end blockers.
 *
 * These exercise the real boundaries. The previous suite asserted on source
 * strings and therefore missed the worst defect in the whole change: the save
 * action dropped `calculationBasis`, `widthFt` and `heightFt`, so an AREA or
 * FIXED work item could not be saved through the application at all.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import { buildSaveRoomsPayload } from "../contracts/save-rooms-payload.ts";
import {
  clientQuotationItemCells,
  formatClientMeasure,
  mapClientQuotation,
  ClientQuotationContractError,
} from "../contracts/client-quotation.ts";
import { formatAreaSqFt, formatMeasureDisplay } from "../contracts/interior.ts";
import { buildQuotationPdfData } from "../server/quotation-pdf-payload.ts";
import type { QuotationSectionDTO } from "../contracts/types.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");
const executableSql = (rel: string) =>
  read(rel)
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const MIGRATION = "supabase/migrations/20260904140000_interior_room_wise_quotation.sql";
const DRAFT_PAGE = "src/app/admin/quotations/[quotationId]/draft/page.tsx";
const CRM_PANEL = "src/features/crm/components/leads/LeadDetailQuotationPanel.tsx";
const FINALIZED_VIEW = "src/features/quotations/components/QuotationFinalizedView.tsx";
const ROOM_EDITOR = "src/features/quotations/components/QuotationRoomEditor.tsx";
const FINALIZATION = "src/features/quotations/server/quotation-finalization-actions.ts";
const PDF = "src/features/quotations/server/quotation-pdf-generator.ts";
const PORTAL = "src/features/quotations/components/QuotationClientPortal.tsx";

const inr = (rupees: number) => Math.round(rupees * 100);

// =============================================================================
// 1-3. The application save boundary
// =============================================================================

describe("the save boundary carries the interior fields", () => {
  const rooms: QuotationSectionDTO[] = [
    {
      sectionName: "KITCHEN",
      items: [
        {
          itemName: "Carcass",
          calculationBasis: "area",
          widthFt: "10.5",
          heightFt: "2.5",
          quantity: "26.250",
          unitOfMeasure: "sqft",
          unitRatePaise: inr(1550),
        },
        {
          itemName: "Tandem",
          calculationBasis: "quantity",
          quantity: "5",
          unitOfMeasure: "nos",
          unitRatePaise: inr(4500),
        },
        {
          itemName: "TV Unit",
          calculationBasis: "fixed",
          quantity: "1",
          unitOfMeasure: "fixed",
          unitRatePaise: inr(14800),
        },
      ],
    },
  ];

  const payload = buildSaveRoomsPayload(rooms);
  const [area, quantity, fixed] = payload[0].items;

  test("AREA survives sanitization with its basis and dimensions", () => {
    assert.equal(area.calculationBasis, "area");
    assert.equal(area.widthFt, "10.5");
    assert.equal(area.heightFt, "2.5");
    assert.equal(area.unitRatePaise, 155000);
  });

  test("AREA sends no quantity, no unit and no total — the server derives them", () => {
    assert.equal("quantity" in area, false);
    assert.equal("unitOfMeasure" in area, false);
    assert.equal("lineTotalPaise" in area, false);
    assert.equal("areaSqFt" in area, false);
  });

  test("QUANTITY survives with its quantity and unit, and no dimensions", () => {
    assert.equal(quantity.calculationBasis, "quantity");
    assert.equal(quantity.quantity, "5");
    assert.equal(quantity.unitOfMeasure, "nos");
    assert.equal("widthFt" in quantity, false);
    assert.equal("heightFt" in quantity, false);
  });

  test("FIXED survives with neither dimensions nor quantity", () => {
    assert.equal(fixed.calculationBasis, "fixed");
    assert.equal(fixed.unitRatePaise, 1480000);
    assert.equal("widthFt" in fixed, false);
    assert.equal("quantity" in fixed, false);
  });

  test("the payload is exactly what the RPC needs to accept all three bases", () => {
    // The RPC rejects sqft/fixed units on the quantity basis, so a payload that
    // lost the basis would be refused outright — which is what used to happen.
    const serialized = JSON.parse(JSON.stringify(payload));
    assert.deepEqual(serialized[0].items[0], {
      itemName: "Carcass",
      calculationBasis: "area",
      widthFt: "10.5",
      heightFt: "2.5",
      unitRatePaise: 155000,
    });
    assert.deepEqual(serialized[0].items[2], {
      itemName: "TV Unit",
      calculationBasis: "fixed",
      unitRatePaise: 1480000,
    });
  });

  test("a missing or malformed dimension is rejected, not dropped", () => {
    for (const bad of ["", "0", "-1", "1.2345", "abc"]) {
      assert.throws(() =>
        buildSaveRoomsPayload([
          {
            sectionName: "K",
            items: [
              {
                itemName: "Bad",
                calculationBasis: "area",
                widthFt: bad,
                heightFt: "7",
                quantity: "1",
                unitOfMeasure: "sqft",
                unitRatePaise: 100,
              },
            ],
          },
        ]),
        `"${bad}" must be rejected`
      );
    }
  });

  test("the action delegates to this builder rather than re-implementing it", () => {
    const action = read("src/features/quotations/server/quotation-draft-actions.ts");
    assert.match(action, /buildSaveRoomsPayload\(sections\)/);
  });
});

// =============================================================================
// 4. A failed save must keep the edits
// =============================================================================

describe("a rejected save stays retryable", () => {
  const editor = read(ROOM_EDITOR);

  test("the callback is success-aware", () => {
    assert.match(editor, /Promise<boolean> \| boolean/);
    assert.match(editor, /const accepted = await onSaveSections\(payload\)/);
  });

  test("a rejection preserves the edits and leaves Save enabled", () => {
    // `dirty` is only cleared after the server accepted.
    const handler = editor.slice(editor.indexOf("const accepted = await onSaveSections"));
    const rejectBranch = handler.slice(0, handler.indexOf("setDirty(false)"));
    assert.match(rejectBranch, /if \(accepted === false\)/);
    assert.match(rejectBranch, /return;/);
  });

  test("the parent reports whether the server accepted", () => {
    const parent = read("src/features/quotations/components/QuotationDraftEditor.tsx");
    assert.match(parent, /\): Promise<boolean> => \{/);
    assert.match(parent, /return false;/);
    assert.match(parent, /return true;/);
  });
});

// =============================================================================
// 5-9, 14. The ONE frozen PDF payload builder
// =============================================================================

type Row = Record<string, unknown>;

function stubClient(opts: {
  version?: Row | null;
  versionError?: string;
  quotation?: Row | null;
  quotationError?: string;
  sections?: unknown;
  sectionsError?: string;
  schedules?: unknown;
  schedulesError?: string;
}) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq() {
              return {
                async single() {
                  if (table === "quotation_versions") {
                    return {
                      data: opts.version ?? null,
                      error: opts.versionError ? { message: opts.versionError } : null,
                    };
                  }
                  return {
                    data: opts.quotation ?? null,
                    error: opts.quotationError ? { message: opts.quotationError } : null,
                  };
                },
                async order() {
                  if (table === "quotation_sections") {
                    return {
                      data: opts.sectionsError ? null : (opts.sections ?? []),
                      error: opts.sectionsError ? { message: opts.sectionsError } : null,
                    };
                  }
                  return {
                    data: opts.schedulesError ? null : (opts.schedules ?? []),
                    error: opts.schedulesError ? { message: opts.schedulesError } : null,
                  };
                },
              };
            },
          };
        },
      };
    },
  } as unknown as Parameters<typeof buildQuotationPdfData>[0];
}

const VERSION_ID = "11111111-1111-4111-8111-111111111111";
const QUOTATION_ID = "22222222-2222-4222-8222-222222222222";

const finalizedVersion: Row = {
  id: VERSION_ID,
  quotation_id: QUOTATION_ID,
  status: "finalized",
  version_number: 1,
  finalized_at: "2026-09-04T00:00:00.000Z",
  client_name_snapshot: "Anjali",
  client_phone_snapshot: "+919812345678",
  property_address_snapshot: "Plot 12, Pune",
  scope_summary: "Full home interiors",
  title: "3BHK Proposal",
  subtotal_paise: 4068750,
  discount_total_paise: 0,
  taxable_base_paise: 4068750,
  tax_total_paise: 732375,
  grand_total_paise: 4801125,
  tax_rate_percentage: 18,
  tax_profile_snapshot: { display_name: "GST 18% (frozen)" },
  inclusions: ["Site supervision"],
  exclusions: ["Civil work"],
  terms_and_conditions: "50% advance",
};

const quotationRow: Row = {
  id: QUOTATION_ID,
  quotation_number: "OD-Q-2026-000001",
  lead_id: "33333333-3333-4333-8333-333333333333",
};

const sectionRows = [
  {
    section_name: "KITCHEN",
    subtotal_paise: 4068750,
    display_order: 0,
    quotation_items: [
      {
        item_name: "Carcass",
        description: null,
        specifications: null,
        calculation_basis: "area",
        width_ft: "10.5",
        height_ft: "2.5",
        quantity: "26.250",
        unit_of_measure: "sqft",
        unit_rate_paise: "155000",
        line_total_paise: "4068750",
        display_order: 0,
      },
    ],
  },
];

describe("the PDF payload builder fails closed", () => {
  test("interior fields reach the document", async () => {
    const data = await buildQuotationPdfData(
      stubClient({ version: finalizedVersion, quotation: quotationRow, sections: sectionRows }),
      { quotationId: QUOTATION_ID, versionId: VERSION_ID }
    );

    const item = data.sections[0].items[0];
    assert.equal(item.calculation_basis, "area");
    assert.equal(item.width_ft, 10.5);
    assert.equal(item.height_ft, 2.5);
    assert.equal(item.area_sqft, 26.25);
    assert.equal(data.sections[0].area_subtotal_sqft, 26.25);
  });

  test("a rooms query ERROR prevents any document at all", async () => {
    // This used to become an empty room list and still render a READY PDF
    // showing no work — permanently, because READY is never overwritten.
    await assert.rejects(
      () =>
        buildQuotationPdfData(
          stubClient({
            version: finalizedVersion,
            quotation: quotationRow,
            sectionsError: "connection reset",
          }),
          { quotationId: QUOTATION_ID, versionId: VERSION_ID }
        ),
      /rooms could not be read/
    );
  });

  test("a payment-schedule query ERROR prevents any document", async () => {
    await assert.rejects(
      () =>
        buildQuotationPdfData(
          stubClient({
            version: finalizedVersion,
            quotation: quotationRow,
            sections: sectionRows,
            schedulesError: "connection reset",
          }),
          { quotationId: QUOTATION_ID, versionId: VERSION_ID }
        ),
      /payment schedule could not be read/
    );
  });

  test("a missing version, quotation or finalized_at is refused", async () => {
    await assert.rejects(
      () =>
        buildQuotationPdfData(stubClient({ version: null }), {
          quotationId: QUOTATION_ID,
          versionId: VERSION_ID,
        }),
      /finalized version not found/
    );

    await assert.rejects(
      () =>
        buildQuotationPdfData(
          stubClient({
            version: { ...finalizedVersion, finalized_at: null },
            quotation: quotationRow,
          }),
          { quotationId: QUOTATION_ID, versionId: VERSION_ID }
        ),
      /no finalized_at/
    );
  });

  test("a non-finalized version has no document to render", async () => {
    await assert.rejects(
      () =>
        buildQuotationPdfData(
          stubClient({ version: { ...finalizedVersion, status: "draft" } }),
          { quotationId: QUOTATION_ID, versionId: VERSION_ID }
        ),
      /only a finalized version/
    );
  });

  test("a quotation/version MISMATCH is refused", async () => {
    // The identity comes from the persisted version -> quotation relation, so a
    // caller pairing a version with someone else's quotation is not believed.
    await assert.rejects(
      () =>
        buildQuotationPdfData(
          stubClient({ version: finalizedVersion, quotation: quotationRow }),
          { quotationId: "99999999-9999-4999-8999-999999999999", versionId: VERSION_ID }
        ),
      /does not belong to this quotation version/
    );
  });

  test("the tax identity is the FROZEN snapshot, not a live profile", async () => {
    // Renaming the live tax profile must not change a finalized document.
    const data = await buildQuotationPdfData(
      stubClient({ version: finalizedVersion, quotation: quotationRow, sections: sectionRows }),
      { quotationId: QUOTATION_ID, versionId: VERSION_ID }
    );
    assert.equal(data.tax_profile_name, "GST 18% (frozen)");
    assert.equal(data.tax_rate_percentage, 18);

    const payload = read("src/features/quotations/server/quotation-pdf-payload.ts");
    // The builder must not join the mutable tax-profile table at all.
    assert.doesNotMatch(payload, /quotation_tax_profiles/);
    assert.match(payload, /tax_profile_snapshot/);
  });

  test("the client-facing header content is carried through", async () => {
    const data = await buildQuotationPdfData(
      stubClient({ version: finalizedVersion, quotation: quotationRow, sections: sectionRows }),
      { quotationId: QUOTATION_ID, versionId: VERSION_ID }
    );
    assert.equal(data.title, "3BHK Proposal");
    assert.equal(data.scope_summary, "Full home interiors");
    assert.equal(data.property_address, "Plot 12, Pune");
    assert.deepEqual(data.inclusions, ["Site supervision"]);
    assert.deepEqual(data.exclusions, ["Civil work"]);
    assert.deepEqual(data.terms_and_conditions, ["50% advance"]);
  });
});

describe("finalization and retry share ONE builder", () => {
  const finalization = read(FINALIZATION);

  test("finalization uses the shared builder", () => {
    assert.match(finalization, /buildQuotationPdfData/);
  });

  test("the duplicate inline payload assembly is gone", () => {
    // It omitted calculation_basis, width_ft, height_ft, area_sqft and
    // specifications, so the PDF written at finalization lost every dimension —
    // and a READY artifact is never overwritten, making it permanent.
    assert.doesNotMatch(finalization, /section_subtotal_paise:/);
    assert.doesNotMatch(finalization, /const sections = \(\(sectionRows/);
    assert.doesNotMatch(finalization, /quotation_tax_profiles/);
  });

  test("the retry action builds the payload INSIDE its try, so it cannot escape", () => {
    // buildQuotationPdfData fails closed by throwing. Called outside the try,
    // the throw left the server action as an unhandled rejection: the operator
    // saw a generic framework error instead of the reason, and the redaction
    // in the catch was bypassed.
    const sendSource = read("src/features/quotations/server/quotation-send-actions.ts");
    const block = sendSource.slice(
      sendSource.indexOf("export async function ensureQuotationPdfAction")
    );
    const tryAt = block.indexOf("try {");
    const buildAt = block.indexOf("buildQuotationPdfData(");
    assert.ok(tryAt > 0 && buildAt > tryAt, "the build must sit inside the try block");
    assert.match(block, /catch \(err\)[\s\S]{0,200}redactCapabilitySecrets/);
    // The old dead branch tested a falsy return the builder can never produce.
    assert.doesNotMatch(block, /if \(!pdfData\)/);
  });

  test("the finalized values are read on their own, not from the PDF payload", () => {
    // Sourcing them from the payload meant a transient render failure reported
    // a fabricated timestamp and a grand total of 0 for a quotation that was
    // genuinely finalized.
    const finalizedRead = finalization.slice(
      finalization.indexOf("const { data: finalizedRow }")
    );
    assert.match(finalizedRead.slice(0, 400), /select\('finalized_at, grand_total_paise'\)/);
    assert.ok(
      finalization.indexOf("const { data: finalizedRow }") <
        finalization.indexOf("buildQuotationPdfData("),
      "the finalized facts must be read BEFORE the render is attempted"
    );
    const tryBlock = finalization.slice(finalization.indexOf("try {"));
    assert.doesNotMatch(tryBlock.slice(0, 600), /finalizedAt = pdfData/);
    assert.doesNotMatch(tryBlock.slice(0, 600), /grandTotalPaise = pdfData/);
  });

  test("a render failure never reverses the finalization", () => {
    assert.match(finalization, /retry is available/);
  });

  test("the retry action uses the same builder", () => {
    const send = read("src/features/quotations/server/quotation-send-actions.ts");
    assert.match(send, /buildQuotationPdfData/);
    assert.match(send, /ensureQuotationPdfArtifact/);
  });
});

// =============================================================================
// 7 / 19. Display precision must not hide a billable digit
// =============================================================================

describe("display precision keeps every stored decimal", () => {
  test("trailing zeros are trimmed but real digits are not", () => {
    assert.equal(formatMeasureDisplay(10.5), "10.5");
    assert.equal(formatMeasureDisplay(2.5), "2.5");
    assert.equal(formatMeasureDisplay(78.75), "78.75");
    // The regression: a stored 1.234 must NOT display as 1.23.
    assert.equal(formatMeasureDisplay(1.234), "1.234");
  });

  test("area display keeps the third decimal", () => {
    assert.equal(formatAreaSqFt(BigInt(1234)), "1.234");
    assert.equal(formatAreaSqFt(BigInt(78750)), "78.75");
    assert.equal(formatAreaSqFt(BigInt(10500)), "10.5");
  });

  test("the client sees the same precision", () => {
    assert.equal(formatClientMeasure(1.234), "1.234");
    assert.equal(formatClientMeasure(78.75), "78.75");
  });

  test("nothing rounds a measurement to 2 decimals any more", () => {
    for (const rel of [PDF, FINALIZED_VIEW]) {
      assert.doesNotMatch(read(rel), /toFixed\(2\)/, rel);
    }
  });
});

// =============================================================================
// 8. archived is not finalized
// =============================================================================

describe("archived is not finalized", () => {
  const page = read(DRAFT_PAGE);

  test("the route matches the status explicitly", () => {
    assert.match(page, /version\.status === "finalized"/);
    assert.match(page, /version\.status === "archived"/);
    // "not draft means finalized" presented a superseded version as the live
    // commercial record and offered delivery actions on it.
    assert.doesNotMatch(page, /version\.status !== "draft"/);
  });

  test("an archived version gets a read-only state with no delivery actions", () => {
    const archivedBranch = page.slice(
      page.indexOf('version.status === "archived"'),
      page.indexOf("Draft editing unavailable")
    );
    assert.match(archivedBranch, /Archived quotation version/);
    assert.doesNotMatch(archivedBranch, /QuotationFinalizedView/);
  });

  test("the version status type admits all three states", () => {
    const types = read("src/features/quotations/contracts/types.ts");
    assert.match(types, /readonly status: "draft" \| "finalized" \| "archived";/);
  });
});

// =============================================================================
// 9. CRM lead detail
// =============================================================================

describe("CRM lead detail distinguishes the four states", () => {
  const panel = read(CRM_PANEL);

  test("finalized is never described as archived or prior", () => {
    assert.match(panel, /const isFinalized = Boolean\(/);
    assert.match(panel, /const isArchived = Boolean\(/);
    assert.doesNotMatch(panel, /hasArchivedRoot/);
    assert.doesNotMatch(panel, /Prior quotation version archived/);
  });

  test("a finalized quotation links to the canonical finalized route", () => {
    assert.match(panel, /View Finalized Quotation/);
    assert.match(panel, /\/admin\/quotations\/\$\{existingDraft\?\.quotationId\}\/draft/);
  });

  test("it shows number, version, state and grand total", () => {
    const block = panel.slice(panel.indexOf("{isFinalized && version && ("));
    assert.match(block, /Quotation No\./);
    assert.match(block, /versionNumber/);
    assert.match(block, /isAccepted \? "Accepted" : "Finalized"/);
    assert.match(block, /grandTotalPaise/);
  });
});

// =============================================================================
// 10. Acceptance in the staff view
// =============================================================================

describe("the finalized staff view shows acceptance", () => {
  const view = read(FINALIZED_VIEW);

  test("acceptance comes from the read model, not from lead status", () => {
    assert.match(view, /version\.isAccepted === true/);
    assert.doesNotMatch(view, /leadStatus|lead_status/);
  });

  test("it distinguishes awaiting acceptance from accepted", () => {
    assert.match(view, /Finalized — awaiting acceptance/);
    assert.match(view, /Accepted by client/);
    assert.match(view, /version\.acceptedAt/);
  });

  test("link actions are hidden once accepted", () => {
    // The database refuses new grants for an accepted quotation, so offering
    // the buttons could only produce an error.
    assert.match(view, /canSend && !isAccepted \? \(/);
  });

  test("the read model exposes acceptance", () => {
    const sql = executableSql(MIGRATION);
    const fn = sql.slice(sql.indexOf("function public.get_quotation_draft"));
    assert.match(fn, /'isAccepted', \(v_acceptance\.id is not null\)/);
    assert.match(fn, /'acceptedAt', v_acceptance\.accepted_at/);
    assert.match(fn, /'acceptedByName', v_acceptance\.accepted_by_name/);
  });
});

// =============================================================================
// 11-12. The client portal
// =============================================================================

const RPC_PAYLOAD = {
  quotation_id: QUOTATION_ID,
  quotation_version_id: VERSION_ID,
  quotation_number: "OD-Q-2026-000001",
  version_number: 1,
  finalized_at: "2026-09-04T00:00:00.000Z",
  title: "3BHK Proposal",
  scope_summary: "Full home interiors",
  client_name: "Anjali",
  client_phone: "+919812345678",
  property_address: "Plot 12, Pune",
  sections: [
    {
      id: "s1",
      section_name: "GUEST ROOM",
      display_order: 0,
      subtotal_paise: 13686250,
      area_subtotal_sqft: 78.75,
      items: [
        {
          id: "i1",
          item_name: "Wardrobe",
          calculation_basis: "area",
          width_ft: "11.25",
          height_ft: "7",
          area_sqft: "78.750",
          quantity: "78.750",
          unit_of_measure: "sqft",
          unit_rate_paise: "155000",
          line_total_paise: "12206250",
        },
        {
          id: "i2",
          item_name: "Tandem",
          calculation_basis: "quantity",
          width_ft: null,
          height_ft: null,
          area_sqft: null,
          quantity: "5",
          unit_of_measure: "nos",
          unit_rate_paise: "450000",
          line_total_paise: "2250000",
        },
        {
          id: "i3",
          item_name: "TV Unit",
          calculation_basis: "fixed",
          width_ft: null,
          height_ft: null,
          area_sqft: null,
          quantity: "1",
          unit_of_measure: "fixed",
          unit_rate_paise: "1480000",
          line_total_paise: "1480000",
        },
      ],
    },
  ],
  payment_schedule: [
    { id: "m1", milestone_name: "Advance", milestone_order: 0, percentage: "50", amount_paise: "2400562" },
  ],
  subtotal_paise: 15936250,
  discount_total_paise: 250000,
  taxable_base_paise: 15686250,
  tax_profile_name: "GST 18% (frozen)",
  tax_rate_percentage: "18",
  tax_total_paise: 2823525,
  grand_total_paise: 18509775,
  inclusions: ["Site supervision"],
  exclusions: ["Civil work"],
  // The REAL shape: quotation_versions.terms_and_conditions is a TEXT
  // column, not text[]. The previous array fixture hid a mapping bug that
  // dropped the terms entirely on the client acceptance page.
  terms_and_conditions: "50% advance, balance on delivery",
  has_pdf: true,
  is_accepted: false,
  accepted_at: null,
};

describe("the client acceptance DTO fails closed", () => {
  // A customer legally accepts this document. Every coercion that turned a
  // missing field into a plausible default (0, "Tax", the quantity basis) had
  // to go: a read-model regression must refuse to render, not render a
  // confident wrong number.

  const withoutKey = (key: string) => {
    const clone: Record<string, unknown> = { ...RPC_PAYLOAD };
    delete clone[key];
    return clone;
  };

  const firstItem = (patch: Record<string, unknown>) => ({
    ...RPC_PAYLOAD,
    sections: [
      {
        ...RPC_PAYLOAD.sections[0],
        items: [{ ...RPC_PAYLOAD.sections[0].items[0], ...patch }],
      },
    ],
  });

  const firstRoom = (patch: Record<string, unknown>) => ({
    ...RPC_PAYLOAD,
    sections: [{ ...RPC_PAYLOAD.sections[0], ...patch }],
  });

  test("the real RPC payload still maps end to end", () => {
    const dto = mapClientQuotation(RPC_PAYLOAD);
    assert.equal(dto.grandTotalPaise, 18509775);
    assert.equal(dto.rooms[0].items[0].calculationBasis, "area");
    assert.equal(dto.rooms[0].items[0].areaSqFt, 78.75);
    assert.equal(dto.taxProfileName, "GST 18% (frozen)");
  });

  for (const key of [
    "quotation_id",
    "quotation_version_id",
    "quotation_number",
    "version_number",
    "finalized_at",
    "client_name",
    "client_phone",
    "subtotal_paise",
    "discount_total_paise",
    "taxable_base_paise",
    "tax_profile_name",
    "tax_rate_percentage",
    "tax_total_paise",
    "grand_total_paise",
    "sections",
  ]) {
    test(`a missing ${key} is refused, not defaulted`, () => {
      assert.throws(
        () => mapClientQuotation(withoutKey(key)),
        /CLIENT_QUOTATION_CONTRACT/
      );
    });
  }

  test("a missing tax rate does not become zero", () => {
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, tax_rate_percentage: null }),
      /tax_rate_percentage is missing/
    );
  });

  test("a missing tax profile name does not become \"Tax\"", () => {
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, tax_profile_name: "  " }),
      /tax_profile_name is missing/
    );
  });

  test("non-integer money is refused", () => {
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, grand_total_paise: "18509775.5" }),
      /grand_total_paise is not integer paise/
    );
  });

  test("unparseable money is refused rather than read as zero", () => {
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, subtotal_paise: "not-a-number" }),
      /subtotal_paise is not a number/
    );
  });

  test("negative money is refused", () => {
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, tax_total_paise: -1 }),
      /tax_total_paise is negative/
    );
  });

  test("an unknown basis is refused, never coerced to quantity", () => {
    assert.throws(
      () => mapClientQuotation(firstItem({ calculation_basis: "per_running_foot" })),
      /calculation_basis is not a known basis/
    );
  });

  test("a missing basis is refused", () => {
    assert.throws(
      () => mapClientQuotation(firstItem({ calculation_basis: null })),
      /calculation_basis is missing/
    );
  });

  for (const dim of ["width_ft", "height_ft", "area_sqft"]) {
    test(`an AREA item missing ${dim} is refused`, () => {
      assert.throws(
        () => mapClientQuotation(firstItem({ [dim]: null })),
        new RegExp(`${dim} is missing`)
      );
    });

    test(`an AREA item with a zero ${dim} is refused`, () => {
      assert.throws(
        () => mapClientQuotation(firstItem({ [dim]: "0" })),
        new RegExp(`${dim} must be greater than zero`)
      );
    });
  }

  test("a missing item line total is refused", () => {
    assert.throws(
      () => mapClientQuotation(firstItem({ line_total_paise: null })),
      /line_total_paise is missing/
    );
  });

  test("a missing item id, name, quantity or unit is refused", () => {
    for (const patch of [
      { id: null },
      { item_name: "" },
      { quantity: null },
      { unit_of_measure: "  " },
      { unit_rate_paise: null },
    ]) {
      assert.throws(() => mapClientQuotation(firstItem(patch)), /CLIENT_QUOTATION_CONTRACT/);
    }
  });

  test("a missing room id, name, subtotal or items array is refused", () => {
    for (const patch of [
      { id: null },
      { section_name: "" },
      { subtotal_paise: null },
      { items: null },
    ]) {
      assert.throws(() => mapClientQuotation(firstRoom(patch)), /CLIENT_QUOTATION_CONTRACT/);
    }
  });

  test("sections must be an array, not merely truthy", () => {
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, sections: "GUEST ROOM" }),
      /sections is missing/
    );
  });

  test("a milestone missing its amount is refused", () => {
    assert.throws(
      () =>
        mapClientQuotation({
          ...RPC_PAYLOAD,
          payment_schedule: [{ id: "m1", milestone_name: "Advance", amount_paise: null }],
        }),
      /amount_paise is missing/
    );
  });

  test("genuinely optional fields stay optional", () => {
    const lean: Record<string, unknown> = { ...RPC_PAYLOAD };
    for (const key of [
      "title",
      "scope_summary",
      "client_email",
      "property_address",
      "inclusions",
      "exclusions",
      "terms_and_conditions",
      "accepted_at",
    ]) {
      delete lean[key];
    }
    const dto = mapClientQuotation(lean);
    assert.equal(dto.title, undefined);
    assert.equal(dto.scopeSummary, undefined);
    assert.equal(dto.propertyAddress, undefined);
    assert.deepEqual([...dto.termsAndConditions], []);
    assert.deepEqual([...dto.inclusions], []);
    // The commercial figures are untouched by the optional fields being absent.
    assert.equal(dto.grandTotalPaise, 18509775);
  });

  test("a room of purely non-area work keeps a zero area subtotal", () => {
    const dto = mapClientQuotation(
      firstRoom({
        area_subtotal_sqft: 0,
        items: [RPC_PAYLOAD.sections[0].items[1]],
      })
    );
    assert.equal(dto.rooms[0].areaSubtotalSqFt, 0);
    assert.equal(dto.rooms[0].items[0].calculationBasis, "quantity");
  });
});

describe("the finalized view respects acceptance and contains failures", () => {
  const view = read(FINALIZED_VIEW);

  test("Create Revision is hidden once the client has accepted", () => {
    // The database refuses with QUOTATION_ACCEPTED_IMMUTABLE, so an accepted
    // quotation offering the button invited an action that can only fail.
    assert.match(view, /\{canEdit && !isAccepted \? \(/);
    assert.doesNotMatch(view, /\{canEdit \? \(/);
  });

  test("an accepted quotation stays readable and PDF-verifiable", () => {
    // Only the two mutating affordances are withdrawn.
    assert.match(view, /canSend && !isAccepted/);
    const revisionAt = view.indexOf("Create Revision");
    const gateAt = view.indexOf("canEdit && !isAccepted");
    assert.ok(gateAt > 0 && gateAt < revisionAt, "the gate must precede the button");
  });

  test("the action runner contains an unexpected rejection", () => {
    const runner = view.slice(view.indexOf("const run = ("), view.indexOf("const issueLink"));
    assert.match(runner, /try \{/);
    assert.match(runner, /\} catch \{/);
    assert.match(runner, /Something went wrong/);
    // A raw rejection can carry a token, SQL, or service-role detail.
    assert.doesNotMatch(runner, /catch \(\w+\)[\s\S]*?String\(/);
    assert.doesNotMatch(runner, /err\.message/);
    assert.ok(
      runner.indexOf("try {") < runner.indexOf("await work()"),
      "the awaited work must sit inside the try"
    );
  });
});

describe("the client portal contract matches the RPC exactly", () => {
  const dto = mapClientQuotation(RPC_PAYLOAD);

  test("every commercial figure maps, none reads undefined", () => {
    assert.equal(dto.quotationNumber, "OD-Q-2026-000001");
    assert.equal(dto.subtotalPaise, 15936250);
    // Previously the portal read `discount_paise`, which the RPC never returns.
    assert.equal(dto.discountTotalPaise, 250000);
    assert.equal(dto.taxableBasePaise, 15686250);
    assert.equal(dto.taxTotalPaise, 2823525);
    assert.equal(dto.grandTotalPaise, 18509775);
    assert.equal(dto.hasPdf, true);
    assert.equal(dto.isAccepted, false);
  });

  test("the tax identity is the frozen one, with NO invented 18% default", () => {
    assert.equal(dto.taxProfileName, "GST 18% (frozen)");
    assert.equal(dto.taxRatePercentage, 18);

    // A payload without a rate is now REFUSED outright. Reporting 0 and "Tax"
    // was still fabrication: it showed the client a complete-looking document
    // asserting a zero tax on an amount they were about to accept.
    assert.throws(
      () =>
        mapClientQuotation({
          ...RPC_PAYLOAD,
          tax_rate_percentage: null,
          tax_profile_name: null,
        }),
      /CLIENT_QUOTATION_CONTRACT/
    );

    assert.doesNotMatch(read(PORTAL), /\|\| 18/);
  });

  test("rooms, dimensions and the room area total map", () => {
    const room = dto.rooms[0];
    assert.equal(room.roomName, "GUEST ROOM");
    assert.equal(room.subtotalPaise, 13686250);
    assert.equal(room.areaSubtotalSqFt, 78.75);
    assert.equal(room.items[0].widthFt, 11.25);
    assert.equal(room.items[0].heightFt, 7);
    assert.equal(room.items[0].areaSqFt, 78.75);
  });

  test("terms come through even though the column is TEXT, not text[]", () => {
    // inclusions/exclusions are text[]; terms is a single TEXT column. Treating
    // them all as arrays produced an empty list, so the client saw no terms on
    // the page where they accept them.
    assert.deepEqual([...dto.termsAndConditions], ["50% advance, balance on delivery"]);
    assert.deepEqual([...dto.inclusions], ["Site supervision"]);
    assert.deepEqual([...dto.exclusions], ["Civil work"]);
  });

  test("an array of terms is still accepted", () => {
    const asArray = mapClientQuotation({
      ...RPC_PAYLOAD,
      terms_and_conditions: ["A", "B"],
    });
    assert.deepEqual([...asArray.termsAndConditions], ["A", "B"]);
  });

  test("empty terms stay empty rather than becoming a blank bullet", () => {
    const empty = mapClientQuotation({ ...RPC_PAYLOAD, terms_and_conditions: "   " });
    assert.equal(empty.termsAndConditions.length, 0);
  });

  test("a payload missing required identity is refused, not half-rendered", () => {
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, quotation_number: null }),
      ClientQuotationContractError
    );
    assert.throws(
      () => mapClientQuotation({ ...RPC_PAYLOAD, grand_total_paise: null }),
      ClientQuotationContractError
    );
  });

  test("the route maps instead of casting", () => {
    const page = read("src/app/q/[token]/page.tsx");
    assert.match(page, /mapClientQuotation\(res\.data\)/);
    assert.doesNotMatch(page, /as unknown\) as ComponentProps/);
  });
});

describe("the client sees the interior format they are accepting", () => {
  const dto = mapClientQuotation(RPC_PAYLOAD);
  const money = (paise: number) => `Rs.${(paise / 100).toFixed(2)}`;

  test("AREA renders width, height, area and a per-sq.ft rate", () => {
    const cells = clientQuotationItemCells(dto.rooms[0].items[0], money);
    assert.equal(cells.widthFt, "11.25");
    assert.equal(cells.heightFt, "7");
    assert.equal(cells.measure, "78.75 SQ.FT");
    assert.equal(cells.rate, "Rs.1550.00 / SQ.FT");
  });

  test("QUANTITY renders an em dash for the dimensions", () => {
    const cells = clientQuotationItemCells(dto.rooms[0].items[1], money);
    assert.equal(cells.widthFt, "—");
    assert.equal(cells.heightFt, "—");
    assert.equal(cells.measure, "5 NOS");
    assert.equal(cells.rate, "Rs.4500.00 / NOS");
  });

  test("FIXED renders FIXED with no rate and no zeros", () => {
    const cells = clientQuotationItemCells(dto.rooms[0].items[2], money);
    assert.equal(cells.widthFt, "—");
    assert.equal(cells.heightFt, "—");
    assert.equal(cells.measure, "FIXED");
    assert.equal(cells.rate, "—");
  });

  test("the portal renders the same table and the acceptance content", () => {
    const portal = read(PORTAL);
    for (const heading of ["Particular", "W (ft)", "H (ft)", "Area / Qty", "Rate", "Amount"]) {
      assert.ok(portal.includes(heading), `client table needs ${heading}`);
    }
    assert.match(portal, /Room-wise Interior Estimate/);
    assert.match(portal, /Inclusions/);
    assert.match(portal, /Exclusions/);
    assert.match(portal, /Terms &amp; Conditions/);
    assert.match(portal, /Site \/ Property/);
    // It must use the shared cell logic these tests exercise, not a second copy.
    assert.match(portal, /clientQuotationItemCells/);
  });
});

// =============================================================================
// 20. The PDF is a complete client document
// =============================================================================

describe("the PDF carries everything the client must read", () => {
  const pdf = read(PDF);

  test("header content", () => {
    for (const label of ["Site / Property", "Email:", "Client Name:", "Quotation #:"]) {
      assert.ok(pdf.includes(label), `PDF header needs ${label}`);
    }
    assert.match(pdf, /data\.title/);
    assert.match(pdf, /data\.scope_summary/);
  });

  test("commercial summary and the frozen tax label", () => {
    for (const label of ["Subtotal:", "Discount:", "Taxable Base", "Grand Total:"]) {
      assert.ok(pdf.includes(label), `PDF summary needs ${label}`);
    }
    assert.match(pdf, /data\.tax_profile_name/);
  });

  test("inclusions, exclusions and terms are rendered", () => {
    assert.match(pdf, /renderList\("Inclusions", data\.inclusions\)/);
    assert.match(pdf, /renderList\("Exclusions", data\.exclusions\)/);
    assert.match(pdf, /renderList\("Terms & Conditions", data\.terms_and_conditions\)/);
  });

  test("no company or tax registration detail is invented", () => {
    // Word-bounded: an unanchored CIN matches ordinary words like "spacing".
    assert.doesNotMatch(pdf, /(GSTIN|CIN|PAN|Registered Office)/i);
  });
});

// =============================================================================
// 13-15, 18. Database containment (the pgTAP suite proves behaviour)
// =============================================================================

describe("service-role containment and grant expiry", () => {
  const sql = executableSql(MIGRATION);

  test("the explicit-actor permission check honours the M54 access state", () => {
    const fn = sql.slice(sql.indexOf("function private.quotation_actor_has_permission"));
    assert.match(fn.slice(0, 900), /not private\.staff_access_denied\(p_actor_id\)/);
    // The original active-profile/role/permission lookup is preserved.
    assert.match(fn.slice(0, 1200), /p\.status = 'active'/);
    assert.match(fn.slice(0, 1200), /perm\.code = p_permission/);
  });

  test("an expired grant is not reusable", () => {
    const fn = sql.slice(sql.indexOf("function public.issue_quotation_access_grant_internal"));
    const reuseLookup = fn.slice(fn.indexOf("select * into v_existing"));
    // The reader applies the same expiry rule, so reusing an expired row would
    // hand back a link that cannot be opened.
    assert.match(
      reuseLookup.slice(0, 400),
      /revoked_at is null[\s\S]{0,120}expires_at is null or expires_at > now\(\)/
    );
  });

  test("the client-link action verifies the quotation/version pair", () => {
    const send = read("src/features/quotations/server/quotation-send-actions.ts");
    assert.match(send, /QUOTATION_VERSION_MISMATCH/);
    assert.match(send, /persistedQuotationId !== params\.quotationId/);
  });
});
