"use client";

import Link from "next/link";
import type { DragEvent } from "react";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import {
  CRM_PIPELINE_URGENCY_LABELS,
  formatPipelineStageAgeLabel,
  pipelineStageAgeDays,
  resolvePipelineUrgency,
  type CrmPipelineCard,
  type CrmPipelineUrgencyCode,
} from "../../contracts/pipeline-contracts.ts";
import { formatCalendarTimestampLabel } from "../../contracts/calendar-contracts.ts";
import { formatCompactInrFromPaise } from "../../contracts/deal-value-contracts.ts";
import { formatActivityTypeLabel } from "../activities/activity-ui-utils.ts";
import { LeadSalesBucketBadge } from "../leads/LeadSalesBucketBadge.tsx";
import { LeadScoreChip } from "../leads/LeadScoreChip.tsx";

interface PipelineLeadCardProps {
  readonly card: CrmPipelineCard;
  /** Server capture time — keeps urgency stable across hydration. */
  readonly now: number;
  readonly canMove: boolean;
  readonly pending: boolean;
  readonly showOwner: boolean;
  readonly onMoveRequest: (card: CrmPipelineCard) => void;
  readonly onDragStart: (card: CrmPipelineCard) => void;
  readonly onDragEnd: () => void;
}

/** Urgency never relies on colour alone — every tone also carries its label. */
const URGENCY_CLASSES: Readonly<Record<CrmPipelineUrgencyCode, string>> = {
  sla_breach:
    "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  no_next_action:
    "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  overdue:
    "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  new_uncontacted:
    "border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  due_today:
    "border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  upcoming:
    "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-text-secondary)]",
  none: "border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]",
};

export function PipelineLeadCard({
  card,
  now,
  canMove,
  pending,
  showOwner,
  onMoveRequest,
  onDragStart,
  onDragEnd,
}: PipelineLeadCardProps) {
  const urgency = resolvePipelineUrgency(card, now);
  const stageAge = pipelineStageAgeDays(card, now);

  const handleDragStart = (dragEvent: DragEvent<HTMLElement>) => {
    dragEvent.dataTransfer.effectAllowed = "move";
    dragEvent.dataTransfer.setData("text/plain", card.leadId);
    onDragStart(card);
  };

  return (
    <article
      draggable={canMove}
      onDragStart={canMove ? handleDragStart : undefined}
      onDragEnd={canMove ? onDragEnd : undefined}
      data-testid="crm-pipeline-card"
      data-lead-id={card.leadId}
      data-urgency={urgency}
      className={`relative rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-2.5 transition-colors ${
        pending ? "opacity-60" : "hover:border-[var(--crm-border-strong)]"
      } ${canMove ? "cursor-grab active:cursor-grabbing" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        {/* Stretched overlay: the whole card is the tap target for opening the
            lead, so the title is never a sub-32px hit area on mobile.
            draggable={false} keeps the native link drag from hijacking the
            card's own drag source. */}
        <Link
          href={`/admin/crm/leads/${card.leadId}`}
          draggable={false}
          className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--crm-text)] after:absolute after:inset-0 after:content-[''] hover:text-[var(--crm-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
          data-testid="crm-pipeline-card-open"
        >
          {card.displayName}
        </Link>
        <span
          className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${URGENCY_CLASSES[urgency]}`}
          data-testid="crm-pipeline-card-urgency"
        >
          {CRM_PIPELINE_URGENCY_LABELS[urgency]}
        </span>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1.5">
        {/* The EFFECTIVE bucket, from the same canonical resolver the list and
            the detail page use — the board is a selling surface, so the
            salesperson's own classification belongs here too. An on-hold card
            reads HOLD, because lifecycle outranks temperature. */}
        <LeadSalesBucketBadge
          bucket={card.salesBucket}
          source={card.salesBucketSource}
        />
        {/* Priority is derived, never persisted; breakdown stays off on a dense
            card, where the lead detail header is one tap away. */}
        <LeadScoreChip score={card.score} />
        {/* Unknown deal value is omitted entirely — never rendered as ₹0. */}
        {card.dealValuePaise !== null ? (
          <span
            className="truncate text-[11px] tabular-nums text-[var(--crm-text-secondary)]"
            data-testid="crm-pipeline-card-deal-value"
            title={`${formatCompactInrFromPaise(card.dealValuePaise)} ex-tax`}
          >
            {formatCompactInrFromPaise(card.dealValuePaise)}
          </span>
        ) : null}
      </div>

      <p className="mt-1 truncate text-[11px] text-[var(--crm-text-secondary)]">
        {formatCrmCodeLabel(card.serviceCode)}
        {card.locality ? ` · ${card.locality}` : ""}
      </p>

      <p className="mt-1.5 text-[11px] text-[var(--crm-muted)]">
        {card.primaryNextActionTitle ? (
          <>
            <span className="text-[var(--crm-text-secondary)]">
              {card.primaryNextActionTitle}
            </span>
            {card.primaryNextActionType
              ? ` · ${formatActivityTypeLabel(card.primaryNextActionType)}`
              : ""}
            {card.primaryNextActionDueAt ? (
              <span className="block tabular-nums">
                {formatCalendarTimestampLabel(card.primaryNextActionDueAt)}
              </span>
            ) : null}
          </>
        ) : (
          <span className="font-medium text-[var(--crm-danger)]">
            No primary next action
          </span>
        )}
      </p>

      <div className="mt-2 flex items-center justify-between gap-2">
        {/* Owner truncates; stage age never does — it is required card info. */}
        <p className="flex min-w-0 items-center gap-1 text-[10px] text-[var(--crm-muted)]">
          {showOwner ? (
            <>
              <span className="truncate">{card.assigneeLabel}</span>
              <span aria-hidden>·</span>
            </>
          ) : null}
          <span className="shrink-0">
            {formatPipelineStageAgeLabel(stageAge)}
            {card.stageEnteredSource === "created" ? " (approx)" : ""}
          </span>
        </p>
        {canMove ? (
          <button
            type="button"
            onClick={() => onMoveRequest(card)}
            disabled={pending}
            className="crm-btn crm-btn-ghost relative z-10 min-h-8 shrink-0 px-2 text-[11px] disabled:opacity-60"
            data-testid="crm-pipeline-move-stage"
          >
            Move stage
          </button>
        ) : null}
      </div>
    </article>
  );
}
