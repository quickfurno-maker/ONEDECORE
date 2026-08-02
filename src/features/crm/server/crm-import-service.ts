import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CrmAccessContext } from "../contracts/crm-access.ts";
import type {
  CreateLeadImportBatchInput,
  LeadImportBatchDetail,
  LeadImportColumnMapping,
  LeadImportParsedRow,
  LeadImportProcessResult,
  ReplaceLeadImportMappingInput,
} from "../contracts/lead-import-contracts.ts";
import {
  LEAD_IMPORT_LIMITS,
  mapParsedRowToRpcPayload,
  validateLeadImportRejectionReason,
} from "../contracts/lead-import-contracts.ts";
import { getCrmAccessContext } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  fetchLeadImportBatchDetail,
  fetchLeadImportBatchRows,
} from "./crm-import-queries.ts";

async function phase5dClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

async function reloadBatch(batchId: string): Promise<LeadImportBatchDetail> {
  const batch = await fetchLeadImportBatchDetail(batchId);
  if (!batch) {
    throw new CrmError({
      code: "IMPORT_BATCH_NOT_FOUND",
      message: "Import batch not found.",
      httpStatus: 404,
    });
  }
  return batch;
}

function assertBulkImportPermission(context: CrmAccessContext): void {
  if (!context.canBulkImportLeads) {
    throw new CrmError({
      code: "IMPORT_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }
}

function assertApprovePermission(context: CrmAccessContext): void {
  if (!context.canApproveLeadImports) {
    throw new CrmError({
      code: "IMPORT_APPROVE_DENIED",
      message: "You are not allowed to approve import batches.",
      httpStatus: 403,
    });
  }
}

export async function createLeadImportBatchForCurrentUser(
  input: CreateLeadImportBatchInput
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertBulkImportPermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("create_lead_import_batch", {
    p_client_request_id: input.clientRequestId,
    p_original_filename: input.originalFilename,
    p_file_sha256: input.fileSha256,
    p_file_type: input.fileType,
    p_file_size_bytes: input.fileSizeBytes,
    p_worksheet_name: input.worksheetName ?? null,
    p_header_fingerprint: input.headerFingerprint ?? null,
    p_default_source_id: input.defaultSourceId ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function replaceLeadImportMappingForCurrentUser(
  input: ReplaceLeadImportMappingInput
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertBulkImportPermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("replace_lead_import_mapping", {
    p_batch_id: input.batchId,
    p_mapping: input.mapping as LeadImportColumnMapping,
    p_default_source_id: input.defaultSourceId ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function replaceLeadImportRowsForCurrentUser(
  batchId: string,
  rows: readonly LeadImportParsedRow[]
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertBulkImportPermission(context);

  if (rows.length < 1 || rows.length > LEAD_IMPORT_LIMITS.maxRows) {
    throw new CrmError({
      code: "IMPORT_INVALID_ROWS",
      message: `Import must contain between 1 and ${LEAD_IMPORT_LIMITS.maxRows} rows.`,
      httpStatus: 422,
    });
  }

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("replace_lead_import_rows", {
    p_batch_id: batchId,
    p_rows: rows.map(mapParsedRowToRpcPayload),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function validateLeadImportBatchForCurrentUser(
  batchId: string
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertBulkImportPermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("validate_lead_import_batch", {
    p_batch_id: batchId,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function submitLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertBulkImportPermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("submit_lead_import_batch", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function approveLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertApprovePermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("approve_lead_import_batch", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function rejectLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number,
  rejectionReason: string
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertApprovePermission(context);

  const validationMessage = validateLeadImportRejectionReason(rejectionReason);
  if (validationMessage) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationMessage,
      httpStatus: 422,
    });
  }

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("reject_lead_import_batch", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
    p_rejection_reason: rejectionReason.trim(),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function confirmLeadImportBatchDirectForCurrentUser(
  batchId: string,
  expectedRevision: number
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  assertBulkImportPermission(context);

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("confirm_lead_import_batch_direct", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function cancelLeadImportBatchForCurrentUser(
  batchId: string
): Promise<LeadImportBatchDetail> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  if (!context.canBulkImportLeads) {
    throw new CrmError({
      code: "IMPORT_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("cancel_lead_import_batch", {
    p_batch_id: batchId,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id);
}

export async function processLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number,
  maxRows: number = LEAD_IMPORT_LIMITS.maxProcessChunk
): Promise<LeadImportProcessResult> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }

  if (!context.canBulkImportLeads) {
    throw new CrmError({
      code: "IMPORT_PERMISSION_DENIED",
      message: "Permission denied",
      httpStatus: 403,
    });
  }

  const supabase = await phase5dClient();
  const { data, error } = await supabase.rpc("process_lead_import_batch", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
    p_max_rows: maxRows,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  const payload = data as unknown as {
    processed: number;
    imported: number;
    failed: number;
    skipped: number;
    batch_status: string;
    done: boolean;
  };

  return {
    processed: payload.processed,
    imported: payload.imported,
    failed: payload.failed,
    skipped: payload.skipped,
    batchStatus: payload.batch_status as LeadImportProcessResult["batchStatus"],
    done: payload.done,
  };
}

export async function fetchLeadImportBatchWithRows(batchId: string): Promise<{
  readonly batch: LeadImportBatchDetail;
  readonly rows: Awaited<ReturnType<typeof fetchLeadImportBatchRows>>;
}> {
  const [batch, rows] = await Promise.all([
    fetchLeadImportBatchDetail(batchId),
    fetchLeadImportBatchRows(batchId),
  ]);

  if (!batch) {
    throw new CrmError({
      code: "IMPORT_BATCH_NOT_FOUND",
      message: "Import batch not found.",
      httpStatus: 404,
    });
  }

  return { batch, rows };
}
