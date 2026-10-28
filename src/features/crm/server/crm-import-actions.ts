"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type {
  LeadImportActionState,
  LeadImportColumnMapping,
} from "../contracts/lead-import-contracts.ts";
import {
  isLeadImportMappingField,
  LEAD_IMPORT_LIMITS,
  validateLeadImportMappingInput,
  validateLeadImportRejectionReason,
} from "../contracts/lead-import-contracts.ts";
import { requireCrmBulkImportAccess } from "./crm-auth.ts";
import { fetchLeadImportBatchDetail } from "./crm-import-queries.ts";
import { fetchActiveLeadSources } from "./crm-lead-queries.ts";
import { resolveMappedImportSources } from "./lead-import-source-resolver.ts";
import { resolveCrmDb } from "./crm-db.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  approveLeadImportBatchForCurrentUser,
  cancelLeadImportBatchForCurrentUser,
  confirmLeadImportBatchDirectForCurrentUser,
  createLeadImportBatchForCurrentUser,
  processLeadImportBatchForCurrentUser,
  rejectLeadImportBatchForCurrentUser,
  replaceLeadImportMappingForCurrentUser,
  replaceLeadImportRowsForCurrentUser,
  submitLeadImportBatchForCurrentUser,
  validateLeadImportBatchForCurrentUser,
} from "./crm-import-service.ts";
import {
  applyMappingToRawRecords,
  computeLeadImportFileSha256,
  detectLeadImportFileType,
  parseCsvRecordsForMapping,
  parseLeadImportFile,
  parseXlsxRecordsForMapping,
  simpleNameMobileMapping,
} from "./lead-import-file-parser.ts";

function toImportActionState(error: unknown): LeadImportActionState {
  if (error instanceof CrmError) {
    return {
      success: false,
      message: error.message,
      code: error.code,
    };
  }

  const mapped = crmErrorFromPostgresMessage(
    error instanceof Error ? error.message : "Import operation failed"
  );
  return {
    success: false,
    message: mapped.message,
    code: mapped.code,
  };
}

function parseMappingFromFormData(formData: FormData): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("mapping.")) {
      continue;
    }
    const header = key.slice("mapping.".length);
    const field = String(value).trim();
    if (field.length > 0 && isLeadImportMappingField(field)) {
      mapping[header] = field;
    }
  }
  return mapping;
}

export async function uploadLeadImportFileAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  try {
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return {
        success: false,
        message: "Select a CSV or XLSX file to import.",
        code: "IMPORT_INVALID_FILE_TYPE",
      };
    }

    if (file.size > LEAD_IMPORT_LIMITS.maxFileBytes) {
      return { success: false, message: "Import file exceeds 5 MiB.", code: "IMPORT_FILE_TOO_LARGE" };
    }
    const fileType = detectLeadImportFileType(file.name, file.type);
    if (!fileType) {
      return {
        success: false,
        message: "Only CSV and XLSX files are supported.",
        code: "IMPORT_INVALID_FILE_TYPE",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseLeadImportFile(buffer, fileType);
    const clientRequestId = randomUUID();
    const defaultSourceId = String(formData.get("defaultSourceId") ?? "").trim() || null;

    const simpleMapping = simpleNameMobileMapping(parsed.headers);
    const rawRecords = simpleMapping
      ? (fileType === "csv"
          ? parseCsvRecordsForMapping(buffer).records
          : (await parseXlsxRecordsForMapping(buffer)).records)
      : null;
    // Verify every Source name/code BEFORE creating a staged batch.
    const simpleRows = simpleMapping && rawRecords
      ? resolveMappedImportSources(
          applyMappingToRawRecords(parsed.headers, rawRecords, simpleMapping),
          await fetchActiveLeadSources(),
          defaultSourceId
        )
      : null;

    const batch = await createLeadImportBatchForCurrentUser({
      clientRequestId,
      originalFilename: file.name,
      fileSha256: computeLeadImportFileSha256(buffer),
      fileType,
      fileSizeBytes: buffer.byteLength,
      worksheetName: parsed.worksheetName,
      headerFingerprint: parsed.headerFingerprint,
      defaultSourceId,
    });

    const mapping = simpleMapping ?? Object.fromEntries(
      parsed.headers
        .filter((header) => header.trim().length > 0)
        .map((header) => [header, ""])
    );

    await replaceLeadImportMappingForCurrentUser({
      batchId: batch.id,
      mapping: mapping as LeadImportColumnMapping,
      defaultSourceId,
    });

    if (simpleRows) {
      await replaceLeadImportRowsForCurrentUser(batch.id, simpleRows);
      await validateLeadImportBatchForCurrentUser(batch.id);
    }
    revalidatePath("/admin/crm/imports");
    redirect(`/admin/crm/imports/${batch.id}${simpleMapping ? "" : "?step=mapping"}`);
  } catch (error: unknown) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      String((error as { digest?: string }).digest).startsWith("NEXT_REDIRECT")
    ) {
      throw error;
    }
    return toImportActionState(error);
  }
}

export async function saveLeadImportMappingAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  const batchId = String(formData.get("batchId") ?? "").trim();
  const defaultSourceId = String(formData.get("defaultSourceId") ?? "").trim() || null;
  const mapping = parseMappingFromFormData(formData);

  try {
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) {
      return {
        success: false,
        message: "Re-upload the source file to continue mapping.",
        code: "IMPORT_INVALID_FILE_TYPE",
      };
    }

    if (file.size > LEAD_IMPORT_LIMITS.maxFileBytes) {
      return { success: false, message: "Import file exceeds 5 MiB.", code: "IMPORT_FILE_TOO_LARGE" };
    }
    const fileType = detectLeadImportFileType(file.name, file.type);
    if (!fileType) {
      return {
        success: false,
        message: "Only CSV and XLSX files are supported.",
        code: "IMPORT_INVALID_FILE_TYPE",
      };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const parsed = await parseLeadImportFile(buffer, fileType);
    const original = await fetchLeadImportBatchDetail(batchId);
    if (!original || original.fileSha256 !== computeLeadImportFileSha256(buffer) ||
        original.fileType !== fileType || original.headerFingerprint !== parsed.headerFingerprint) {
      throw new CrmError({
        code: "IMPORT_SOURCE_FILE_MISMATCH",
        message: "Re-upload the exact original file. This file does not match the staged batch.",
        httpStatus: 422,
      });
    }
    const errors = validateLeadImportMappingInput({ mapping });
    if (errors.length > 0) {
      throw new CrmError({ code: "IMPORT_INVALID_MAPPING", message: errors[0].message, httpStatus: 422 });
    }
    const rawRecords =
      fileType === "csv"
        ? parseCsvRecordsForMapping(buffer).records
        : (await parseXlsxRecordsForMapping(buffer)).records;

    await replaceLeadImportMappingForCurrentUser({
      batchId,
      mapping: mapping as LeadImportColumnMapping,
      defaultSourceId,
    });

    const mappedRows = resolveMappedImportSources(
      applyMappingToRawRecords(parsed.headers, rawRecords, mapping),
      await fetchActiveLeadSources(),
      defaultSourceId
    );

    await replaceLeadImportRowsForCurrentUser(batchId, mappedRows);
    const validated = await validateLeadImportBatchForCurrentUser(batchId);

    revalidatePath("/admin/crm/imports");
    revalidatePath(`/admin/crm/imports/${batchId}`);

    return {
      success: true,
      message: `Validation complete — ${validated.importableRows} importable rows.`,
      batchId,
    };
  } catch (error: unknown) {
    return toImportActionState(error);
  }
}

export async function submitLeadImportBatchAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  const batchId = String(formData.get("batchId") ?? "").trim();
  const expectedRevision = Number.parseInt(
    String(formData.get("validationRevision") ?? ""),
    10
  );

  try {
    await submitLeadImportBatchForCurrentUser(batchId, expectedRevision);
    revalidatePath("/admin/crm/imports");
    revalidatePath(`/admin/crm/imports/${batchId}`);
    return {
      success: true,
      message: "Import batch submitted for super admin approval.",
      batchId,
    };
  } catch (error: unknown) {
    return toImportActionState(error);
  }
}

export async function approveLeadImportBatchAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  const batchId = String(formData.get("batchId") ?? "").trim();
  const expectedRevision = Number.parseInt(
    String(formData.get("validationRevision") ?? ""),
    10
  );

  try {
    await approveLeadImportBatchForCurrentUser(batchId, expectedRevision);
    revalidatePath("/admin/crm/imports");
    revalidatePath(`/admin/crm/imports/${batchId}`);
    return {
      success: true,
      message: "Import batch approved.",
      batchId,
    };
  } catch (error: unknown) {
    return toImportActionState(error);
  }
}

export async function rejectLeadImportBatchAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  const batchId = String(formData.get("batchId") ?? "").trim();
  const expectedRevision = Number.parseInt(
    String(formData.get("validationRevision") ?? ""),
    10
  );
  const rejectionReason = String(formData.get("rejectionReason") ?? "");
  const validationMessage = validateLeadImportRejectionReason(rejectionReason);
  if (validationMessage) {
    return {
      success: false,
      message: validationMessage,
      code: "VALIDATION_FAILED",
      fieldErrors: { rejectionReason: validationMessage },
    };
  }

  try {
    await rejectLeadImportBatchForCurrentUser(
      batchId,
      expectedRevision,
      rejectionReason
    );
    revalidatePath("/admin/crm/imports");
    revalidatePath(`/admin/crm/imports/${batchId}`);
    return {
      success: true,
      message: "Import batch rejected.",
      batchId,
    };
  } catch (error: unknown) {
    return toImportActionState(error);
  }
}

export async function confirmLeadImportBatchDirectAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  const batchId = String(formData.get("batchId") ?? "").trim();
  const expectedRevision = Number.parseInt(
    String(formData.get("validationRevision") ?? ""),
    10
  );

  try {
    await confirmLeadImportBatchDirectForCurrentUser(batchId, expectedRevision);
    revalidatePath("/admin/crm/imports");
    revalidatePath(`/admin/crm/imports/${batchId}`);
    return {
      success: true,
      message: "Import batch confirmed for direct processing.",
      batchId,
    };
  } catch (error: unknown) {
    return toImportActionState(error);
  }
}

export async function cancelLeadImportBatchAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  const batchId = String(formData.get("batchId") ?? "").trim();

  try {
    await cancelLeadImportBatchForCurrentUser(batchId);
    revalidatePath("/admin/crm/imports");
    revalidatePath(`/admin/crm/imports/${batchId}`);
    return {
      success: true,
      message: "Import batch cancelled.",
      batchId,
    };
  } catch (error: unknown) {
    return toImportActionState(error);
  }
}

export async function processLeadImportBatchAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  await requireCrmBulkImportAccess();

  const batchId = String(formData.get("batchId") ?? "").trim();
  const expectedRevision = Number.parseInt(
    String(formData.get("validationRevision") ?? ""),
    10
  );

  try {
    const result = await processLeadImportBatchForCurrentUser(
      batchId,
      expectedRevision
    );
    revalidatePath("/admin/crm/imports");
    revalidatePath(`/admin/crm/imports/${batchId}`);
    revalidatePath("/admin/crm/leads");

    return {
      success: true,
      message: result.done
        ? `Import completed (${result.imported} imported, ${result.failed} failed).`
        : `Processed chunk (${result.imported} imported, ${result.failed} failed).`,
      batchId,
    };
  } catch (error: unknown) {
    return toImportActionState(error);
  }
}


/** Explicit Super Admin-only source catalog creation, separate from customer imports. */
export async function addLeadImportSourceAction(
  _previousState: LeadImportActionState,
  formData: FormData
): Promise<LeadImportActionState> {
  const context = await requireCrmBulkImportAccess();
  if (!context.canManageLeadSources) {
    return { success: false, message: "You cannot manage lead sources.", code: "PERMISSION_DENIED" };
  }
  const name = String(formData.get("sourceName") ?? "").trim().replace(/\s+/g, " ");
  const code = String(formData.get("sourceCode") ?? "").trim().toLowerCase();
  if (name.length < 2 || name.length > 120 || !/^[a-z][a-z0-9_]{1,63}$/.test(code)) {
    return {
      success: false,
      message: "Enter a source name (2–120 characters) and code such as local_expo_2026.",
      code: "VALIDATION_FAILED",
    };
  }
  const existing = await fetchActiveLeadSources();
  if (existing.some((item) =>
    item.code === code || item.displayName.toLowerCase() === name.toLowerCase()
  )) {
    return { success: false, message: "This source already exists. Choose it in Excel.", code: "VALIDATION_FAILED" };
  }
  try {
    const db = await resolveCrmDb();
    const { error } = await db.rpc("create_lead_source", {
      p_code: code,
      p_display_name: name,
      p_display_order: 0,
    });
    if (error) throw error;
    revalidatePath("/admin/crm/imports/new");
    revalidatePath("/admin/crm/imports");
    return { success: true, message: "Source created. Download a fresh Excel template to see it." };
  } catch {
    return { success: false, message: "Unable to add source. Check its name/code or contact the administrator.", code: "RPC_FAILED" };
  }
}
