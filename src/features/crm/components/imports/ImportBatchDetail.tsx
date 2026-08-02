"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { CrmAccessContext } from "@/features/crm/contracts/crm-access.ts";
import type { CrmLeadSourceOption } from "@/features/crm/contracts/lead-detail-dtos.ts";
import {
  LEAD_IMPORT_MAPPING_FIELDS,
  canApproveImportBatch,
  canCancelImportBatch,
  canProcessImportBatch,
  canSubmitImportBatch,
  formatLeadImportStatusLabel,
  isEditableImportBatchStatus,
  suggestMappingFromHeaders,
  type LeadImportActionState,
  type LeadImportBatchDetail,
  type LeadImportRowDetail,
} from "@/features/crm/contracts/lead-import-contracts.ts";
import {
  approveLeadImportBatchAction,
  cancelLeadImportBatchAction,
  confirmLeadImportBatchDirectAction,
  processLeadImportBatchAction,
  rejectLeadImportBatchAction,
  saveLeadImportMappingAction,
  submitLeadImportBatchAction,
} from "@/features/crm/server/crm-import-actions.ts";

const INITIAL_STATE: LeadImportActionState = {
  success: false,
  message: "",
};

interface ImportBatchDetailProps {
  readonly batch: LeadImportBatchDetail;
  readonly rows: readonly LeadImportRowDetail[];
  readonly sources: readonly CrmLeadSourceOption[];
  readonly access: Pick<
    CrmAccessContext,
    "canApproveLeadImports" | "canBulkImportLeads" | "userId"
  >;
  readonly initialStep?: string;
}

export function ImportBatchDetail({
  batch,
  rows,
  sources: _sources,
  access,
  initialStep,
}: ImportBatchDetailProps) {
  const [mappingState, mappingAction, mappingPending] = useActionState(
    saveLeadImportMappingAction,
    INITIAL_STATE
  );
  const [workflowState, workflowAction, workflowPending] = useActionState(
    submitLeadImportBatchAction,
    INITIAL_STATE
  );
  const [approveState, approveAction, approvePending] = useActionState(
    approveLeadImportBatchAction,
    INITIAL_STATE
  );
  const [rejectState, rejectAction, rejectPending] = useActionState(
    rejectLeadImportBatchAction,
    INITIAL_STATE
  );
  const [directState, directAction, directPending] = useActionState(
    confirmLeadImportBatchDirectAction,
    INITIAL_STATE
  );
  const [cancelState, cancelAction, cancelPending] = useActionState(
    cancelLeadImportBatchAction,
    INITIAL_STATE
  );
  const [processState, processAction, processPending] = useActionState(
    processLeadImportBatchAction,
    INITIAL_STATE
  );

  const router = useRouter();

  useEffect(() => {
    if (
      mappingState.success ||
      workflowState.success ||
      approveState.success ||
      rejectState.success ||
      directState.success ||
      cancelState.success ||
      processState.success
    ) {
      router.refresh();
    }
  }, [
    approveState.success,
    cancelState.success,
    directState.success,
    mappingState.success,
    processState.success,
    rejectState.success,
    router,
    workflowState.success,
  ]);

  const headers = Object.keys(batch.mapping);
  const suggestions =
    headers.length > 0
      ? suggestMappingFromHeaders(headers)
      : ({} as Record<string, string>);
  const showMapping =
    initialStep === "mapping" || isEditableImportBatchStatus(batch.status);

  const latestMessage =
    [
      mappingState,
      workflowState,
      approveState,
      rejectState,
      directState,
      cancelState,
      processState,
    ].find((state) => state.message)?.message ?? "";

  return (
    <div className="space-y-6">
      <section className="grid gap-4 rounded-xl border border-neutral-800 bg-neutral-950/60 p-6 md:grid-cols-2 xl:grid-cols-4">
        <Metric label="Status" value={formatLeadImportStatusLabel(batch.status)} />
        <Metric label="Total rows" value={String(batch.totalRows)} />
        <Metric label="Importable" value={String(batch.importableRows)} />
        <Metric label="Revision" value={String(batch.validationRevision)} />
      </section>

      {latestMessage ? (
        <p className="text-sm text-neutral-300" role="status">
          {latestMessage}
        </p>
      ) : null}

      {showMapping ? (
        <form action={mappingAction} className="space-y-4 rounded-xl border border-neutral-800 p-6">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-neutral-50">Column mapping</h2>
            <p className="text-xs text-neutral-500">{batch.originalFilename}</p>
          </div>

          <input type="hidden" name="batchId" value={batch.id} />
          <input
            type="hidden"
            name="defaultSourceId"
            value={batch.defaultSourceId ?? ""}
          />

          <div className="space-y-2">
            <label htmlFor="mapping-file" className="text-sm text-neutral-300">
              Re-upload source file
            </label>
            <input
              id="mapping-file"
              name="file"
              type="file"
              accept=".csv,.xlsx"
              required
              className="block w-full rounded-md border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
            />
          </div>

          {headers.length === 0 ? (
            <p className="text-sm text-neutral-400">
              Upload the file above to configure column mapping.
            </p>
          ) : (
            <div className="overflow-hidden rounded-lg border border-neutral-800">
              <table className="min-w-full text-sm">
                <thead className="bg-neutral-900/80 text-left text-neutral-400">
                  <tr>
                    <th className="px-4 py-3">File column</th>
                    <th className="px-4 py-3">Maps to</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-900">
                  {headers.map((header) => (
                    <tr key={header}>
                      <td className="px-4 py-3 text-neutral-200">{header}</td>
                      <td className="px-4 py-3">
                        <select
                          name={`mapping.${header}`}
                          defaultValue={batch.mapping[header] ?? suggestions[header] ?? ""}
                          className="min-h-10 w-full rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-neutral-100"
                        >
                          <option value="">Skip</option>
                          {LEAD_IMPORT_MAPPING_FIELDS.map((field) => (
                            <option key={field} value={field}>
                              {field}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <button
            type="submit"
            disabled={mappingPending}
            className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950"
          >
            {mappingPending ? "Validating…" : "Save mapping and validate"}
          </button>
        </form>
      ) : null}

      <section className="space-y-3 rounded-xl border border-neutral-800 p-6">
        <h2 className="text-lg font-semibold text-neutral-50">Workflow actions</h2>
        <div className="flex flex-wrap gap-2">
          {canSubmitImportBatch(batch.status) ? (
            <form action={workflowAction}>
              <input type="hidden" name="batchId" value={batch.id} />
              <input
                type="hidden"
                name="validationRevision"
                value={batch.validationRevision}
              />
              <button
                type="submit"
                disabled={workflowPending}
                className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950"
              >
                Submit for approval
              </button>
            </form>
          ) : null}

          {access.canApproveLeadImports &&
          canApproveImportBatch(batch.status) &&
          batch.createdBy !== access.userId ? (
            <>
              <form action={approveAction}>
                <input type="hidden" name="batchId" value={batch.id} />
                <input
                  type="hidden"
                  name="validationRevision"
                  value={batch.validationRevision}
                />
                <button
                  type="submit"
                  disabled={approvePending}
                  className="min-h-11 rounded-md bg-emerald-500 px-4 py-2 text-sm font-semibold text-neutral-950"
                >
                  Approve
                </button>
              </form>
              <form action={rejectAction} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="batchId" value={batch.id} />
                <input
                  type="hidden"
                  name="validationRevision"
                  value={batch.validationRevision}
                />
                <label className="sr-only" htmlFor="rejection-reason">
                  Rejection reason
                </label>
                <input
                  id="rejection-reason"
                  name="rejectionReason"
                  placeholder="Rejection reason (min 10 chars)"
                  className="min-h-11 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm text-neutral-100"
                />
                <button
                  type="submit"
                  disabled={rejectPending}
                  className="min-h-11 rounded-md border border-rose-500/40 px-4 py-2 text-sm font-medium text-rose-300"
                >
                  Reject
                </button>
              </form>
            </>
          ) : null}

          {batch.status === "ready_for_review" ? (
            <form action={directAction}>
              <input type="hidden" name="batchId" value={batch.id} />
              <input
                type="hidden"
                name="validationRevision"
                value={batch.validationRevision}
              />
              <button
                type="submit"
                disabled={directPending}
                className="min-h-11 rounded-md border border-amber-500/40 px-4 py-2 text-sm font-medium text-amber-300"
              >
                Direct confirm (SA)
              </button>
            </form>
          ) : null}

          {canProcessImportBatch(batch.status) ? (
            <form action={processAction}>
              <input type="hidden" name="batchId" value={batch.id} />
              <input
                type="hidden"
                name="validationRevision"
                value={batch.validationRevision}
              />
              <button
                type="submit"
                disabled={processPending}
                className="min-h-11 rounded-md bg-sky-500 px-4 py-2 text-sm font-semibold text-neutral-950"
              >
                {batch.status === "importing" ? "Process next chunk" : "Start import"}
              </button>
            </form>
          ) : null}

          {canCancelImportBatch(batch.status) ? (
            <form action={cancelAction}>
              <input type="hidden" name="batchId" value={batch.id} />
              <button
                type="submit"
                disabled={cancelPending}
                className="min-h-11 rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-300"
              >
                Cancel batch
              </button>
            </form>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-800">
        <div className="border-b border-neutral-800 px-4 py-3">
          <h2 className="text-lg font-semibold text-neutral-50">Staged rows</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-950/80 text-left text-neutral-400">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Validation</th>
                <th className="px-4 py-3">Duplicate</th>
                <th className="px-4 py-3">Import</th>
                <th className="px-4 py-3">Lead</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-900">
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="px-4 py-3 text-neutral-400">{row.rowNumber}</td>
                  <td className="px-4 py-3 text-neutral-100">{row.submittedName}</td>
                  <td className="px-4 py-3 text-neutral-300">{row.validationStatus}</td>
                  <td className="px-4 py-3 text-neutral-300">
                    {row.duplicateOutcome ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-neutral-300">{row.importStatus}</td>
                  <td className="px-4 py-3">
                    {row.leadId ? (
                      <Link
                        href={`/admin/crm/leads/${row.leadId}`}
                        className="text-amber-300 hover:underline"
                      >
                        View lead
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-2 text-lg font-semibold text-neutral-50">{value}</p>
    </div>
  );
}
