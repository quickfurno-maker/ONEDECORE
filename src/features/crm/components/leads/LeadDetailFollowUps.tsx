import type { CrmLeadDetailFollowUp } from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

interface LeadDetailFollowUpsProps {
  readonly followUps: readonly CrmLeadDetailFollowUp[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailFollowUps({ followUps }: LeadDetailFollowUpsProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Follow-ups
      </h2>
      {followUps.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No follow-ups scheduled.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {followUps.map((followUp) => (
            <li
              key={followUp.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-neutral-200">
                  {followUp.ownerLabel}
                </span>
                <span className="text-xs text-neutral-500">
                  Due {formatTimestamp(followUp.dueAt)}
                </span>
              </div>
              <p className="mt-1 text-neutral-400">
                {formatCrmCodeLabel(followUp.status)}
                {followUp.outcome ? ` · ${followUp.outcome}` : ""}
              </p>
              {followUp.completedAt ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Completed {formatTimestamp(followUp.completedAt)}
                </p>
              ) : null}
              {followUp.cancelledAt ? (
                <p className="mt-1 text-xs text-neutral-500">
                  Cancelled {formatTimestamp(followUp.cancelledAt)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
