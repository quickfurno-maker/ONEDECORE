import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import { crmMobileAdminFailure } from "@/features/crm/server/crm-mobile-admin.ts";
import {
  LEAD_IMPORT_LIMITS,
  suggestMappingFromHeaders,
  type LeadImportColumnMapping,
} from "@/features/crm/contracts/lead-import-contracts.ts";
import {
  computeLeadImportFileSha256,
  detectLeadImportFileType,
  parseLeadImportFile,
} from "@/features/crm/server/lead-import-file-parser.ts";
import {
  createLeadImportBatchForContext,
  replaceLeadImportMappingForContext,
} from "@/features/crm/server/crm-import-service.ts";

/**
 * Owner mobile — import file upload.
 *
 * ANDROID NEVER PARSES THE FILE. This endpoint exists because CSV and XLSX
 * parsing is a security boundary, not a convenience: the canonical parser
 * strips the UTF-8 BOM, refuses ragged CSV rows, REJECTS XLSX formulas
 * outright, normalises dates and rich-text cells, and enforces the row and
 * column ceilings. A client-side parser would reproduce none of that and would
 * hand the server a row set that had already skipped every check.
 *
 * So the phone sends bytes and gets back a batch and its headers.
 *
 * SIZE IS CHECKED BEFORE THE BYTES ARE READ. `file.size` is compared against
 * the canonical `maxFileBytes` before `arrayBuffer()` is awaited, so an
 * oversized upload is refused without ever being buffered into memory — let
 * alone parsed. The parser re-checks the buffer it receives; that second check
 * is the one that protects the parser, and this one is what stops a large
 * upload from costing anything.
 *
 * NOTHING IS SUGGESTED INTO THE DATABASE. The persisted mapping is every header
 * pointing at an empty target — the same neutral starting state the web upload
 * writes. `suggestMappingFromHeaders` runs, but its output is returned as a
 * HINT for the client to confirm, never saved. A suggestion written without an
 * explicit map step would silently decide which column is a phone number.
 *
 * THE BYTES ARE NOT RETURNED, and they are not stored anywhere.
 */

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canBulkImportLeads) {
    return crmMobileError("forbidden", "You are not allowed to import leads.");
  }

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return crmMobileError(
      "invalid_request",
      "Send the import file as multipart/form-data."
    );
  }

  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return crmMobileError(
      "invalid_request",
      "Select a CSV or XLSX file to import."
    );
  }

  /*
   * The canonical ceiling, referenced not restated. Checked here, before the
   * body is materialised.
   */
  if (file.size > LEAD_IMPORT_LIMITS.maxFileBytes) {
    return crmMobileError(
      "invalid_request",
      "Import file exceeds the 5 MiB size limit."
    );
  }

  /*
   * CSV and XLSX only, decided by the canonical detector on the filename and
   * content type. An unrecognised type is refused before anything is read.
   */
  const fileType = detectLeadImportFileType(file.name, file.type);

  if (!fileType) {
    return crmMobileError(
      "invalid_request",
      "Only CSV and XLSX files are supported."
    );
  }

  const defaultSourceIdRaw = form.get("defaultSourceId");
  const defaultSourceId =
    typeof defaultSourceIdRaw === "string" && defaultSourceIdRaw.trim().length > 0
      ? defaultSourceIdRaw.trim()
      : null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    /* The canonical parser. Column limit, row limit and formula rejection live here. */
    const parsed = await parseLeadImportFile(buffer, fileType);

    const batch = await createLeadImportBatchForContext(
      auth.context,
      {
        /* Server-generated. A client-supplied id is an idempotency key someone else can guess. */
        clientRequestId: randomUUID(),
        originalFilename: file.name,
        /* Server-computed over the bytes the server actually parsed. */
        fileSha256: computeLeadImportFileSha256(buffer),
        fileType,
        fileSizeBytes: buffer.byteLength,
        worksheetName: parsed.worksheetName,
        headerFingerprint: parsed.headerFingerprint,
        defaultSourceId,
      },
      auth.db
    );

    /* Neutral mapping: every header present, every target empty. Not a suggestion. */
    const mapping = Object.fromEntries(
      parsed.headers
        .filter((header) => header.trim().length > 0)
        .map((header) => [header, ""])
    );

    const withMapping = await replaceLeadImportMappingForContext(
      auth.context,
      {
        batchId: batch.id,
        mapping: mapping as LeadImportColumnMapping,
        defaultSourceId,
      },
      auth.db
    );

    return NextResponse.json({
      batch: withMapping,
      headers: parsed.headers,
      /* A hint the client confirms. Persisted only by an explicit map-validate. */
      suggestedMapping: suggestMappingFromHeaders(parsed.headers),
    });
  } catch (error) {
    return crmMobileAdminFailure(error, "imports/upload");
  }
}
