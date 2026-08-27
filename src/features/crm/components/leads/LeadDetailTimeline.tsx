import type { CrmLeadDetailTimelineEntry } from "../../contracts/lead-detail-dtos.ts";

interface LeadDetailTimelineProps {
  readonly timeline: readonly CrmLeadDetailTimelineEntry[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailTimeline({ timeline }: LeadDetailTimelineProps) {
  return (
    <section className="crm-surface p-5">
      <h2 className="text-sm font-semibold text-[var(--crm-text)]">
        Timeline
      </h2>
      {timeline.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--crm-muted)]">No timeline entries yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {timeline.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--crm-text)]">{entry.title}</span>
                <span className="text-xs text-[var(--crm-muted)]">
                  {formatTimestamp(entry.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-[var(--crm-muted)]">
                {entry.kind === "activity" ? "Activity" : "Event"}
                {entry.actorLabel ? ` · ${entry.actorLabel}` : ""}
              </p>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
