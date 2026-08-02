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

function stripUtf8Bom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
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
    phone: record.phone || null,
    email: record.email || null,
    serviceCode: record.service_code ?? record.service ?? "",
    propertyCode: record.property_code ?? record.property ?? "",
    timelineCode: record.timeline_code ?? record.timeline ?? "",
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
    columns: true,
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

async function extractXlsxHeadersAndRecords(buffer: Buffer): Promise<{
  worksheetName: string;
  headers: string[];
  records: Record<string, string>[];
}> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);

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
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const value = normalizeCellValue(cell.value);
    if (value.length > 0) {
      headers[colNumber - 1] = value;
    }
  });

  const compactHeaders = headers.filter((header) => header && header.length > 0);
  assertColumnLimit(compactHeaders);

  const records: Record<string, string>[] = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) {
      return;
    }

    const record: Record<string, string> = {};
    compactHeaders.forEach((header, index) => {
      record[header] = normalizeCellValue(row.getCell(index + 1).value);
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
    columns: true,
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
