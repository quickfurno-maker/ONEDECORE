"use client";

import { useId, useState } from "react";
import type { CrmLeadClosureReasonOption } from "../../contracts/lead-detail-dtos.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import {
  formatPipelineStageLabel,
  getPipelineDropTargets,
  type CrmPipelineCard,
} from "../../contracts/pipeline-contracts.ts";
import { CrmActivityDialogShell } from "../activities/CrmActivityDialogShell.tsx";
import { LeadClosedLostDialog } from "../leads/LeadClosedLostDialog.tsx";
import { LeadOnHoldDialog } from "../leads/LeadOnHoldDialog.tsx";

interface PipelineMoveStageDialogProps {
  readonly card: CrmPipelineCard | null;
  readonly closureReasons: readonly CrmLeadClosureReasonOption[];
  readonly pending: boolean;
  readonly errorMessage: string | null;
  readonly onMove: (card: CrmPipelineCard, target: LeadStageCode) => void;
  readonly onClose: () => void;
}

/**
 * Keyboard and touch path for stage movement — drag is never the only way.
 * On-hold and closed-lost reuse the canonical CRM 2A dialogs so their required
 * reason/closure-code semantics are preserved exactly.
 */
export function PipelineMoveStageDialog({
  card,
  closureReasons,
  pending,
  errorMessage,
  onMove,
  onClose,
}: PipelineMoveStageDialogProps) {
  // Remounted by the caller on every card change (keyed), so initializers are
  // the whole reset story — no synchronous effect state.
  const titleId = useId();
  const [onHoldOpen, setOnHoldOpen] = useState(false);
  const [closedLostOpen, setClosedLostOpen] = useState(false);

  if (!card) {
    return null;
  }

  const forwardTargets = getPipelineDropTargets(card.status);
  const canPause = card.status !== "on_hold";

  return (
    <>
      <CrmActivityDialogShell
        open={!onHoldOpen && !closedLostOpen}
        title="Move stage"
        titleId={titleId}
        description={`${card.displayName} — currently ${formatPipelineStageLabel(
          card.status
        )}.`}
        onClose={onClose}
        testId="crm-pipeline-move-dialog"
      >
        <div className="space-y-4">
          {errorMessage ? (
            <p className="text-sm text-[var(--crm-danger)]" role="alert">
              {errorMessage}
            </p>
          ) : null}

          {forwardTargets.length > 0 ? (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
                Move forward
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {forwardTargets.map((target) => (
                  <button
                    key={target}
                    type="button"
                    disabled={pending}
                    onClick={() => onMove(card, target)}
                    className="crm-btn crm-btn-secondary min-h-11 disabled:opacity-60"
                    data-testid={`crm-pipeline-move-to-${target}`}
                  >
                    {formatPipelineStageLabel(target)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--crm-muted)]">
              {card.status === "on_hold"
                ? "Resume this lead from its detail page to move it forward."
                : "No forward stage is available from here."}
            </p>
          )}

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--crm-muted)]">
              Needs a reason
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {canPause ? (
                <button
                  type="button"
                  onClick={() => setOnHoldOpen(true)}
                  className="crm-btn crm-btn-secondary min-h-11"
                  data-testid="crm-pipeline-on-hold"
                >
                  Place on hold
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setClosedLostOpen(true)}
                className="crm-btn crm-btn-danger-outline min-h-11"
                data-testid="crm-pipeline-closed-lost"
              >
                Mark closed lost
              </button>
            </div>
          </div>

          <p className="rounded-[8px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-[11px] text-[var(--crm-muted)]">
            Closed Won is set only when a quotation is accepted, and New /
            Assigned follow lead assignment. Those stages cannot be set here.
          </p>

          <div className="flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="crm-btn crm-btn-secondary min-h-11"
            >
              Close
            </button>
          </div>
        </div>
      </CrmActivityDialogShell>

      <LeadOnHoldDialog
        open={onHoldOpen}
        leadId={card.leadId}
        onClose={() => {
          setOnHoldOpen(false);
          onClose();
        }}
      />
      <LeadClosedLostDialog
        open={closedLostOpen}
        leadId={card.leadId}
        closureReasons={closureReasons}
        onClose={() => {
          setClosedLostOpen(false);
          onClose();
        }}
      />
    </>
  );
}
