import type { CrmLeadDetailNote } from "../../contracts/lead-detail-dtos.ts";
import { LeadNoteComposer } from "./LeadNoteComposer.tsx";

interface LeadDetailNotesProps {
  readonly notes: readonly CrmLeadDetailNote[];
  readonly leadId: string;
  readonly canManageLeadNotes: boolean;
  readonly showComposer: boolean;
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailNotes({
  notes,
  leadId,
  canManageLeadNotes,
  showComposer,
}: LeadDetailNotesProps) {
  return (
    <section className="crm-surface p-5">
      <h2 className="text-sm font-semibold text-[var(--crm-text)]">
        Notes
      </h2>
      {notes.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--crm-muted)]">No notes recorded.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li
              key={note.id}
              className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--crm-text)]">{note.authorLabel}</span>
                <span className="text-xs text-[var(--crm-muted)]">
                  {formatTimestamp(note.createdAt)}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[var(--crm-text-secondary)]">{note.body}</p>
            </li>
          ))}
        </ul>
      )}

      {canManageLeadNotes && showComposer ? (
        <LeadNoteComposer leadId={leadId} />
      ) : null}
    </section>
  );
}
