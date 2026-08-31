import {
  CRM_LEAD_RISK_FLAG_LABELS,
  type CrmLeadRiskFlag,
} from "../../contracts/lead-score-contracts.ts";

/**
 * Risk flags are orthogonal to the priority score and never alter it (Q1).
 * Every chip carries text, so nothing depends on colour alone.
 */

const FLAG_CLASSES: Readonly<Record<CrmLeadRiskFlag, string>> = {
  SLA_BREACH:
    "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  OVERDUE_NEXT_ACTION:
    "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  NO_PRIMARY_NEXT_ACTION:
    "border-[var(--crm-danger)]/30 bg-[var(--crm-danger-soft)] text-[var(--crm-danger)]",
  UNASSIGNED:
    "border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
  PARKED:
    "border-[var(--crm-border-strong)] bg-[var(--crm-surface-subtle)] text-[var(--crm-muted)]",
  STALE:
    "border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] text-[var(--crm-warning)]",
};

interface LeadRiskFlagChipsProps {
  readonly flags: readonly CrmLeadRiskFlag[];
}

export function LeadRiskFlagChips({ flags }: LeadRiskFlagChipsProps) {
  if (flags.length === 0) {
    return null;
  }

  return (
    <ul
      className="flex flex-wrap items-center gap-1.5"
      data-testid="crm-lead-risk-flags"
    >
      {flags.map((flag) => (
        <li
          key={flag}
          data-risk-flag={flag}
          className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${FLAG_CLASSES[flag]}`}
        >
          {CRM_LEAD_RISK_FLAG_LABELS[flag]}
        </li>
      ))}
    </ul>
  );
}
