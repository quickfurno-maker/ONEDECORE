import { NextResponse } from "next/server";
import {
  crmMobileAuthError,
  crmMobileError,
  resolveCrmMobileAuth,
} from "@/features/crm/server/crm-mobile-auth.ts";
import {
  crmMobileAdminFailure,
  isCrmMobileAdminId,
} from "@/features/crm/server/crm-mobile-admin.ts";
import {
  LEAD_IMPORT_LIMITS,
  isLeadImportMappingField,
  validateLeadImportMappingInput,
  type LeadImportColumnMapping,
} from "@/features/crm/contracts/lead-import-contracts.ts";
import {
  applyMappingToRawRecords,
  detectLeadImportFileType,
  parseCsvRecordsForMapping,
  parseLeadImportFile,
  parseXlsxRecordsForMapping,
} from "@/features/crm/server/lead-import-file-parser.ts";
import {
  replaceLeadImportMappingForContext,
  replaceLeadImportRowsForContext,
  validateLeadImportBatchForContext,
} from "@/features/crm/server/crm-import-service.ts";

/**
 * Owner mobile — map columns and validate an import batch.
 *
 * THE FILE IS RE-UPLOADED, AND THAT IS DELIBERATE. The web mapping step already
 * requires it, because nothing in this system stores the uploaded bytes: a
 * batch keeps the filename, the size, the SHA-256 and the header fingerprint,
 * but never the file. Adding a file store to spare the phone a second upload
 * would introduce a place where submitted customer contact data sits at rest,
 * with a retention question and an access-control question attached. CRM-M9A
 * does not add one, so the mapping step reads the file the caller sends.
 *
 * THE CHAIN, ALL CANONICAL, IN ORDER:
 *
 *   detect         `detectLeadImportFileType`      csv/xlsx only
 *   parse          `parseLeadImportFile`           limits + formula rejection
 *   raw records    `parseCsvRecordsForMapping` / `parseXlsxRecordsForMapping`
 *   validate map   `validateLeadImportMappingInput`
 *   persist map    `replace_lead_import_mapping`
 *   apply          `applyMappingToRawRecords`      header -> field, per row
 *   persist rows   `replace_lead_import_rows`
 *   validate       `validate_lead_import_batch`    duplicates, assignment, counts
 *
 * Every one of those runs on the server, in that order, with the SAME bearer
 * client threaded through all three writes and the reload after each. The route
 * decides none of it: not which mapping targets exist, not what makes a row
 * valid, not what counts as a duplicate, not who a row is assigned to.
 */

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> }
) {
  const auth = await resolveCrmMobileAuth(request);

  if (auth.kind !== "granted") {
    return crmMobileAuthError(auth.kind);
  }

  if (!auth.context.canBulkImportLeads) {
    return crmMobileError("forbidden", "You are not allowed to import leads.");
  }

  const { batchId } = await params;

  if (!isCrmMobileAdminId(batchId)) {
    return crmMobileError("invalid_request", "Unknown import batch.");
  }

  const target = batchId.trim();

  let form: FormData;

  try {
    form = await request.formData();
  } catch {
    return crmMobileError(
      "invalid_request",
      "Send the file and mapping as multipart/form-data."
    );
  }

  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return crmMobileError(
      "invalid_request",
      "Re-upload the source file to continue mapping."
    );
  }

  /* Canonical ceiling, checked before the bytes are read. See the upload route. */
  if (file.size > LEAD_IMPORT_LIMITS.maxFileBytes) {
    return crmMobileError(
      "invalid_request",
      "Import file exceeds the 5 MiB size limit."
    );
  }

  const fileType = detectLeadImportFileType(file.name, file.type);

  if (!fileType) {
    return crmMobileError(
      "invalid_request",
      "Only CSV and XLSX files are supported."
    );
  }

  /*
   * The mapping travels as a JSON object in a form field: `{ header: field }`.
   * A malformed one is refused rather than treated as an empty mapping — an
   * empty mapping is a legitimate edit that clears every column, so accepting
   * unparseable JSON as one would erase the caller's work and then report
   * success.
   */
  const rawMapping = form.get("mapping");
  let mapping: Record<string, string>;

  try {
    const parsedMapping: unknown = JSON.parse(
      typeof rawMapping === "string" ? rawMapping : ""
    );

    if (
      parsedMapping === null ||
      typeof parsedMapping !== "object" ||
      Array.isArray(parsedMapping)
    ) {
      throw new Error("mapping must be an object");
    }

    mapping = {};

    for (const [header, field] of Object.entries(
      parsedMapping as Record<string, unknown>
    )) {
      /*
       * An unmapped column is `""` and stays `""`. A NON-STRING target is
       * dropped to `""` rather than stringified, so `{"Phone": 7}` becomes an
       * unmapped column instead of a target named "7" — the canonical validator
       * would refuse "7" anyway, and refusing is what happens for a real string
       * that is not a known field.
       */
      mapping[header] = typeof field === "string" ? field.trim() : "";
    }
  } catch {
    return crmMobileError(
      "invalid_request",
      "Send mapping as a JSON object of column name to target field."
    );
  }

  /* The canonical mapping validator owns the target vocabulary. */
  const mappingErrors = validateLeadImportMappingInput({ mapping });

  if (mappingErrors.length > 0) {
    return crmMobileError(
      "invalid_request",
      mappingErrors[0]?.message ?? "Column mapping is invalid."
    );
  }

  const defaultSourceIdRaw = form.get("defaultSourceId");
  const defaultSourceId =
    typeof defaultSourceIdRaw === "string" && defaultSourceIdRaw.trim().length > 0
      ? defaultSourceIdRaw.trim()
      : null;

  try {
    const buffer = Buffer.from(await file.arrayBuffer());

    /*
     * Parsed twice, for two different products: `parseLeadImportFile` yields
     * the canonical headers and enforces the row, column and formula rules;
     * the `...ForMapping` readers yield the RAW records that
     * `applyMappingToRawRecords` needs to re-key by mapped field.
     */
    const parsed = await parseLeadImportFile(buffer, fileType);
    const rawRecords =
      fileType === "csv"
        ? parseCsvRecordsForMapping(buffer).records
        : (await parseXlsxRecordsForMapping(buffer)).records;

    /*
     * Only columns the caller actually mapped are persisted, matching the web
     * step: an empty target means "not mapped" and is not a mapping entry.
     */
    const persistedMapping = Object.fromEntries(
      Object.entries(mapping).filter(
        ([, field]) => field.length > 0 && isLeadImportMappingField(field)
      )
    );

    await replaceLeadImportMappingForContext(
      auth.context,
      {
        batchId: target,
        mapping: persistedMapping as LeadImportColumnMapping,
        defaultSourceId,
      },
      auth.db
    );

    const mappedRows = applyMappingToRawRecords(
      parsed.headers,
      rawRecords,
      persistedMapping
    );

    await replaceLeadImportRowsForContext(
      auth.context,
      target,
      mappedRows,
      auth.db
    );

    /*
     * Validation is the RPC's, and it is what bumps `validationRevision`. The
     * batch it returns carries the new revision, which the caller must echo
     * back on the next lifecycle action.
     */
    const validated = await validateLeadImportBatchForContext(
      auth.context,
      target,
      auth.db
    );

    return NextResponse.json(validated);
  } catch (error) {
    return crmMobileAdminFailure(error, "imports/map-validate");
  }
}
