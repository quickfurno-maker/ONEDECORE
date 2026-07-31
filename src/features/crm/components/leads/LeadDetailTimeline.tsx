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
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Timeline
      </h2>
      {timeline.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No timeline entries yet.</p>
      ) : (
        <ol className="mt-4 space-y-3">
          {timeline.map((entry) => (
            <li
              key={entry.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-neutral-200">{entry.title}</span>
                <span className="text-xs text-neutral-500">
                  {formatTimestamp(entry.occurredAt)}
                </span>
              </div>
              <p className="mt-1 text-neutral-400">
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
