import Link from "next/link";
import { LEAD_STAGE_CODES } from "../../contracts/lead-stages.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import type { CrmLeadListItem } from "../../contracts/lead-dtos.ts";

interface LeadPipelineBoardProps {
  readonly items: readonly CrmLeadListItem[];
}

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (days <= 0) {
    return "Today";
  }
  return `${days}d`;
}

export function LeadPipelineBoard({ items }: LeadPipelineBoardProps) {
  return (
    <div className="hidden gap-3 overflow-x-auto pb-2 md:flex">
      {LEAD_STAGE_CODES.map((status) => {
        const column = items.filter((item) => item.status === status);
        return (
          <section
            key={status}
            className="w-64 shrink-0 rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-3"
          >
            <header className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                {formatCrmCodeLabel(status.replaceAll("_", "-"))}
              </h3>
              <span className="text-xs text-[var(--od-muted)]">{column.length}</span>
            </header>
            <ul className="space-y-2">
              {column.map((item) => (
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
          </section>
        );
      })}
    </div>
  );
}
