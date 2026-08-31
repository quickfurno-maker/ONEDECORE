"use client";

import { useState } from "react";
import {
  CRM_LEAD_RISK_FLAG_LABELS,
  type CrmLeadScore,
  type CrmLeadScoreBand,
} from "../../contracts/lead-score-contracts.ts";

/**
 * CRM 2D-2 — priority band chip with an expandable reason breakdown.
 *
 * The band is never colour-only: the chip always carries its band text and the
 * numeric score, so the signal survives greyscale and colour-blindness.
 */

const BAND_CLASSES: Readonly<Record<CrmLeadScoreBand, string>> = {
  HOT: "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  WARM: "border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  NURTURE:
    "border-[var(--crm-info)]/25 bg-[var(--crm-info-soft)] text-[var(--crm-info)]",
  COLD: "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]",
};

interface LeadScoreChipProps {
  readonly score: CrmLeadScore;
  /** Renders the reason breakdown disclosure. Off on dense surfaces. */
  readonly showBreakdown?: boolean;
}

export function LeadScoreChip({ score, showBreakdown = false }: LeadScoreChipProps) {
  const [open, setOpen] = useState(false);

  const chip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[11px] font-semibold tracking-wide ${BAND_CLASSES[score.band]}`}
      data-testid="crm-lead-score-chip"
      data-band={score.band}
      data-score={score.priorityScore}
    >
      {score.band}
      <span className="tabular-nums font-medium">{score.priorityScore}</span>
    </span>
  );

  if (!showBreakdown) {
    return chip;
  }

  return (
    <span className="relative inline-flex flex-col items-start">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        className="inline-flex min-h-8 items-center rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
        data-testid="crm-lead-score-toggle"
      >
        {chip}
        <span className="ml-1 text-[11px] text-[var(--crm-muted)]" aria-hidden>
          {open ? "▴" : "▾"}
        </span>
        <span className="sr-only">
          {open ? "Hide priority breakdown" : "Show priority breakdown"}
        </span>
      </button>

      {open ? (
        <div
          className="mt-1.5 w-full min-w-[15rem] max-w-full rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface)] p-3 text-[12px] shadow-sm sm:absolute sm:top-full sm:z-20 sm:w-[19rem]"
          data-testid="crm-lead-score-breakdown"
        >
          <p className="font-semibold text-[var(--crm-text)]">
            Priority {score.priorityScore}/100 · {score.band}
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--crm-muted)]">
            Maturity {score.maturityPoints} · Engagement {score.engagementPoints}
          </p>

          <ul className="mt-2 space-y-1">
            {score.reasons.length === 0 ? (
              <li className="text-[var(--crm-muted)]">
                No scoring signals recorded yet.
              </li>
            ) : (
              score.reasons.map((reason) => (
                <li
                  key={reason.code}
                  className="flex items-start justify-between gap-2"
                >
                  <span className="text-[var(--crm-text-secondary)]">
                    {reason.label}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium text-[var(--crm-text)]">
                    {reason.points}
                  </span>
                </li>
              ))
            )}
          </ul>

          {score.riskFlags.length > 0 ? (
            <p className="mt-2 border-t border-[var(--crm-border)] pt-2 text-[11px] text-[var(--crm-text-secondary)]">
              Risk flags do not change the score:{" "}
              {score.riskFlags
                .map((flag) => CRM_LEAD_RISK_FLAG_LABELS[flag])
                .join(", ")}
              .
            </p>
          ) : null}

          {!score.signalsAvailable.slaPolicyActive ? (
            <p className="mt-2 text-[11px] text-[var(--crm-muted)]">
              No SLA policy is active, so no SLA signal is included.
            </p>
          ) : null}
        </div>
      ) : null}
    </span>
  );
}
