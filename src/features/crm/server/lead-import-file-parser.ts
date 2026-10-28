import "server-only";

import { createHash } from "node:crypto";
import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import {
  LEAD_IMPORT_LIMITS,
  type LeadImportFileType,
  type LeadImportParseResult,
  type LeadImportParsedRow,
} from "../contracts/lead-import-contracts.ts";
import { CrmError } from "./crm-errors.ts";
import { assertSafeXlsxArchive } from "./xlsx-archive-preflight.ts";
import { assertBoundedXlsxDecompression } from "./xlsx-bounded-decompression.ts";

function stripUtf8Bom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

/** Normalize Indian 10-digit mobiles and common +91 / 91 / 0 prefixes. */
export function normalizeIndianImportMobile(raw: string): string {
  const input = raw.trim();
  const compact = input.replace(/[\s()\u002d]/g, "");
  let digits = compact;
  if (/^\+91[6-9]\d{9}$/.test(compact)) digits = compact.slice(3);
  else if (/^91[6-9]\d{9}$/.test(compact)) digits = compact.slice(2);
  else if (/^0[6-9]\d{9}$/.test(compact)) digits = compact.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? "+91" + digits : input;
}

/** The two-column and optional Source template can be validated in one upload. */
export function simpleNameMobileMapping(
  headers: readonly string[]
): Record<string, "submitted_name" | "phone" | "primary_source_id"> | null {
  if (headers.length < 2 || headers.length > 3) return null;
  const mapping: Record<string, "submitted_name" | "phone" | "primary_source_id"> = {};
  for (const header of headers) {
    const normalized = header.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (["name", "full name", "customer name"].includes(normalized)) mapping[header] = "submitted_name";
    else if (["mobile number", "mobile", "phone", "phone number", "contact number"].includes(normalized)) mapping[header] = "phone";
    else if (["source", "lead source", "source optional"].includes(normalized)) mapping[header] = "primary_source_id";
    else return null;
  }
  const targets = new Set(Object.values(mapping));
  return targets.has("submitted_name") && targets.has("phone") && targets.size === headers.length ? mapping : null;
}

function assertUniqueHeaders(headers: readonly string[]): void {
  const seen = new Set<string>();
  for (const header of headers) {
    const key = header.trim().toLowerCase();
    if (!key || seen.has(key) || ["__proto__", "constructor", "prototype"].includes(key)) {
      throw new CrmError({
        code: "IMPORT_AMBIGUOUS_HEADERS",
        message: "Column names must be non-empty and unique. Rename duplicate or blank columns.",
        httpStatus: 422,
      });
    }
    seen.add(key);
  }
}

function normalizeCellValue(value: unknown): string {
  if (value == null) {
    return "";
  }
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === "object" && value !== null && "text" in value) {
    return String((value as { text?: string }).text ?? "").trim();
  }
  return String(value).trim();
}

function assertColumnLimit(headers: readonly string[]): void {
  if (headers.length > LEAD_IMPORT_LIMITS.maxColumns) {
    throw new CrmError({
      code: "IMPORT_TOO_MANY_COLUMNS",
      message: `Import file exceeds the ${LEAD_IMPORT_LIMITS.maxColumns}-column limit.`,
      httpStatus: 422,
    });
  }
}

function assertRowLimit(rowCount: number): void {
  if (rowCount < 1) {
    throw new CrmError({
      code: "IMPORT_EMPTY_FILE",
      message: "Import file must contain at least one data row.",
      httpStatus: 422,
    });
  }

  if (rowCount > LEAD_IMPORT_LIMITS.maxRows) {
    throw new CrmError({
      code: "IMPORT_TOO_MANY_ROWS",
      message: `Import file exceeds the ${LEAD_IMPORT_LIMITS.maxRows}-row limit.`,
      httpStatus: 422,
    });
  }
}

function buildHeaderFingerprint(headers: readonly string[]): string {
  return createHash("sha256")
    .update(headers.map((header) => header.trim().toLowerCase()).join("|"))
    .digest("hex");
}

function mapRecordToParsedRow(
  rowNumber: number,
  record: Record<string, string>
): LeadImportParsedRow {
  return {
    rowNumber,
    submittedName: record.submitted_name ?? record.name ?? "",
    phone: record.phone ? normalizeIndianImportMobile(record.phone) : null,
    email: record.email || null,
    serviceCode: record.service_code || record.service || "not-specified",
    propertyCode: record.property_code || record.property || "not-specified",
    timelineCode: record.timeline_code || record.timeline || "not-specified",
    primarySourceId: record.primary_source_id || null,
    locality: record.locality || null,
    budgetComfortCode: record.budget_comfort_code || null,
    roomCodes: (record.room_codes ?? "")
      .split(/[;,|]/)
      .map((entry) => entry.trim())
      .filter(Boolean),
    message: record.message || null,
    sourceDetail: record.source_detail || null,
  };
}

function parseCsvBuffer(buffer: Buffer): LeadImportParseResult {
  const text = stripUtf8Bom(buffer.toString("utf8"));
  const records = parseCsv(text, {
    bom: true,
    columns: (headers: string[]) => { assertUniqueHeaders(headers); return headers; },
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as ReadonlyArray<Record<string, string>>;

  const headers = records.length > 0 ? Object.keys(records[0] ?? {}) : [];
  assertColumnLimit(headers);
  assertRowLimit(records.length);

  const rows = records.map((record, index) =>
    mapRecordToParsedRow(index + 1, record)
  );

  return {
    fileType: "csv",
    worksheetName: null,
    headers,
    headerFingerprint: buildHeaderFingerprint(headers),
    rows,
  };
}

async function assertNoXlsxFormulas(worksheet: ExcelJS.Worksheet): Promise<void> {
  worksheet.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      if (cell.type === ExcelJS.ValueType.Formula) {
        throw new CrmError({
          code: "IMPORT_FORMULA_REJECTED",
          message: "Excel files with formulas are not accepted. Export values only.",
          httpStatus: 422,
        });
      }
    });
  });
}

/**
 * Hand a buffer to ExcelJS.
 *
 * Extracted so the archive gate below can be tested for what it actually
 * guarantees — that an unsafe file never reaches the parser — rather than by
 * reading the source and hoping the two statements stay in that order.
 */
export type XlsxWorkbookLoader = (buffer: Buffer) => Promise<ExcelJS.Workbook>;

const loadWorkbookWithExcelJs: XlsxWorkbookLoader = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  return workbook;
};

export async function extractXlsxHeadersAndRecords(
  buffer: Buffer,
  loadWorkbook: XlsxWorkbookLoader = loadWorkbookWithExcelJs
): Promise<{
  worksheetName: string;
  headers: string[];
  records: Record<string, string>[];
}> {
  /*
   * TWO GATES, BOTH BEFORE THE PARSER.
   *
   * The row and column limits further down are applied to a workbook ExcelJS
   * has already decompressed, so they bound the result rather than the work.
   *
   * Gate 1 reads the ZIP central directory and decompresses nothing. It stops
   * archives that are structurally not workbooks, and archives whose own
   * declaration is out of bounds.
   *
   * Gate 2 stops the archives that lie. A directory can declare a safe size and
   * inflate to gigabytes; JSZip only notices the mismatch after materialising
   * the output. So each entry is inflated here first, under a hard ceiling,
   * counted and discarded, and required to match its declaration.
   */
  const entries = assertSafeXlsxArchive(buffer);
  await assertBoundedXlsxDecompression(buffer, entries);

  const workbook = await loadWorkbook(buffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new CrmError({
      code: "IMPORT_EMPTY_FILE",
      message: "Excel workbook does not contain any worksheets.",
      httpStatus: 422,
    });
  }

  await assertNoXlsxFormulas(worksheet);

  const headerRow = worksheet.getRow(1);
  const compactHeaders: string[] = [];
  const sourceColumnIndexes: number[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = normalizeCellValue(cell.value);
    if (value.length > 0) {
      compactHeaders.push(value);
      sourceColumnIndexes.push(colNumber);
    }
  });
  assertUniqueHeaders(compactHeaders);
  assertColumnLimit(compactHeaders);

  const records: Record<string, string>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const record: Record<string, string> = {};
    compactHeaders.forEach((header, index) => {
      record[header] = normalizeCellValue(row.getCell(sourceColumnIndexes[index]).value);
    });

    if (Object.values(record).every((value) => value.length === 0)) {
      return;
    }

    records.push(record);
  });

  assertRowLimit(records.length);

  return {
    worksheetName: worksheet.name,
    headers: compactHeaders,
    records,
  };
}

async function parseXlsxBuffer(buffer: Buffer): Promise<LeadImportParseResult> {
  const { worksheetName, headers, records } =
    await extractXlsxHeadersAndRecords(buffer);

  const rows = records.map((record, index) => mapRecordToParsedRow(index + 1, record));

  return {
    fileType: "xlsx",
    worksheetName,
    headers,
    headerFingerprint: buildHeaderFingerprint(headers),
    rows,
  };
}

export function detectLeadImportFileType(
  filename: string,
  mimeType?: string | null
): LeadImportFileType | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".csv") || mimeType === "text/csv") {
    return "csv";
  }
  if (
    lower.endsWith(".xlsx") ||
    mimeType ===
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ) {
    return "xlsx";
  }
  return null;
}

export function computeLeadImportFileSha256(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function parseLeadImportFile(
  buffer: Buffer,
  fileType: LeadImportFileType
): Promise<LeadImportParseResult> {
  if (buffer.byteLength > LEAD_IMPORT_LIMITS.maxFileBytes) {
    throw new CrmError({
      code: "IMPORT_FILE_TOO_LARGE",
      message: "Import file exceeds the 5 MiB size limit.",
      httpStatus: 422,
    });
  }

  if (fileType === "csv") {
    return parseCsvBuffer(buffer);
  }

  return parseXlsxBuffer(buffer);
}

export function applyMappingToRawRecords(
  headers: readonly string[],
  rawRecords: readonly Record<string, string>[],
  mapping: Readonly<Record<string, string>>
): LeadImportParsedRow[] {
  return rawRecords.map((record, index) => {
    const byField: Record<string, string> = {};
    for (const header of headers) {
      const field = mapping[header];
      if (!field) {
        continue;
      }
      byField[field] = normalizeCellValue(record[header]);
    }

    return mapRecordToParsedRow(index + 1, byField);
  });
}

export function parseCsvRecordsForMapping(
  buffer: Buffer
): { headers: string[]; records: Record<string, string>[] } {
  const text = stripUtf8Bom(buffer.toString("utf8"));
  const records = parseCsv(text, {
    bom: true,
    columns: (headers: string[]) => { assertUniqueHeaders(headers); return headers; },
    skip_empty_lines: true,
    relax_column_count: false,
    trim: true,
  }) as Record<string, string>[];

  const headers = records.length > 0 ? Object.keys(records[0] ?? {}) : [];
  return { headers, records };
}

export async function parseXlsxRecordsForMapping(
  buffer: Buffer
): Promise<{ headers: string[]; records: Record<string, string>[] }> {
  const { headers, records } = await extractXlsxHeadersAndRecords(buffer);
  return { headers, records };
}
