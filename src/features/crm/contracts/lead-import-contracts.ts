/**
 * Phase 5D — bulk lead import contracts.
 */

import {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
  type LeadBudgetComfortCode,
  type LeadPropertyCode,
  type LeadRoomCode,
  type LeadServiceCode,
  type LeadTimelineCode,
} from "../../lead-intake/planner-allowlist.ts";

export const LEAD_IMPORT_BATCH_STATUSES = [
  "draft",
  "validation_failed",
  "ready_for_review",
  "pending_super_admin_approval",
  "approved",
  "rejected",
  "importing",
  "completed",
  "completed_with_errors",
  "cancelled",
] as const;

export type LeadImportBatchStatus = (typeof LEAD_IMPORT_BATCH_STATUSES)[number];

export const LEAD_IMPORT_FILE_TYPES = ["csv", "xlsx"] as const;
export type LeadImportFileType = (typeof LEAD_IMPORT_FILE_TYPES)[number];

export const LEAD_IMPORT_APPROVAL_KINDS = [
  "manager_submission",
  "direct_import",
] as const;

export type LeadImportApprovalKind = (typeof LEAD_IMPORT_APPROVAL_KINDS)[number];

export const LEAD_IMPORT_ROW_VALIDATION_STATUSES = [
  "pending",
  "valid",
  "invalid",
] as const;

export type LeadImportRowValidationStatus =
  (typeof LEAD_IMPORT_ROW_VALIDATION_STATUSES)[number];

export const LEAD_IMPORT_DUPLICATE_OUTCOMES = [
  "CLEAR",
  "REUSABLE_CONTACT",
  "ACTIVE_DUPLICATE",
  "RECENT_SIMILAR",
  "CONTACT_IDENTITY_CONFLICT",
] as const;

export type LeadImportDuplicateOutcome =
  (typeof LEAD_IMPORT_DUPLICATE_OUTCOMES)[number];

export const LEAD_IMPORT_ROW_IMPORT_STATUSES = [
  "pending",
  "ready",
  "imported",
  "failed",
  "skipped",
] as const;

export type LeadImportRowImportStatus =
  (typeof LEAD_IMPORT_ROW_IMPORT_STATUSES)[number];

export const LEAD_IMPORT_ASSIGNMENT_RESOLUTION_CODES = [
  "RULE_MATCH",
  "NO_MATCH_UNASSIGNED",
  "TARGET_INELIGIBLE_UNASSIGNED",
] as const;

export type LeadImportAssignmentResolutionCode =
  (typeof LEAD_IMPORT_ASSIGNMENT_RESOLUTION_CODES)[number];

export const LEAD_IMPORT_MAPPING_FIELDS = [
  "submitted_name",
  "phone",
  "email",
  "service_code",
  "property_code",
  "timeline_code",
  "primary_source_id",
  "locality",
  "budget_comfort_code",
  "room_codes",
  "message",
  "source_detail",
] as const;

export type LeadImportMappingField = (typeof LEAD_IMPORT_MAPPING_FIELDS)[number];

export type LeadImportColumnMapping = Readonly<
  Record<string, LeadImportMappingField>
>;

export const LEAD_IMPORT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxRows: 1000,
  maxColumns: 50,
  maxProcessChunk: 100,
  rejectionReasonMin: 10,
  rejectionReasonMax: 500,
} as const;

export const LEAD_IMPORT_MAX_FILE_BYTES = LEAD_IMPORT_LIMITS.maxFileBytes;
export const LEAD_IMPORT_MAX_ROWS = LEAD_IMPORT_LIMITS.maxRows;
export const LEAD_IMPORT_MAX_COLUMNS = LEAD_IMPORT_LIMITS.maxColumns;
export const LEAD_IMPORT_ALLOWED_FILE_TYPES = LEAD_IMPORT_FILE_TYPES;
export const LEAD_IMPORT_MAPPING_TARGET_FIELDS = LEAD_IMPORT_MAPPING_FIELDS;

/** Owner correction: imported leads use entry_method = import, source = bulk-import */
export const LEAD_IMPORT_TRANSPORT = {
  entryMethod: "import",
  source: "bulk-import",
} as const;

export const LEAD_IMPORT_ENTRY_METHOD = LEAD_IMPORT_TRANSPORT.entryMethod;
export const LEAD_IMPORT_LEAD_SOURCE = LEAD_IMPORT_TRANSPORT.source;

export interface LeadImportValidationError {
  readonly field: string;
  readonly code: string;
  readonly message: string;
}

export interface LeadImportParsedRow {
  readonly rowNumber: number;
  readonly submittedName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly serviceCode: string;
  readonly propertyCode: string;
  readonly timelineCode: string;
  readonly primarySourceId: string | null;
  readonly locality: string | null;
  readonly budgetComfortCode: string | null;
  readonly roomCodes: readonly string[];
  readonly message: string | null;
  readonly sourceDetail: string | null;
}

export interface LeadImportParseResult {
  readonly fileType: LeadImportFileType;
  readonly worksheetName: string | null;
  readonly headers: readonly string[];
  readonly headerFingerprint: string;
  readonly rows: readonly LeadImportParsedRow[];
}

export interface LeadImportBatchSummary {
  readonly id: string;
  readonly status: LeadImportBatchStatus;
  readonly originalFilename: string;
  readonly fileType: LeadImportFileType;
  readonly totalRows: number;
  readonly validRows: number;
  readonly invalidRows: number;
  readonly duplicateBlockedRows: number;
  readonly importableRows: number;
  readonly importedRows: number;
  readonly failedRows: number;
  readonly validationRevision: number;
  readonly approvalKind: LeadImportApprovalKind | null;
  readonly submittedAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly createdBy: string;
}

export interface LeadImportBatchDetail extends LeadImportBatchSummary {
  readonly clientRequestId: string;
  readonly fileSha256: string;
  readonly fileSizeBytes: number;
  readonly worksheetName: string | null;
  readonly headerFingerprint: string | null;
  readonly mapping: LeadImportColumnMapping;
  readonly defaultSourceId: string | null;
  readonly rejectionReason: string | null;
  readonly approvedAt: string | null;
  readonly rejectedAt: string | null;
  readonly importStartedAt: string | null;
  readonly importCompletedAt: string | null;
  readonly cancelledAt: string | null;
}

export interface LeadImportRowDetail {
  readonly id: string;
  readonly rowNumber: number;
  readonly submittedName: string;
  readonly phone: string | null;
  readonly email: string | null;
  readonly serviceCode: string;
  readonly propertyCode: string;
  readonly timelineCode: string;
  readonly primarySourceId: string | null;
  readonly locality: string | null;
  readonly budgetComfortCode: string | null;
  readonly roomCodes: readonly string[];
  readonly message: string | null;
  readonly sourceDetail: string | null;
  readonly validationStatus: LeadImportRowValidationStatus;
  readonly duplicateOutcome: LeadImportDuplicateOutcome | null;
  readonly validationErrors: readonly LeadImportValidationError[];
  readonly assignmentRuleId: string | null;
  readonly resolvedAssigneeId: string | null;
  readonly assignmentResolutionCode: LeadImportAssignmentResolutionCode | null;
  readonly importStatus: LeadImportRowImportStatus;
  readonly leadId: string | null;
  readonly importErrorCode: string | null;
}

export interface LeadImportProcessResult {
  readonly processed: number;
  readonly imported: number;
  readonly failed: number;
  readonly skipped: number;
  readonly batchStatus: LeadImportBatchStatus;
  readonly done: boolean;
}

export interface CreateLeadImportBatchInput {
  readonly clientRequestId: string;
  readonly originalFilename: string;
  readonly fileSha256: string;
  readonly fileType: LeadImportFileType;
  readonly fileSizeBytes: number;
  readonly worksheetName?: string | null;
  readonly headerFingerprint?: string | null;
  readonly defaultSourceId?: string | null;
}

export interface ReplaceLeadImportMappingInput {
  readonly batchId: string;
  readonly mapping: LeadImportColumnMapping;
  readonly defaultSourceId?: string | null;
}

export interface LeadImportActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
  readonly batchId?: string;
  readonly fieldErrors?: Readonly<Record<string, string>>;
}

export function isLeadImportMappingField(
  value: string
): value is LeadImportMappingField {
  return (LEAD_IMPORT_MAPPING_FIELDS as readonly string[]).includes(value);
}

export function formatLeadImportStatusLabel(status: LeadImportBatchStatus): string {
  return status
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isEditableImportBatchStatus(status: LeadImportBatchStatus): boolean {
  return status === "draft" || status === "validation_failed" || status === "ready_for_review";
}

export function canSubmitImportBatch(status: LeadImportBatchStatus): boolean {
  return status === "ready_for_review";
}

export function canApproveImportBatch(status: LeadImportBatchStatus): boolean {
  return status === "pending_super_admin_approval";
}

export function canProcessImportBatch(status: LeadImportBatchStatus): boolean {
  return status === "approved" || status === "importing";
}

export function canCancelImportBatch(status: LeadImportBatchStatus): boolean {
  return ![
    "importing",
    "completed",
    "completed_with_errors",
    "approved",
    "rejected",
    "cancelled",
  ].includes(status);
}

export function mapParsedRowToRpcPayload(row: LeadImportParsedRow): Record<string, unknown> {
  return {
    row_number: row.rowNumber,
    submitted_name: row.submittedName,
    phone: row.phone,
    email: row.email,
    service_code: row.serviceCode,
    property_code: row.propertyCode,
    timeline_code: row.timelineCode,
    primary_source_id: row.primarySourceId,
    locality: row.locality,
    budget_comfort_code: row.budgetComfortCode,
    room_codes: [...row.roomCodes],
    message: row.message,
    source_detail: row.sourceDetail,
  };
}

export function suggestMappingFromHeaders(
  headers: readonly string[]
): LeadImportColumnMapping {
  const suggestions: Record<string, LeadImportMappingField> = {};
  const aliases: Readonly<Record<LeadImportMappingField, readonly string[]>> = {
    submitted_name: ["name", "full name", "lead name", "submitted name", "customer name"],
    phone: ["phone", "mobile", "contact number", "phone number"],
    email: ["email", "email address", "e-mail"],
    service_code: ["service", "service code", "service type"],
    property_code: ["property", "property code", "property type", "bhk"],
    timeline_code: ["timeline", "timeline code", "when"],
    primary_source_id: ["source", "source id", "lead source"],
    locality: ["locality", "area", "location", "city"],
    budget_comfort_code: ["budget", "budget code", "budget range"],
    room_codes: ["rooms", "room codes", "room types"],
    message: ["message", "notes", "comments", "remarks"],
    source_detail: ["source detail", "campaign", "utm", "referrer"],
  };

  for (const header of headers) {
    const normalized = header.trim().toLowerCase();
    for (const [field, patterns] of Object.entries(aliases) as ReadonlyArray<
      [LeadImportMappingField, readonly string[]]
    >) {
      if (patterns.some((pattern) => normalized === pattern || normalized.includes(pattern))) {
        suggestions[header] = field;
        break;
      }
    }
  }

  return suggestions;
}

export function validateLeadImportRejectionReason(
  reason: string
): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < LEAD_IMPORT_LIMITS.rejectionReasonMin) {
    return `Rejection reason must be at least ${LEAD_IMPORT_LIMITS.rejectionReasonMin} characters.`;
  }
  if (trimmed.length > LEAD_IMPORT_LIMITS.rejectionReasonMax) {
    return `Rejection reason must be at most ${LEAD_IMPORT_LIMITS.rejectionReasonMax} characters.`;
  }
  return null;
}

export interface LeadImportMappingValidationError {
  readonly field: string;
  readonly message: string;
}

export function validateLeadImportMappingInput(input: {
  readonly mapping: Readonly<Record<string, string>>;
  readonly defaultSourceId?: string | null;
}): readonly LeadImportMappingValidationError[] {
  const errors: LeadImportMappingValidationError[] = [];

  for (const [header, field] of Object.entries(input.mapping)) {
    if (field.length > 0 && !isLeadImportMappingField(field)) {
      errors.push({
        field: "mapping",
        message: `Unknown mapping target "${field}" for column "${header}".`,
      });
    }
  }

  return errors;
}

export {
  LEAD_BUDGET_COMFORT_CODES,
  LEAD_PROPERTY_CODES,
  LEAD_ROOM_CODES,
  LEAD_SERVICE_CODES,
  LEAD_TIMELINE_CODES,
  type LeadBudgetComfortCode,
  type LeadPropertyCode,
  type LeadRoomCode,
  type LeadServiceCode,
  type LeadTimelineCode,
};
