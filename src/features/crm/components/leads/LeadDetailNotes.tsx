import { LeadNoteComposer } from "./LeadNoteComposer.tsx";

/**
 * CRM 2D-1 — note composer only (owner lock Q6).
 *
 * Note HISTORY now lives in the unified timeline, which reads `lead_notes`
 * directly and therefore renders the full body rather than the 120-char
 * `lead_activities.note.created` excerpt. Keeping a second history list here
 * would duplicate the chronological surface the timeline now owns.
 */

interface LeadDetailNotesProps {
  readonly leadId: string;
  readonly canManageLeadNotes: boolean;
  readonly showComposer: boolean;
}

export function LeadDetailNotes({
  leadId,
  canManageLeadNotes,
  showComposer,
}: LeadDetailNotesProps) {
  if (!canManageLeadNotes || !showComposer) {
    return null;
  }

  return (
    <section className="crm-surface p-3.5 sm:p-5" data-testid="crm-lead-notes">
      <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
        Add note
      </h2>
      <p className="mt-1 text-[11px] text-[var(--crm-muted)]">
        Saved notes appear in the timeline above.
      </p>
      <LeadNoteComposer leadId={leadId} />
    </section>
  );
}
