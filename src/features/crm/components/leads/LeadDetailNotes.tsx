import type { CrmLeadDetailNote } from "../../contracts/lead-detail-dtos.ts";

interface LeadDetailNotesProps {
  readonly notes: readonly CrmLeadDetailNote[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailNotes({ notes }: LeadDetailNotesProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Notes
      </h2>
      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No notes recorded.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-neutral-200">{note.authorLabel}</span>
                <span className="text-xs text-neutral-500">
                  {formatTimestamp(note.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-neutral-300">{note.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
