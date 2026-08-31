"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { DragEvent } from "react";
import type { CrmAssigneeDirectoryEntry, CrmLeadClosureReasonOption } from "../../contracts/lead-detail-dtos.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import type { LifecycleActionState } from "../../contracts/lifecycle-contracts.ts";
import {
  CRM_PIPELINE_STAGE_FETCH_LIMIT,
  formatPipelineStageLabel,
  resolvePipelineDropRejection,
  sortPipelineCards,
  type CrmPipelineBoard as CrmPipelineBoardModel,
  type CrmPipelineBoardStage,
  type CrmPipelineCard,
} from "../../contracts/pipeline-contracts.ts";
import {
  formatCompactInrFromPaise,
  formatProbabilityLabel,
} from "../../contracts/deal-value-contracts.ts";
import { transitionLeadStatusAction } from "../../server/crm-lifecycle-actions.ts";
import { PipelineLeadCard } from "./PipelineLeadCard.tsx";
import { PipelineMoveStageDialog } from "./PipelineMoveStageDialog.tsx";

const INITIAL_STATE: LifecycleActionState = { success: false, message: "" };

interface CrmPipelineBoardProps {
  readonly board: CrmPipelineBoardModel;
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly closureReasons: readonly CrmLeadClosureReasonOption[];
  readonly canFilterOwner: boolean;
  readonly canTransition: boolean;
}

export function CrmPipelineBoard({
  board,
  assignees,
  closureReasons,
  canFilterOwner,
  canTransition,
}: CrmPipelineBoardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [moves, setMoves] = useState<Readonly<Record<string, CrmPipelineBoardStage>>>({});
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [draggingLeadId, setDraggingLeadId] = useState<string | null>(null);
  const [dropStage, setDropStage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [moveCardId, setMoveCardId] = useState<string | null>(null);

  // Adjusted during render (React's prop-change pattern), so a refreshed board
  // never paints a stale optimistic column.
  const [lastBoard, setLastBoard] = useState(board);
  if (lastBoard !== board) {
    setLastBoard(board);
    setMoves({});
    setPendingLeadId(null);
  }

  // Server capture time keeps urgency identical across server and client render.
  const now = Date.parse(board.capturedAt);

  const allCards = useMemo(
    () => board.columns.flatMap((column) => column.cards),
    [board]
  );

  // A rejected transition must never leave the card in the target column, so the
  // optimistic position is derived — never written back into server data.
  const columns = useMemo(
    () =>
      board.columns.map((column) => {
        const cards = allCards
          .filter((card) => (moves[card.leadId] ?? card.status) === column.stage)
          .map((card) =>
            moves[card.leadId] ? { ...card, status: moves[card.leadId]! } : card
          );
        const movedIn = cards.length - column.cards.length;
        return {
          ...column,
          cards: sortPipelineCards(cards, now),
          total: Math.max(0, column.total + movedIn),
        };
      }),
    [board, allCards, moves, now]
  );

  const moveCard =
    allCards.find((card) => card.leadId === moveCardId) ?? null;
  const moveCardWithStage = moveCard
    ? { ...moveCard, status: moves[moveCard.leadId] ?? moveCard.status }
    : null;

  const submitMove = (card: CrmPipelineCard, target: LeadStageCode) => {
    const from = moves[card.leadId] ?? card.status;
    const rejection = resolvePipelineDropRejection(from, target);
    if (rejection) {
      setErrorMessage(rejection);
      return;
    }

    setErrorMessage(null);
    setPendingLeadId(card.leadId);
    setMoves((current) => ({
      ...current,
      [card.leadId]: target as CrmPipelineBoardStage,
    }));

    startTransition(async () => {
      const formData = new FormData();
      formData.set("leadId", card.leadId);
      formData.set("newStatus", target);

      const result = await transitionLeadStatusAction(INITIAL_STATE, formData);

      if (!result.success) {
        setMoves((current) => {
          const next = { ...current };
          delete next[card.leadId];
          return next;
        });
        setPendingLeadId(null);
        setErrorMessage(result.message || "Stage move was rejected.");
        return;
      }

      setMoveCardId(null);
      router.refresh();
    });
  };

  const handleDrop = (targetStage: CrmPipelineBoardStage) => {
    setDropStage(null);
    const leadId = draggingLeadId;
    setDraggingLeadId(null);
    if (!leadId) {
      return;
    }
    const card = allCards.find((entry) => entry.leadId === leadId);
    if (!card) {
      return;
    }
    submitMove(card, targetStage);
  };

  const dropProps = (stage: CrmPipelineBoardStage) =>
    canTransition
      ? {
          onDragOver: (dragEvent: DragEvent<HTMLElement>) => {
            if (!draggingLeadId) {
              return;
            }
            dragEvent.preventDefault();
            dragEvent.dataTransfer.dropEffect = "move";
            setDropStage(stage);
          },
          onDragLeave: () => {
            setDropStage((current) => (current === stage ? null : current));
          },
          onDrop: (dragEvent: DragEvent<HTMLElement>) => {
            dragEvent.preventDefault();
            handleDrop(stage);
          },
        }
      : {};

  const showOwner = board.isTeamScope || canFilterOwner;

  // Aggregates come from the server RPC over the FULL RLS-scoped set — never
  // from the bounded per-column head, which would understate any column past
  // CRM_PIPELINE_STAGE_FETCH_LIMIT. They are therefore not recomputed on an
  // optimistic drag; the board refreshes after every accepted transition.
  const summary = board.valueSummary;
  const stageValueByStage = useMemo(
    () => new Map(summary.stages.map((entry) => [entry.stage, entry])),
    [summary]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] text-[var(--crm-muted)]">
            Ordered by urgency inside each stage · times in Asia/Kolkata
          </p>
          {!board.slaSignalAvailable ? (
            <p className="mt-0.5 text-[11px] text-[var(--crm-muted)]">
              No SLA policy is active, so no SLA-breach signal is shown.
            </p>
          ) : null}
        </div>
        {canFilterOwner ? (
          <form method="get" className="flex items-end gap-2">
            <label className="text-xs text-[var(--crm-muted)]">
              <span className="sr-only">Owner</span>
              <select
                name="owner"
                defaultValue={board.scopeOwnerId ?? "team"}
                className="crm-select min-h-10"
              >
                <option value="team">Team</option>
                {assignees.map((entry) => (
                  <option key={entry.userId} value={entry.userId}>
                    {entry.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="crm-btn crm-btn-secondary min-h-10">
              Apply
            </button>
          </form>
        ) : null}
      </div>

      <div
        className="rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2"
        data-testid="crm-pipeline-value-summary"
      >
        <p className="text-[12px] text-[var(--crm-text)]">
          <span className="font-semibold">
            Open pipeline {formatCompactInrFromPaise(summary.activeWeightedValuePaise)} weighted
          </span>
          <span className="text-[var(--crm-muted)]">
            {" "}
            (ex-tax) ·{" "}
            {formatCompactInrFromPaise(summary.activeDealValuePaise)} total ·{" "}
            {summary.activeValuedLeadCount} of {summary.activeLeadCount} leads valued
          </span>
        </p>
        {summary.parkedLeadCount > 0 ? (
          <p
            className="mt-0.5 text-[11px] text-[var(--crm-muted)]"
            data-testid="crm-pipeline-parked-summary"
          >
            On hold: {summary.parkedLeadCount} lead
            {summary.parkedLeadCount === 1 ? "" : "s"} ·{" "}
            {formatCompactInrFromPaise(summary.parkedDealValuePaise)} parked,
            excluded from weighted totals.
          </p>
        ) : null}
        {summary.activeValuedLeadCount < summary.activeLeadCount ? (
          <p className="mt-0.5 text-[11px] text-[var(--crm-muted)]">
            Leads without a quotation value are excluded from totals rather than
            counted as zero.
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p
          role="alert"
          data-testid="crm-pipeline-error"
          className="rounded-[10px] border border-[var(--crm-danger)]/25 bg-[var(--crm-danger-soft)] px-3 py-2 text-sm text-[var(--crm-danger)]"
        >
          {errorMessage}
        </p>
      ) : null}

      {canTransition ? (
        <p className="text-[11px] text-[var(--crm-muted)]">
          Drag a card to a later stage, or use Move stage on any card. Every move
          goes through the same audited transition as the lead detail page.
        </p>
      ) : null}

      <div className="crm-scrollbar-x -mx-1 overflow-x-auto px-1 pb-2">
        <div className="flex min-w-max gap-2.5">
          {columns.map((column) => (
            <section
              key={column.stage}
              className={`flex w-[264px] shrink-0 flex-col rounded-[12px] border bg-[var(--crm-surface-subtle)] p-2 ${
                dropStage === column.stage
                  ? "border-[var(--crm-primary)] bg-[var(--crm-primary-soft)]"
                  : "border-[var(--crm-border)]"
              }`}
              data-testid="crm-pipeline-column"
              data-stage={column.stage}
              {...dropProps(column.stage)}
            >
              <header className="mb-2 px-1">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="truncate text-[13px] font-semibold text-[var(--crm-text)]">
                    {formatPipelineStageLabel(column.stage)}
                  </h2>
                  <span className="shrink-0 text-[11px] font-medium tabular-nums text-[var(--crm-muted)]">
                    {column.total}
                  </span>
                </div>
                {(() => {
                  const value = stageValueByStage.get(column.stage);
                  if (!value) {
                    return null;
                  }
                  return (
                    <p
                      className="mt-0.5 truncate text-[10px] tabular-nums text-[var(--crm-muted)]"
                      data-testid="crm-pipeline-column-value"
                      data-stage-value={column.stage}
                      title={`${formatCompactInrFromPaise(value.weightedValuePaise)} weighted at ${formatProbabilityLabel(value.probabilityBasisPoints)} · ${value.valuedLeadCount} of ${value.leadCount} valued`}
                    >
                      {column.stage === "on_hold"
                        ? `${formatCompactInrFromPaise(value.dealValuePaise)} parked`
                        : `${formatCompactInrFromPaise(value.weightedValuePaise)} · ${formatProbabilityLabel(value.probabilityBasisPoints)}`}
                      {" · "}
                      {value.valuedLeadCount}/{value.leadCount} valued
                    </p>
                  );
                })()}
              </header>

              <div className="space-y-2">
                {column.cards.length === 0 ? (
                  <p className="rounded-[8px] border border-dashed border-[var(--crm-border)] px-2 py-4 text-center text-[11px] text-[var(--crm-muted)]">
                    Nothing here.
                  </p>
                ) : (
                  column.cards.map((card) => (
                    <PipelineLeadCard
                      key={card.leadId}
                      card={card}
                      now={now}
                      canMove={canTransition}
                      pending={pendingLeadId === card.leadId}
                      showOwner={showOwner}
                      onMoveRequest={(requested) => {
                        setErrorMessage(null);
                        setMoveCardId(requested.leadId);
                      }}
                      onDragStart={(dragged) => setDraggingLeadId(dragged.leadId)}
                      onDragEnd={() => {
                        setDraggingLeadId(null);
                        setDropStage(null);
                      }}
                    />
                  ))
                )}
              </div>

              {column.truncated ? (
                <Link
                  href={`/admin/crm/leads?status=${encodeURIComponent(column.stage)}`}
                  className="mt-2 inline-flex min-h-9 items-center px-1 text-[11px] font-medium text-[var(--crm-primary)]"
                >
                  View all {column.total} in Leads
                </Link>
              ) : null}
            </section>
          ))}
        </div>
      </div>

      <p className="text-[11px] text-[var(--crm-muted)]">
        Each stage shows up to {CRM_PIPELINE_STAGE_FETCH_LIMIT} of its most urgent
        leads; totals are full RLS-scoped counts. Closed Won and Closed Lost leads
        live in the Leads workspace.
      </p>

      <PipelineMoveStageDialog
        key={moveCardWithStage?.leadId ?? "none"}
        card={moveCardWithStage}
        closureReasons={closureReasons}
        pending={pending}
        errorMessage={errorMessage}
        onMove={submitMove}
        onClose={() => {
          setMoveCardId(null);
          setErrorMessage(null);
        }}
      />
    </div>
  );
}
