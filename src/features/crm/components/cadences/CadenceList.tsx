import Link from "next/link";
import type { CrmCadenceTemplateSummary } from "../../contracts/cadence-contracts.ts";
import { CadenceStatusBadge } from "./CadenceStatusBadge.tsx";

interface CadenceListProps {
  readonly templates: readonly CrmCadenceTemplateSummary[];
}

/**
 * Admin catalogue. Deliberately a list with one usage count — cadence analytics
 * are CRM 2E scope, not CRM 2C.
 */
export function CadenceList({ templates }: CadenceListProps) {
  if (templates.length === 0) {
    return (
      <section className="crm-surface p-6" data-testid="crm-cadence-empty">
        <h2 className="text-sm font-semibold text-[var(--crm-text)]">
          No cadences yet
        </h2>
        <p className="mt-1.5 text-sm text-[var(--crm-muted)]">
          A cadence schedules the follow-up activities your team performs. Create
          a draft, add ordered steps, then publish it to make it enrollable.
        </p>
      </section>
    );
  }

  return (
    <ul className="space-y-3" data-testid="crm-cadence-list">
      {templates.map((template) => (
        <li key={template.id}>
          <Link
            href={`/admin/crm/cadences/${template.id}`}
            className="crm-surface block p-4 transition-colors hover:border-[var(--crm-border-strong)]"
            data-testid="crm-cadence-row"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[var(--crm-text)]">
                  {template.name}
                </p>
                {template.description ? (
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--crm-muted)]">
                    {template.description}
                  </p>
                ) : null}
              </div>
              <CadenceStatusBadge status={template.status} />
            </div>
            <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs text-[var(--crm-muted)]">
              <div className="flex gap-1.5">
                <dt>Steps</dt>
                <dd className="font-medium text-[var(--crm-text-secondary)]">
                  {template.stepCount}
                </dd>
              </div>
              <div className="flex gap-1.5">
                <dt>Live enrollments</dt>
                <dd
                  className="font-medium text-[var(--crm-text-secondary)]"
                  data-testid="crm-cadence-usage-count"
                >
                  {template.activeEnrollmentCount}
                </dd>
              </div>
            </dl>
          </Link>
        </li>
      ))}
    </ul>
  );
}
