import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

const STATUS_STYLES: Readonly<Record<LeadStageCode, string>> = {
  new: "bg-[var(--crm-info-soft)] text-[var(--crm-info)] border-[var(--crm-info)]/20",
  assigned:
    "bg-[var(--crm-info-soft)] text-[var(--crm-info)] border-[var(--crm-info)]/25",
  contacted: "bg-[var(--crm-primary-soft)] text-[var(--crm-primary)] border-[var(--crm-primary)]/15",
  qualified: "bg-[var(--crm-success-soft)] text-[var(--crm-success)] border-[var(--crm-success)]/20",
  consultation_scheduled:
    "bg-[var(--crm-info-soft)] text-[var(--crm-info)] border-[var(--crm-info)]/25",
  proposal_sent:
    "bg-[var(--crm-primary-soft)] text-[var(--crm-primary)] border-[var(--crm-primary)]/25",
  negotiation: "bg-[var(--crm-warning-soft)] text-[var(--crm-warning)] border-[var(--crm-warning)]/25",
  closed_won: "bg-[var(--crm-success-soft)] text-[var(--crm-success)] border-[var(--crm-success)]/25",
  closed_lost: "bg-[var(--crm-danger-soft)] text-[var(--crm-danger)] border-[var(--crm-danger)]/20",
  on_hold: "bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)] border-[var(--crm-border-strong)]",
};

interface LeadStatusBadgeProps {
  readonly status: LeadStageCode;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium tracking-wide ${STATUS_STYLES[status]}`}
    >
      {formatCrmCodeLabel(status)}
    </span>
  );
}
