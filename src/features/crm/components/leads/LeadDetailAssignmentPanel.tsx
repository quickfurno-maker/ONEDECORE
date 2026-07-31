import type { CrmLeadDetailAssignmentPanel } from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

interface LeadDetailAssignmentPanelProps {
  readonly assignment: CrmLeadDetailAssignmentPanel;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailAssignmentPanel({
  assignment,
}: LeadDetailAssignmentPanelProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Assignment
      </h2>
      <p className="mt-3 text-sm text-neutral-100">
        Current assignee: {assignment.currentAssigneeLabel}
      </p>

      {assignment.history.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No assignment history recorded.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {assignment.history.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-neutral-200">
                  {entry.previousAssigneeLabel ?? "Unassigned"} →{" "}
                  {entry.newAssigneeLabel ?? "Unassigned"}
                </span>
                <span className="text-xs text-neutral-500">
                  {formatTimestamp(entry.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-neutral-400">
                {formatCrmCodeLabel(entry.assignmentMethod)} · {entry.actorLabel}
              </p>
              {entry.reason ? (
                <p className="mt-1 text-neutral-300">{entry.reason}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
