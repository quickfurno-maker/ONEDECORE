import type { CrmCadenceTemplateStatus } from "../../contracts/cadence-contracts.ts";

const STATUS_LABELS: Readonly<Record<CrmCadenceTemplateStatus, string>> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};

const STATUS_CLASSES: Readonly<Record<CrmCadenceTemplateStatus, string>> = {
  draft: "border-[var(--crm-border-strong)] text-[var(--crm-muted)]",
  published: "border-emerald-500/40 text-emerald-300",
  archived: "border-[var(--crm-border)] text-[var(--crm-muted)]",
};

export function CadenceStatusBadge({
  status,
}: {
  readonly status: CrmCadenceTemplateStatus;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}
      data-testid={`crm-cadence-status-${status}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
