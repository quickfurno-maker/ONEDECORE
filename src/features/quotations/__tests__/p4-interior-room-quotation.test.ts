/**
 * P4 — ONEDECORE interior room-wise quotation.
 *
 * The arithmetic cases below are taken from the owner's real quotation sample,
 * so they are regressions against a document that was actually sent, not
 * invented round numbers.
 *
 * The database contract is proved in
 * supabase/tests/database/45_interior_room_wise_quotation_test.sql. This suite
 * covers the shared calculation core, the product surface, and the anti-tamper
 * guarantees that are visible in source.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, test } from "node:test";

import {
  AREA_UNIT_OF_MEASURE,
  DEFAULT_CALCULATION_BASIS,
  FIXED_UNIT_OF_MEASURE,
  INTERIOR_QUANTITY_UNITS,
  ONEDECORE_ROOM_PRESETS,
  ONEDECORE_WORK_ITEM_SUGGESTIONS,
  QUOTATION_CALCULATION_BASES,
  clearIrrelevantBasisFields,
  computeInteriorLine,
  deriveAreaMilliSqFt,
  formatAreaSqFt,
  parseFeetToMilli,
} from "../contracts/interior.ts";

const root = process.cwd();
const read = (rel: string) => readFileSync(join(root, rel), "utf8");

/** Strips SQL comments: the migration DESCRIBES rules it must not merely mention. */
const executableSql = (rel: string) =>
  read(rel)
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n");

const MIGRATION = "supabase/migrations/20260904140000_interior_room_wise_quotation.sql";
const ROOM_EDITOR = "src/features/quotations/components/QuotationRoomEditor.tsx";
const FINALIZED_VIEW = "src/features/quotations/components/QuotationFinalizedView.tsx";
const DRAFT_PAGE = "src/app/admin/quotations/[quotationId]/draft/page.tsx";
const SEND_ACTIONS = "src/features/quotations/server/quotation-send-actions.ts";
const PDF = "src/features/quotations/server/quotation-pdf-generator.ts";

/** Rupees to paise, for readable expectations. */
const inr = (rupees: number) => Math.round(rupees * 100);

describe("AREA — the owner's real quotation lines", () => {
  const RATE = inr(1550);

  const areaCase = (width: string, height: string, rate: number) =>
    computeInteriorLine({
      basis: "area",
      rawWidthFt: width,
      rawHeightFt: height,
      unitRatePaise: rate,
    });

  test("Kitchen / Carcass — 10.5 x 2.5 = 26.25 sq.ft @ Rs.1550 = Rs.40,687.50", () => {
    const line = areaCase("10.5", "2.5", RATE);
    assert.equal(line.ok, true);
    assert.equal(line.ok && line.quantity, "26.250");
    assert.equal(line.ok && line.unitOfMeasure, "sqft");
    assert.equal(line.ok && line.lineTotalPaise, 4_068_750);
  });

  test("Kitchen / Overhead — 15.5 x 2.5 = 38.75 sq.ft = Rs.60,062.50", () => {
    const line = areaCase("15.5", "2.5", RATE);
    assert.equal(line.ok && line.quantity, "38.750");
    assert.equal(line.ok && line.lineTotalPaise, 6_006_250);
  });

  test("Guest Bedroom / Wardrobe — 11.25 x 7 = 78.75 sq.ft = Rs.1,22,062.50", () => {
    const line = areaCase("11.25", "7", RATE);
    assert.equal(line.ok && line.quantity, "78.750");
    assert.equal(line.ok && line.lineTotalPaise, 12_206_250);
  });

  test("Master Bedroom / Wardrobe — 4.5 x 7 = 31.5 sq.ft = Rs.48,825.00", () => {
    const line = areaCase("4.5", "7", RATE);
    assert.equal(line.ok && line.quantity, "31.500");
    assert.equal(line.ok && line.lineTotalPaise, 4_882_500);
  });

  test("Mandir — 2 x 7 = 14 sq.ft = Rs.21,700.00", () => {
    const line = areaCase("2", "7", RATE);
    assert.equal(line.ok && line.quantity, "14.000");
    assert.equal(line.ok && line.lineTotalPaise, 2_170_000);
  });

  test("a whole room's amounts sum exactly, with no floating drift", () => {
    const lines = [
      areaCase("10.5", "2.5", RATE),
      areaCase("15.5", "2.5", RATE),
      areaCase("11.25", "7", RATE),
    ];
    const subtotal = lines.reduce((sum, l) => sum + (l.ok ? l.lineTotalPaise : 0), 0);
    assert.equal(subtotal, 4_068_750 + 6_006_250 + 12_206_250);
    // Integer paise throughout — never a 578345.8333-style float.
    assert.ok(Number.isInteger(subtotal));
  });
});

describe("AREA — arithmetic is exact, not merely lucky", () => {
  test("decimals that IEEE-754 gets wrong are still exact here", () => {
    // 0.1 * 0.3 is 0.030000000000000002 in float arithmetic.
    const area = deriveAreaMilliSqFt(parseFeetToMilli("0.1")!, parseFeetToMilli("0.3")!);
    assert.equal(area, BigInt(30));
    assert.equal(formatAreaSqFt(area), "0.03");
  });

  test("area rounds half-up to 3 decimals, matching Postgres", () => {
    // 1.0005 x 1 would be 1.0005 -> 1.001 at 3 dp; feet only carry 3 dp, so use
    // a product that genuinely needs rounding: 1.111 x 1.111 = 1.234321.
    const area = deriveAreaMilliSqFt(parseFeetToMilli("1.111")!, parseFeetToMilli("1.111")!);
    assert.equal(area, BigInt(1234));
  });

  test("display keeps every stored decimal", () => {
    const line = computeInteriorLine({
      basis: "area",
      rawWidthFt: "1.111",
      rawHeightFt: "1.111",
      unitRatePaise: inr(1000),
    });
    assert.equal(line.ok && line.quantity, "1.234");
    // Truncating to 2 decimals here would show 1.23 while the amount was
    // billed on 1.234, so the document would contradict itself.
    assert.equal(line.ok && formatAreaSqFt(line.areaMilliSqFt!), "1.234");
  });

  test("invalid dimensions are rejected, never repaired", () => {
    for (const bad of ["", " ", "0", "-1", "abc", "10.5.5", "1.2345", "1e3", "10 5"]) {
      assert.equal(parseFeetToMilli(bad), null, `"${bad}" must be rejected`);
    }
  });

  test("width or height of zero is refused", () => {
    assert.equal(
      computeInteriorLine({ basis: "area", rawWidthFt: "0", rawHeightFt: "7", unitRatePaise: 1 }).ok,
      false
    );
    assert.equal(
      computeInteriorLine({ basis: "area", rawWidthFt: "7", rawHeightFt: "0", unitRatePaise: 1 }).ok,
      false
    );
  });
});

describe("QUANTITY basis", () => {
  test("Tandem — 5 nos @ Rs.4,500 = Rs.22,500", () => {
    const line = computeInteriorLine({
      basis: "quantity",
      rawQuantity: "5",
      unitOfMeasure: "nos",
      unitRatePaise: inr(4500),
    });
    assert.equal(line.ok && line.quantity, "5.000");
    assert.equal(line.ok && line.unitOfMeasure, "nos");
    assert.equal(line.ok && line.lineTotalPaise, 2_250_000);
  });

  test("dimensions play no part, so a stale width cannot leak in", () => {
    const withStaleDimensions = computeInteriorLine({
      basis: "quantity",
      rawWidthFt: "11.25",
      rawHeightFt: "7",
      rawQuantity: "5",
      unitOfMeasure: "nos",
      unitRatePaise: inr(4500),
    });
    assert.equal(withStaleDimensions.ok && withStaleDimensions.quantity, "5.000");
    assert.equal(withStaleDimensions.ok && withStaleDimensions.lineTotalPaise, 2_250_000);
    assert.equal("areaMilliSqFt" in withStaleDimensions, false);
  });

  test("the area and fixed units are refused on the quantity basis", () => {
    for (const unit of ["sqft", "SQFT", "fixed"]) {
      const line = computeInteriorLine({
        basis: "quantity",
        rawQuantity: "5",
        unitOfMeasure: unit,
        unitRatePaise: 1,
      });
      assert.equal(line.ok, false, unit);
    }
  });

  test("the interior unit list stays short and interior-specific", () => {
    assert.deepEqual([...INTERIOR_QUANTITY_UNITS], ["nos", "set", "pair", "unit"]);
  });
});

describe("FIXED basis", () => {
  test("TV Unit — fixed Rs.14,800", () => {
    const line = computeInteriorLine({ basis: "fixed", unitRatePaise: inr(14800) });
    assert.equal(line.ok && line.lineTotalPaise, 1_480_000);
    assert.equal(line.ok && line.quantity, "1.000");
    assert.equal(line.ok && line.unitOfMeasure, FIXED_UNIT_OF_MEASURE);
  });

  test("Sofa Back Moulding — fixed Rs.12,400", () => {
    const line = computeInteriorLine({ basis: "fixed", unitRatePaise: inr(12400) });
    assert.equal(line.ok && line.lineTotalPaise, 1_240_000);
  });

  test("dimensions and quantity are ignored entirely", () => {
    const line = computeInteriorLine({
      basis: "fixed",
      rawWidthFt: "11.25",
      rawHeightFt: "7",
      rawQuantity: "99",
      unitRatePaise: inr(14800),
    });
    // Canonicalized to 1 unit at the fixed amount, so the database's
    // line_total = round(quantity * rate) invariant still holds.
    assert.equal(line.ok && line.quantity, "1.000");
    assert.equal(line.ok && line.lineTotalPaise, 1_480_000);
  });
});

describe("switching basis clears what stopped being meaningful", () => {
  test("area keeps sqft and drops quantity", () => {
    const cleared = clearIrrelevantBasisFields("area");
    assert.equal(cleared.unitOfMeasure, AREA_UNIT_OF_MEASURE);
    assert.equal(cleared.rawQuantity, "");
    assert.equal(cleared.rawWidthFt, "");
  });

  test("quantity and fixed both drop the dimensions", () => {
    for (const basis of ["quantity", "fixed"] as const) {
      const cleared = clearIrrelevantBasisFields(basis);
      assert.equal(cleared.rawWidthFt, "", basis);
      assert.equal(cleared.rawHeightFt, "", basis);
    }
  });
});

describe("the product is interior-specific, not a generic builder", () => {
  test("area is the default basis for a new work item", () => {
    assert.equal(DEFAULT_CALCULATION_BASIS, "area");
  });

  test("exactly three bases, no formula engine", () => {
    assert.deepEqual([...QUOTATION_CALCULATION_BASES], ["area", "quantity", "fixed"]);
  });

  test("room presets are ONEDECORE rooms", () => {
    for (const room of ["Kitchen", "Master Bedroom", "Guest Bedroom", "Mandir / Pooja"]) {
      assert.ok(
        (ONEDECORE_ROOM_PRESETS as readonly string[]).includes(room),
        `${room} must be offered`
      );
    }
  });

  test("room presets are NOT unique keys — repeated bedrooms are normal", () => {
    // A flat routinely has several bedrooms, so nothing may key off the name.
    assert.ok((ONEDECORE_ROOM_PRESETS as readonly string[]).includes("Bedroom"));
    assert.ok((ONEDECORE_ROOM_PRESETS as readonly string[]).includes("Other / Custom Room"));
  });

  test("work-item suggestions are interior work, with sensible default bases", () => {
    const byLabel = new Map(ONEDECORE_WORK_ITEM_SUGGESTIONS.map((s) => [s.label, s.basis]));
    assert.equal(byLabel.get("Wardrobe"), "area");
    assert.equal(byLabel.get("Carcass"), "area");
    assert.equal(byLabel.get("TV Unit"), "fixed");
    assert.equal(byLabel.get("Tandem"), "quantity");
    // Suggestions are typing shortcuts, never a price list.
    const source = read("src/features/quotations/contracts/interior.ts");
    assert.doesNotMatch(source, /ratePaise:\s*\d/);
  });
});

describe("the server is authoritative — anti-tamper", () => {
  const sql = executableSql(MIGRATION);

  test("area quantity is DERIVED, never read from the payload", () => {
    const save = sql.slice(sql.indexOf("function public.save_quotation_draft_items"));
    const areaBranch = save.slice(
      save.indexOf("if v_basis = 'area' then"),
      save.indexOf("elsif v_basis = 'fixed' then")
    );
    assert.match(areaBranch, /private\.quotation_derive_area_sqft\(v_width, v_height\)/);
    // The area branch never reads a client quantity or area.
    assert.doesNotMatch(areaBranch, /->>'quantity'/);
    assert.doesNotMatch(areaBranch, /->>'area/);
  });

  test("a forged line total is never read anywhere in the item loop", () => {
    // Scoped to where CLIENT input is parsed. The idempotency-replay branch
    // legitimately reads subtotalPaise back out of the server's OWN stored
    // response snapshot, which is not client input at all.
    const save = sql.slice(sql.indexOf("function public.save_quotation_draft_items"));
    const itemLoop = save.slice(
      save.indexOf("for v_sec_elem in select"),
      save.indexOf("v_new_lock_version :=")
    );
    assert.doesNotMatch(itemLoop, /->>'lineTotalPaise'/);
    assert.doesNotMatch(itemLoop, /->>'subtotalPaise'/);
    assert.doesNotMatch(itemLoop, /->>'area/);
    // The amount is computed from the derived quantity and the rate.
    assert.match(itemLoop, /v_raw_line_total := round\(\(v_raw_qty \* v_raw_rate\)::numeric\)/);
  });

  test("the database refuses a stored area that disagrees with its dimensions", () => {
    assert.match(sql, /constraint chk_quotation_items_area_shape/);
    assert.match(sql, /quantity = round\(\(width_ft \* height_ft\)::numeric, 3\)/);
    assert.match(sql, /width_ft is not null and width_ft > 0/);
    assert.match(sql, /height_ft is not null and height_ft > 0/);
  });

  test("quantity and fixed items cannot carry dimensions at all", () => {
    assert.match(sql, /constraint chk_quotation_items_non_area_shape/);
    assert.match(sql, /width_ft is null and height_ft is null/);
  });

  test("fixed canonicalizes so the existing total invariant still holds", () => {
    assert.match(sql, /constraint chk_quotation_items_fixed_shape/);
    assert.match(sql, /unit_rate_paise = line_total_paise/);
  });

  test("the optimistic lock, idempotency and draft-only rules are preserved", () => {
    const save = sql.slice(sql.indexOf("function public.save_quotation_draft_items"));
    assert.match(save, /QUOTATION_VERSION_CONFLICT: Stale lock version/);
    assert.match(save, /IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH/);
    assert.match(save, /private\.quotation_can_edit\(p_quotation_id\)/);
    assert.match(save, /and status = 'draft'/);
    assert.match(save, /private\.recalculate_quotation_totals/);
    assert.match(save, /'quotation\.draft_updated'/);
  });

  test("legacy rows are classified without inventing dimensions", () => {
    assert.match(sql, /update public\.quotation_items\s*\n\s*set calculation_basis = 'fixed'/);
    // The only backfill is the unambiguous fixed shape; nothing writes a width.
    const backfill = sql.slice(
      sql.indexOf("update public.quotation_items"),
      sql.indexOf("alter table public.quotation_items\n  drop constraint if exists chk_quotation_items_calculation_basis")
    );
    assert.doesNotMatch(backfill, /width_ft\s*=/);
    assert.doesNotMatch(backfill, /height_ft\s*=/);
  });
});

describe("the canonical hash covers the measurements", () => {
  const sql = executableSql(MIGRATION);
  const hashFn = sql.slice(sql.indexOf("function private.compute_canonical_quotation_sha256"));

  test("dimensions and basis are inside the hashed payload", () => {
    for (const field of [
      "calculation_basis",
      "width_ft",
      "height_ft",
      "area_sqft",
      "quantity",
      "unit_of_measure",
      "unit_rate_paise",
      "line_total_paise",
      "specifications",
      "display_order",
    ]) {
      assert.match(hashFn, new RegExp(`'${field}'`), field);
    }
  });

  test("room identity and order are hashed", () => {
    assert.match(hashFn, /'room_name', qs\.section_name/);
    assert.match(hashFn, /'display_order', qs\.display_order/);
    assert.match(hashFn, /order by qs\.display_order asc, qs\.id asc/);
    assert.match(hashFn, /order by qi\.display_order asc, qi\.id asc/);
  });

  test("the canonical form is versioned so the change is explicit", () => {
    // Silently redefining what an existing hash attested to would be worse than
    // changing the tag. Production holds zero finalized versions.
    assert.match(hashFn, /'canonical_form', 'odq-content-v2-interior'/);
  });

  test("the existing commercial fields are still hashed", () => {
    for (const field of [
      "grand_total_paise",
      "taxable_base_paise",
      "tax_total_paise",
      "discount_total_paise",
      "payment_schedule",
      "inclusions",
      "exclusions",
      "terms_and_conditions",
    ]) {
      assert.match(hashFn, new RegExp(`'${field}'`), field);
    }
  });
});

describe("finalized quotation management is reachable after reload", () => {
  test("the draft route renders a finalized view instead of an error", () => {
    const page = read(DRAFT_PAGE);
    assert.match(page, /QuotationFinalizedView/);
    // "Archived" was the wrong word for a finalized quotation, and it was a
    // dead end: the controls simply vanished after a reload.
    assert.doesNotMatch(page, /Archived or Non-Editable Quotation State/);
  });

  test("a finalized quotation is never called archived", () => {
    assert.doesNotMatch(read(FINALIZED_VIEW), /archived/i);
  });

  test("the finalized view shows the frozen commercial record", () => {
    const view = read(FINALIZED_VIEW);
    for (const label of [
      "Finalized",
      "Content SHA-256",
      "Room",
      "Payment Schedule",
      "Create Revision",
    ]) {
      assert.ok(view.includes(label), `finalized view must show ${label}`);
    }
  });

  test("the finalized view has no editing controls", () => {
    const view = read(FINALIZED_VIEW);
    assert.doesNotMatch(view, /<input/);
    assert.doesNotMatch(view, /saveRooms|onSaveRooms/);
  });
});

describe("the secure client link does not depend on WhatsApp", () => {
  const source = read(SEND_ACTIONS);

  test("there is a manual link action separate from the WhatsApp send", () => {
    assert.match(source, /export async function generateQuotationClientLinkAction/);
  });

  test("it creates no conversation, no send intent and no provider call", () => {
    const block = source.slice(source.indexOf("export async function generateQuotationClientLinkAction"));
    assert.doesNotMatch(block, /create_quotation_whatsapp_service_send_intent/);
    assert.doesNotMatch(block, /dispatchWhatsappSendIntent/);
    assert.doesNotMatch(block, /whatsapp_conversations/);
  });

  test("the reused grant derives from the PERSISTED identity", () => {
    // Deriving from a freshly generated but unpersisted nonce would return a
    // link whose hash cannot match the stored grant — a link that simply fails.
    const block = source.slice(source.indexOf("export async function generateQuotationClientLinkAction"));
    assert.match(block, /derivation_nonce/);
    assert.match(block, /persistedNonce/);
    assert.match(block, /hashCapabilityToken/);
    // And a mismatch fails closed rather than handing over a broken link.
    assert.match(block, /CAPABILITY_IDENTITY_MISMATCH/);
  });

  test("the migration returns the persisted nonce on reuse", () => {
    const sql = executableSql(MIGRATION);
    const fn = sql.slice(sql.indexOf("function public.issue_quotation_access_grant_internal"));
    const reuse = fn.slice(fn.indexOf("if v_existing.id is not null and coalesce(p_reissue, false) = false then"));
    assert.match(reuse.slice(0, 700), /'derivation_nonce', v_existing\.derivation_nonce/);
    assert.match(reuse.slice(0, 700), /'capability_token_hash', v_existing\.capability_token_hash/);
  });

  test("no plaintext token or full URL is persisted or logged", () => {
    const start = source.indexOf("export async function generateQuotationClientLinkAction");
    const block = source.slice(start, source.indexOf("export async function", start + 10));
    assert.doesNotMatch(block, /console\.(log|info|warn|error)/);
    // The token is returned to the caller only. The one table read is the
    // quotation/version identity check; nothing WRITES the token anywhere.
    assert.doesNotMatch(block, /\.insert\(|\.upsert\(|\.update\(/);
    assert.match(block, /\.from\("quotation_versions"\)/);
    // Only the relative path is produced — no absolute URL is built or stored.
    assert.match(block, /clientLinkPath: `\/q\/\$\{token\}`/);
  });

  test("the existing WhatsApp path keeps its own prerequisites", () => {
    assert.match(source, /export async function sendQuotationAction/);
    assert.match(source, /create_quotation_whatsapp_service_send_intent/);
  });
});

describe("finalized PDF can be ensured or retried", () => {
  test("READY is reused and never re-rendered or overwritten", () => {
    const source = read(PDF);
    assert.match(source, /reservedObj\.status === "ready"/);
    assert.match(source, /skippedRender: true/);
    assert.match(source, /upsert: false/);
  });

  test("an authorized retry action exists for finalized versions", () => {
    const source = read(SEND_ACTIONS);
    assert.match(source, /export async function ensureQuotationPdfAction/);
    const block = source.slice(source.indexOf("export async function ensureQuotationPdfAction"));
    assert.match(block, /finalized/);
    assert.match(block, /ensureQuotationPdfArtifact/);
  });
});

describe("the room-wise PDF renders interior measurements", () => {
  const source = read(PDF);

  test("the table is the owner's PARTICULAR / W / H / AREA / RATE / AMOUNT shape", () => {
    for (const header of ["PARTICULAR", "W (FT)", "H (FT)", "AREA / QTY", "RATE", "AMOUNT"]) {
      assert.ok(source.includes(header), `PDF must render the ${header} column`);
    }
  });

  test("fixed and quantity rows show an em dash, not meaningless zeros", () => {
    assert.match(source, /EM_DASH/);
    const row = source.slice(source.indexOf("function interiorRowCells"));
    assert.match(row.slice(0, 1400), /basis === "fixed"/);
    assert.match(row.slice(0, 1400), /EM_DASH/);
    // A fixed item reports no width, so the cell says "not applicable".
    assert.match(row.slice(0, 1400), /formatFeetCell/);
  });

  test("each room prints a subtotal and its area total", () => {
    assert.match(source, /ROOM SUBTOTAL/);
    assert.match(source, /AREA TOTAL/);
  });

  test("the table header repeats on a continued page", () => {
    assert.match(source, /drawItemsHeader/);
    assert.match(source, /continued/i);
  });

  test("money is rupee-formatted to two decimals, never raw paise", () => {
    assert.match(source, /minimumFractionDigits: 2/);
    assert.match(source, /maximumFractionDigits: 2/);
  });

  test("PDF bytes stay deterministic for a frozen payload", () => {
    // A changing id or timestamp would break the deterministic-artifact contract.
    assert.match(source, /odq-pdf-id\|/);
    assert.match(source, /CreationDate: frozenDate/);
    assert.match(source, /ModDate: frozenDate/);
  });
});

describe("the editor speaks interior, not spreadsheet", () => {
  const editor = read(ROOM_EDITOR);

  test("the product language is Room and Work Item", () => {
    assert.match(editor, /Room \/ Area/);
    assert.match(editor, /Work Item/);
    assert.match(editor, /Add Room/);
  });

  test("area fields are derived and presented read-only", () => {
    // The operator must never type an area or an amount in area mode, so both
    // are rendered as <output>, not <input>.
    assert.match(editor, /Area \(sq\.ft\)/);
    // <output> IS the "calculated result" element, so it needs no extra ARIA.
    assert.match(editor, /<output className=\{derivedClass\}>/);
    assert.match(editor, /computeInteriorLine/);
    // Neither derived value is bound to a text input anywhere.
    assert.doesNotMatch(editor, /name="area"|value=\{line\.lineTotalPaise\}/);
  });

  test("the room card shows a subtotal", () => {
    assert.match(editor, /ROOM SUBTOTAL|Room subtotal/i);
  });

  test("rooms and work items can be reordered and removed while draft", () => {
    for (const control of ["moveRoom", "removeRoom", "moveItem", "removeItem", "duplicateItem"]) {
      assert.ok(editor.includes(control), `editor must support ${control}`);
    }
  });

  test("dimension inputs appear only for the area basis", () => {
    assert.match(editor, /basis === "area"/);
    assert.match(editor, /basis === "quantity"/);
    assert.match(editor, /basis === "fixed"/);
  });
});
