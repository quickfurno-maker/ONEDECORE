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
  validateLeadImportRejectionReason,
} from "../contracts/lead-import-contracts.ts";
import { requireCrmBulkImportAccess } from "./crm-auth.ts";
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

    const mapping = Object.fromEntries(
      parsed.headers
        .filter((header) => header.trim().length > 0)
        .map((header) => [header, ""])
    );

    await replaceLeadImportMappingForCurrentUser({
      batchId: batch.id,
      mapping: mapping as LeadImportColumnMapping,
      defaultSourceId,
    });

    revalidatePath("/admin/crm/imports");
    redirect(`/admin/crm/imports/${batch.id}?step=mapping`);
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
    const rawRecords =
      fileType === "csv"
        ? parseCsvRecordsForMapping(buffer).records
        : (await parseXlsxRecordsForMapping(buffer)).records;

    await replaceLeadImportMappingForCurrentUser({
      batchId,
      mapping: mapping as LeadImportColumnMapping,
      defaultSourceId,
    });

    const mappedRows = applyMappingToRawRecords(
      parsed.headers,
      rawRecords,
      mapping
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
