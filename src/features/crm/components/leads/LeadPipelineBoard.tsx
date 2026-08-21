import Link from "next/link";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import { PIPELINE_STAGE_PREVIEW_SIZE } from "../../contracts/lead-list-query.ts";
import type { CrmLeadListItem } from "../../contracts/lead-dtos.ts";
import type { LeadStageCode } from "../../contracts/lead-stages.ts";

export interface LeadPipelineStageColumn {
  readonly status: LeadStageCode;
  readonly total: number;
  readonly items: readonly CrmLeadListItem[];
}

interface LeadPipelineBoardProps {
  readonly stages: readonly LeadPipelineStageColumn[];
}

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) {
    return "Today";
  }
  return `${days}d`;
}

export function LeadPipelineBoard({ stages }: LeadPipelineBoardProps) {
  return (
    <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
      {stages.map((stage) => {
        const preview = stage.items.slice(0, PIPELINE_STAGE_PREVIEW_SIZE);
        return (
          <section
            key={stage.status}
            className="w-64 shrink-0 rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-3"
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {formatCrmCodeLabel(stage.status.replaceAll("_", "-"))}
              </h3>
              <span className="text-xs font-medium text-[var(--od-text-2)]">{stage.total}</span>
            </header>
            <ul className="space-y-2">
              {preview.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/admin/crm/leads/${item.id}`}
                    className="block rounded-[10px] border border-[var(--od-border)] bg-[var(--od-elevated)] p-3 hover:border-[var(--od-border-strong)]"
                  >
                    <p className="text-sm font-medium">{item.submittedName}</p>
                    <p className="mt-1 text-xs text-[var(--od-muted)]">
                      {formatCrmCodeLabel(item.serviceCode)}
                    </p>
                    <p className="mt-1 text-xs text-[var(--od-muted)]">
                      {item.locality ?? "—"} · {item.assigneeLabel} · {ageLabel(item.createdAt)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {stage.total > preview.length ? (
              <Link
                href={`/admin/crm/leads?status=${encodeURIComponent(stage.status)}`}
                className="mt-3 inline-flex min-h-8 items-center text-xs font-medium text-[var(--od-gold)]"
              >
                View all {stage.total}
              </Link>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
