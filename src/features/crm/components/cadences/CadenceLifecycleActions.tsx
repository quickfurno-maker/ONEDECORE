"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  INITIAL_CADENCE_ACTION_STATE,
  type CadenceActionState,
  type CrmCadenceTemplateDetail,
} from "../../contracts/cadence-contracts.ts";
import {
  archiveCadenceTemplateAction,
  duplicateCadenceTemplateAction,
  publishCadenceTemplateAction,
} from "../../server/crm-cadence-actions.ts";

interface CadenceLifecycleActionsProps {
  readonly template: CrmCadenceTemplateDetail;
}

export function CadenceLifecycleActions({
  template,
}: CadenceLifecycleActionsProps) {
  const router = useRouter();
  const [publishState, publishAction, publishPending] = useActionState<
    CadenceActionState,
    FormData
  >(publishCadenceTemplateAction, INITIAL_CADENCE_ACTION_STATE);
  const [archiveState, archiveAction, archivePending] = useActionState<
    CadenceActionState,
    FormData
  >(archiveCadenceTemplateAction, INITIAL_CADENCE_ACTION_STATE);
  const [duplicateState, duplicateAction, duplicatePending] = useActionState<
    CadenceActionState,
    FormData
  >(duplicateCadenceTemplateAction, INITIAL_CADENCE_ACTION_STATE);

  useEffect(() => {
    if (duplicateState.success && duplicateState.templateId) {
      router.push(`/admin/crm/cadences/${duplicateState.templateId}`);
      return;
    }
    if (publishState.success || archiveState.success) {
      router.refresh();
    }
  }, [
    publishState.success,
    archiveState.success,
    duplicateState.success,
    duplicateState.templateId,
    router,
  ]);

  const message =
    publishState.message || archiveState.message || duplicateState.message;
  const failed =
    (publishState.message && !publishState.success) ||
    (archiveState.message && !archiveState.success) ||
    (duplicateState.message && !duplicateState.success);

  return (
    <section className="crm-surface p-5" data-testid="crm-cadence-lifecycle">
      <h2 className="text-sm font-semibold text-[var(--crm-text)]">Lifecycle</h2>
      <p className="mt-1 text-xs text-[var(--crm-muted)]">
        Publishing freezes the steps so live enrollments cannot change underneath
        a rep. To revise a published cadence, duplicate it into a new draft.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        {template.status === "draft" ? (
          <form action={publishAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <button
              type="submit"
              disabled={publishPending || template.stepCount === 0}
              className="crm-btn crm-btn-primary"
              data-testid="crm-cadence-publish"
            >
              {publishPending ? "Publishing…" : "Publish"}
            </button>
          </form>
        ) : null}

        {template.status === "published" ? (
          <form action={duplicateAction} className="flex flex-wrap gap-2">
            <input type="hidden" name="templateId" value={template.id} />
            <input
              name="name"
              required
              maxLength={120}
              defaultValue={`${template.name} (copy)`}
              aria-label="New draft name"
              className="crm-input min-h-11 text-base sm:text-sm"
              data-testid="crm-cadence-duplicate-name"
            />
            <button
              type="submit"
              disabled={duplicatePending}
              className="crm-btn crm-btn-secondary"
              data-testid="crm-cadence-duplicate"
            >
              {duplicatePending ? "Copying…" : "Duplicate to draft"}
            </button>
          </form>
        ) : null}

        {template.status !== "archived" ? (
          <form action={archiveAction}>
            <input type="hidden" name="templateId" value={template.id} />
            <button
              type="submit"
              disabled={archivePending}
              className="crm-btn crm-btn-ghost"
              data-testid="crm-cadence-archive"
            >
              {archivePending ? "Archiving…" : "Archive"}
            </button>
          </form>
        ) : null}
      </div>

      {message ? (
        <p
          className={`mt-3 text-sm ${failed ? "text-red-300" : "text-emerald-300"}`}
          role="status"
          data-testid="crm-cadence-lifecycle-message"
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}
