import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import ExcelJS from "exceljs";

import {
  normalizeIndianImportMobile,
  simpleNameMobileMapping,
  applyMappingToRawRecords,
  parseCsvRecordsForMapping,
  parseLeadImportFile,
  parseXlsxRecordsForMapping,
} from "../server/lead-import-file-parser.ts";
import { validateLeadImportMappingInput } from "../contracts/lead-import-contracts.ts";

test("Indian 10-digit mobile formats normalize to the same E.164 identity", () => {
  for (const input of ["9876543210", "+91 98765 43210", "91-9876543210", "09876543210", "(98765) 43210"]) {
    assert.equal(normalizeIndianImportMobile(input), "+919876543210");
  }
  for (const input of ["1234567890", "987654321", "98765432100", "99999999999", "98765abc10"]) {
    assert.equal(normalizeIndianImportMobile(input), input);
  }
});
test("only an exact two-column Name + Mobile format receives direct verified mapping", () => {
  assert.deepEqual(simpleNameMobileMapping(["Name", "Mobile Number"]), {
    Name: "submitted_name", "Mobile Number": "phone"
  });
  assert.equal(simpleNameMobileMapping(["Name", "Mobile Number", "Budget"]), null);
  assert.equal(simpleNameMobileMapping(["Name", "Name"]), null);
});
test("two-column CSV maps Indian mobile and stores unknown qualifications explicitly", async () => {
  const bytes = Buffer.from("Name,Mobile Number\nCustomer A,9876543210\nCustomer B,+91 98765 43210\n");
  const parsed = await parseLeadImportFile(bytes, "csv");
  const raw = parseCsvRecordsForMapping(bytes);
  const mapped = applyMappingToRawRecords(parsed.headers, raw.records, simpleNameMobileMapping(parsed.headers)!);
  assert.deepEqual(mapped.map((row) => row.phone), ["+919876543210","+919876543210"]);
  assert.ok(mapped.every((row) =>
    row.serviceCode === "not-specified" &&
    row.propertyCode === "not-specified" &&
    row.timelineCode === "not-specified"
  ));
});
test("duplicate CSV headers and duplicate CRM targets cannot silently overwrite values", async () => {
  await assert.rejects(() => parseLeadImportFile(Buffer.from("Name,Name\nA,B\n"), "csv"), /Column names must/);
  const errors = validateLeadImportMappingInput({ mapping: { A: "phone", B: "phone" } });
  assert.ok(errors.some((e) => e.message.includes("Multiple columns")));
});
test("XLSX blank header column preserves correct mobile column index", async () => {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet("Enquiries");
  ws.getRow(1).values = ["Name", "", "Mobile Number"];
  ws.getRow(2).values = ["Customer A", "", "9876543210"];
  const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
  const raw = await parseXlsxRecordsForMapping(buffer);
  assert.deepEqual(raw.headers, ["Name","Mobile Number"]);
  assert.equal(raw.records[0]["Mobile Number"],"9876543210");
  const rows = applyMappingToRawRecords(raw.headers,raw.records,simpleNameMobileMapping(raw.headers)!);
  assert.equal(rows[0].phone,"+919876543210");
});
test("downloadable workbook includes only two paste columns and separate instructions", async () => {
  const file=readFileSync(join(process.cwd(),"public/templates/ONEDECORE_Bulk_Enquiries_Template.xlsx"));
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file as unknown as ExcelJS.Buffer);
  const sheet=workbook.getWorksheet("Enquiries")!;
  assert.equal(sheet.getCell("A1").value,"Name");
  assert.equal(sheet.getCell("B1").value,"Mobile Number");
  assert.equal(sheet.getCell("B2").numFmt,"@");
  assert.ok(workbook.getWorksheet("Instructions"));
});
test("database migration permits unknown details without altering marketing consent", () => {
  const file=join(process.cwd(),"supabase/migrations/20261028092333_crm_two_column_indian_mobile_import.sql");
  const sql=readFileSync(file,"utf8");
  assert.match(sql, /not-specified/);
  assert.match(sql, /INVALID_INDIAN_MOBILE/);
  assert.match(sql, /if v_batch\.importable_rows = 0/);
  assert.match(sql, /prev\.phone = v_row\.phone/);
  assert.doesNotMatch(sql, /\binsert into public\.(?:marketing_consents|whatsapp_messages)\b/i);
});
