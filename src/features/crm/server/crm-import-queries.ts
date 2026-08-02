import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  LeadImportBatchDetail,
  LeadImportBatchStatus,
  LeadImportBatchSummary,
  LeadImportColumnMapping,
  LeadImportRowDetail,
  LeadImportValidationError,
} from "../contracts/lead-import-contracts.ts";
import { crmErrorFromPostgresMessage } from "./crm-errors.ts";

interface ImportBatchRow {
  readonly id: string;
  readonly client_request_id: string;
  readonly created_by: string;
  readonly status: LeadImportBatchStatus;
  readonly approval_kind: string | null;
  readonly validation_revision: number;
  readonly original_filename: string;
  readonly file_sha256: string;
  readonly file_type: "csv" | "xlsx";
  readonly file_size_bytes: number;
  readonly worksheet_name: string | null;
  readonly header_fingerprint: string | null;
  readonly mapping: LeadImportColumnMapping | null;
  readonly default_source_id: string | null;
  readonly total_rows: number;
  readonly valid_rows: number;
  readonly invalid_rows: number;
  readonly duplicate_blocked_rows: number;
  readonly importable_rows: number;
  readonly imported_rows: number;
  readonly failed_rows: number;
  readonly submitted_at: string | null;
  readonly approved_at: string | null;
  readonly rejected_at: string | null;
  readonly rejection_reason: string | null;
  readonly import_started_at: string | null;
  readonly import_completed_at: string | null;
  readonly cancelled_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}

interface ImportRowRecord {
  readonly id: string;
  readonly row_number: number;
  readonly submitted_name: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly service_code: string;
  readonly property_code: string;
  readonly timeline_code: string;
  readonly primary_source_id: string | null;
  readonly locality: string | null;
  readonly budget_comfort_code: string | null;
  readonly room_codes: string[] | null;
  readonly message: string | null;
  readonly source_detail: string | null;
  readonly validation_status: LeadImportRowDetail["validationStatus"];
  readonly duplicate_outcome: LeadImportRowDetail["duplicateOutcome"];
  readonly validation_errors: LeadImportValidationError[] | null;
  readonly assignment_rule_id: string | null;
  readonly resolved_assignee_id: string | null;
  readonly assignment_resolution_code: LeadImportRowDetail["assignmentResolutionCode"];
  readonly import_status: LeadImportRowDetail["importStatus"];
  readonly lead_id: string | null;
  readonly import_error_code: string | null;
}

function mapBatchSummary(row: ImportBatchRow): LeadImportBatchSummary {
  return {
    id: row.id,
    status: row.status,
    originalFilename: row.original_filename,
    fileType: row.file_type,
    totalRows: row.total_rows,
    validRows: row.valid_rows,
    invalidRows: row.invalid_rows,
    duplicateBlockedRows: row.duplicate_blocked_rows,
    importableRows: row.importable_rows,
    importedRows: row.imported_rows,
    failedRows: row.failed_rows,
    validationRevision: row.validation_revision,
    approvalKind:
      row.approval_kind === "manager_submission" ||
      row.approval_kind === "direct_import"
        ? row.approval_kind
        : null,
    submittedAt: row.submitted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  };
}

function mapBatchDetail(row: ImportBatchRow): LeadImportBatchDetail {
  return {
    ...mapBatchSummary(row),
    clientRequestId: row.client_request_id,
    fileSha256: row.file_sha256,
    fileSizeBytes: row.file_size_bytes,
    worksheetName: row.worksheet_name,
    headerFingerprint: row.header_fingerprint,
    mapping: row.mapping ?? {},
    defaultSourceId: row.default_source_id,
    rejectionReason: row.rejection_reason,
    approvedAt: row.approved_at,
    rejectedAt: row.rejected_at,
    importStartedAt: row.import_started_at,
    importCompletedAt: row.import_completed_at,
    cancelledAt: row.cancelled_at,
  };
}

function mapImportRow(row: ImportRowRecord): LeadImportRowDetail {
  return {
    id: row.id,
    rowNumber: row.row_number,
    submittedName: row.submitted_name,
    phone: row.phone,
    email: row.email,
    serviceCode: row.service_code,
    propertyCode: row.property_code,
    timelineCode: row.timeline_code,
    primarySourceId: row.primary_source_id,
    locality: row.locality,
    budgetComfortCode: row.budget_comfort_code,
    roomCodes: row.room_codes ?? [],
    message: row.message,
    sourceDetail: row.source_detail,
    validationStatus: row.validation_status,
    duplicateOutcome: row.duplicate_outcome,
    validationErrors: row.validation_errors ?? [],
    assignmentRuleId: row.assignment_rule_id,
    resolvedAssigneeId: row.resolved_assignee_id,
    assignmentResolutionCode: row.assignment_resolution_code,
    importStatus: row.import_status,
    leadId: row.lead_id,
    importErrorCode: row.import_error_code,
  };
}

async function phase5dClient(): Promise<SupabaseClient> {
  return (await createClient()) as unknown as SupabaseClient;
}

export async function fetchLeadImportBatchList(): Promise<
  readonly LeadImportBatchSummary[]
> {
  const supabase = await phase5dClient();
  const { data, error } = await supabase
    .from("lead_import_batches")
    .select(
      "id, client_request_id, created_by, status, approval_kind, validation_revision, original_filename, file_sha256, file_type, file_size_bytes, worksheet_name, header_fingerprint, mapping, default_source_id, total_rows, valid_rows, invalid_rows, duplicate_blocked_rows, importable_rows, imported_rows, failed_rows, submitted_at, approved_at, rejected_at, rejection_reason, import_started_at, import_completed_at, cancelled_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(100);

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data as ImportBatchRow[] | null)?.map(mapBatchSummary) ?? [];
}

export async function fetchLeadImportBatchDetail(
  batchId: string
): Promise<LeadImportBatchDetail | null> {
  const supabase = await phase5dClient();
  const { data, error } = await supabase
    .from("lead_import_batches")
    .select(
      "id, client_request_id, created_by, status, approval_kind, validation_revision, original_filename, file_sha256, file_type, file_size_bytes, worksheet_name, header_fingerprint, mapping, default_source_id, total_rows, valid_rows, invalid_rows, duplicate_blocked_rows, importable_rows, imported_rows, failed_rows, submitted_at, approved_at, rejected_at, rejection_reason, import_started_at, import_completed_at, cancelled_at, created_at, updated_at"
    )
    .eq("id", batchId)
    .maybeSingle();

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return data ? mapBatchDetail(data as ImportBatchRow) : null;
}

export async function fetchLeadImportBatchRows(
  batchId: string
): Promise<readonly LeadImportRowDetail[]> {
  const supabase = await phase5dClient();
  const { data, error } = await supabase
    .from("lead_import_rows")
    .select(
      "id, row_number, submitted_name, phone, email, service_code, property_code, timeline_code, primary_source_id, locality, budget_comfort_code, room_codes, message, source_detail, validation_status, duplicate_outcome, validation_errors, assignment_rule_id, resolved_assignee_id, assignment_resolution_code, import_status, lead_id, import_error_code"
    )
    .eq("batch_id", batchId)
    .order("row_number", { ascending: true });

  if (error) {
    throw crmErrorFromPostgresMessage(error.message, "RPC_FAILED");
  }

  return (data as ImportRowRecord[] | null)?.map(mapImportRow) ?? [];
}
