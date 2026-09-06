import "server-only";

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
import { resolveCrmDb, type CrmDb } from "./crm-db.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  fetchLeadImportBatchDetail,
  fetchLeadImportBatchList,
  fetchLeadImportBatchRows,
} from "./crm-import-queries.ts";

/**
 * Bulk lead import — canonical orchestration.
 *
 * CRM-M9A made every entry point here context- and client-injectable so the
 * mobile boundary can run the SAME orchestration for a bearer caller. Nothing
 * about the import itself changed: the statuses, the file types, the mapping
 * vocabulary, the duplicate rules, the approval split, the assignment
 * resolution, the row/column/file-size limits, `entry_method`, the
 * `bulk-import` source and the processing chunk are all exactly as they were,
 * and all of them live in the contracts or the database, not here.
 *
 * THE RELOAD IS THE PART THAT MATTERS. Every mutation below re-reads the batch
 * afterwards, and that read is given the SAME client that performed the write.
 * Handing the reload a fresh cookie-scoped client would answer a bearer
 * caller's write with whatever a cookie session can see — usually nothing.
 */

async function phase5dClient(db?: CrmDb): Promise<SupabaseClient> {
  return (await resolveCrmDb(db)) as unknown as SupabaseClient;
}

async function reloadBatch(
  batchId: string,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  const batch = await fetchLeadImportBatchDetail(batchId, db);
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

/**
 * Approval is a SEPARATE permission from import authoring, and the split is the
 * whole point of the review step: the person who prepared a batch must not be
 * able to wave it through. `approve` and `reject` assert this one; every other
 * operation asserts `crm.leads.bulk_import`.
 */
function assertApprovePermission(context: CrmAccessContext): void {
  if (!context.canApproveLeadImports) {
    throw new CrmError({
      code: "IMPORT_APPROVE_DENIED",
      message: "You are not allowed to approve import batches.",
      httpStatus: 403,
    });
  }
}

async function requireImportContext(): Promise<CrmAccessContext> {
  const context = await getCrmAccessContext();
  if (!context) {
    throw new CrmError({
      code: "IMPORT_AUTH_REQUIRED",
      message: "Authentication required",
      httpStatus: 401,
    });
  }
  return context;
}

/* ========================================================================== */
/* Reads                                                                      */
/* ========================================================================== */

export async function fetchLeadImportBatchListForContext(
  context: CrmAccessContext,
  db?: CrmDb
): Promise<Awaited<ReturnType<typeof fetchLeadImportBatchList>>> {
  assertBulkImportPermission(context);
  return fetchLeadImportBatchList(db);
}

export async function fetchLeadImportBatchWithRowsForContext(
  context: CrmAccessContext,
  batchId: string,
  db?: CrmDb
): Promise<{
  readonly batch: LeadImportBatchDetail;
  readonly rows: Awaited<ReturnType<typeof fetchLeadImportBatchRows>>;
}> {
  assertBulkImportPermission(context);

  const [batch, rows] = await Promise.all([
    fetchLeadImportBatchDetail(batchId, db),
    fetchLeadImportBatchRows(batchId, db),
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

/* ========================================================================== */
/* Batch authoring                                                            */
/* ========================================================================== */

export async function createLeadImportBatchForContext(
  context: CrmAccessContext,
  input: CreateLeadImportBatchInput,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertBulkImportPermission(context);

  const supabase = await phase5dClient(db);
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

  return reloadBatch((data as { id: string }).id, db);
}

export async function replaceLeadImportMappingForContext(
  context: CrmAccessContext,
  input: ReplaceLeadImportMappingInput,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertBulkImportPermission(context);

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("replace_lead_import_mapping", {
    p_batch_id: input.batchId,
    p_mapping: input.mapping as LeadImportColumnMapping,
    p_default_source_id: input.defaultSourceId ?? null,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

export async function replaceLeadImportRowsForContext(
  context: CrmAccessContext,
  batchId: string,
  rows: readonly LeadImportParsedRow[],
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertBulkImportPermission(context);

  if (rows.length < 1 || rows.length > LEAD_IMPORT_LIMITS.maxRows) {
    throw new CrmError({
      code: "IMPORT_INVALID_ROWS",
      message: `Import must contain between 1 and ${LEAD_IMPORT_LIMITS.maxRows} rows.`,
      httpStatus: 422,
    });
  }

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("replace_lead_import_rows", {
    p_batch_id: batchId,
    p_rows: rows.map(mapParsedRowToRpcPayload),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

export async function validateLeadImportBatchForContext(
  context: CrmAccessContext,
  batchId: string,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertBulkImportPermission(context);

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("validate_lead_import_batch", {
    p_batch_id: batchId,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

/* ========================================================================== */
/* Lifecycle                                                                  */
/* ========================================================================== */

export async function submitLeadImportBatchForContext(
  context: CrmAccessContext,
  batchId: string,
  expectedRevision: number,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertBulkImportPermission(context);

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("submit_lead_import_batch", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

export async function approveLeadImportBatchForContext(
  context: CrmAccessContext,
  batchId: string,
  expectedRevision: number,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertApprovePermission(context);

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("approve_lead_import_batch", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

export async function rejectLeadImportBatchForContext(
  context: CrmAccessContext,
  batchId: string,
  expectedRevision: number,
  rejectionReason: string,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertApprovePermission(context);

  const validationMessage = validateLeadImportRejectionReason(rejectionReason);
  if (validationMessage) {
    throw new CrmError({
      code: "VALIDATION_FAILED",
      message: validationMessage,
      httpStatus: 422,
    });
  }

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("reject_lead_import_batch", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
    p_rejection_reason: rejectionReason.trim(),
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

export async function confirmLeadImportBatchDirectForContext(
  context: CrmAccessContext,
  batchId: string,
  expectedRevision: number,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertBulkImportPermission(context);

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("confirm_lead_import_batch_direct", {
    p_batch_id: batchId,
    p_expected_revision: expectedRevision,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

export async function cancelLeadImportBatchForContext(
  context: CrmAccessContext,
  batchId: string,
  db?: CrmDb
): Promise<LeadImportBatchDetail> {
  assertBulkImportPermission(context);

  const supabase = await phase5dClient(db);
  const { data, error } = await supabase.rpc("cancel_lead_import_batch", {
    p_batch_id: batchId,
  });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return reloadBatch((data as { id: string }).id, db);
}

/**
 * Processes one chunk of an approved batch.
 *
 * `maxRows` defaults to `LEAD_IMPORT_LIMITS.maxProcessChunk` and that default
 * is the only value any caller in this repo supplies. The chunk size is a
 * server-side throughput bound, not a client preference: a caller-chosen value
 * would let one request decide how much work a single transaction does.
 */
export async function processLeadImportBatchForContext(
  context: CrmAccessContext,
  batchId: string,
  expectedRevision: number,
  db?: CrmDb,
  maxRows: number = LEAD_IMPORT_LIMITS.maxProcessChunk
): Promise<LeadImportProcessResult> {
  assertBulkImportPermission(context);

  const supabase = await phase5dClient(db);
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

/* ========================================================================== */
/* Browser wrappers: cookie context, cookie client, unchanged                 */
/* ========================================================================== */

export async function createLeadImportBatchForCurrentUser(
  input: CreateLeadImportBatchInput
): Promise<LeadImportBatchDetail> {
  return createLeadImportBatchForContext(await requireImportContext(), input);
}

export async function replaceLeadImportMappingForCurrentUser(
  input: ReplaceLeadImportMappingInput
): Promise<LeadImportBatchDetail> {
  return replaceLeadImportMappingForContext(await requireImportContext(), input);
}

export async function replaceLeadImportRowsForCurrentUser(
  batchId: string,
  rows: readonly LeadImportParsedRow[]
): Promise<LeadImportBatchDetail> {
  return replaceLeadImportRowsForContext(
    await requireImportContext(),
    batchId,
    rows
  );
}

export async function validateLeadImportBatchForCurrentUser(
  batchId: string
): Promise<LeadImportBatchDetail> {
  return validateLeadImportBatchForContext(await requireImportContext(), batchId);
}

export async function submitLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number
): Promise<LeadImportBatchDetail> {
  return submitLeadImportBatchForContext(
    await requireImportContext(),
    batchId,
    expectedRevision
  );
}

export async function approveLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number
): Promise<LeadImportBatchDetail> {
  return approveLeadImportBatchForContext(
    await requireImportContext(),
    batchId,
    expectedRevision
  );
}

export async function rejectLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number,
  rejectionReason: string
): Promise<LeadImportBatchDetail> {
  return rejectLeadImportBatchForContext(
    await requireImportContext(),
    batchId,
    expectedRevision,
    rejectionReason
  );
}

export async function confirmLeadImportBatchDirectForCurrentUser(
  batchId: string,
  expectedRevision: number
): Promise<LeadImportBatchDetail> {
  return confirmLeadImportBatchDirectForContext(
    await requireImportContext(),
    batchId,
    expectedRevision
  );
}

export async function cancelLeadImportBatchForCurrentUser(
  batchId: string
): Promise<LeadImportBatchDetail> {
  return cancelLeadImportBatchForContext(await requireImportContext(), batchId);
}

export async function processLeadImportBatchForCurrentUser(
  batchId: string,
  expectedRevision: number,
  maxRows: number = LEAD_IMPORT_LIMITS.maxProcessChunk
): Promise<LeadImportProcessResult> {
  return processLeadImportBatchForContext(
    await requireImportContext(),
    batchId,
    expectedRevision,
    undefined,
    maxRows
  );
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
