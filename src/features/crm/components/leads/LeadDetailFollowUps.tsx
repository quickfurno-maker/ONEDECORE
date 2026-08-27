import type {
  CrmAssigneeDirectoryEntry,
  CrmLeadDetailFollowUp,
} from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import { LeadFollowUpActions } from "./LeadFollowUpActions.tsx";
import { LeadFollowUpComposer } from "./LeadFollowUpComposer.tsx";

interface LeadDetailFollowUpsProps {
  readonly leadId: string;
  readonly followUps: readonly CrmLeadDetailFollowUp[];
  readonly canManageLeadFollowUps: boolean;
  readonly canChooseFollowUpOwner: boolean;
  readonly showComposer: boolean;
  readonly assigneeDirectory: readonly CrmAssigneeDirectoryEntry[];
}

function formatTimestamp(value: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function LeadDetailFollowUps({
  leadId,
  followUps,
  canManageLeadFollowUps,
  canChooseFollowUpOwner,
  showComposer,
  assigneeDirectory,
}: LeadDetailFollowUpsProps) {
  return (
    <section className="crm-surface p-5">
      <h2 className="text-sm font-semibold text-[var(--crm-text)]">
        Follow-ups
      </h2>

      {canManageLeadFollowUps && showComposer ? (
        <LeadFollowUpComposer
          leadId={leadId}
          canChooseOwner={canChooseFollowUpOwner}
          assigneeDirectory={assigneeDirectory}
        />
      ) : null}

      {followUps.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--crm-muted)]">No follow-ups scheduled.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {followUps.map((followUp) => (
            <li
              key={followUp.id}
              className="rounded-md border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
              data-testid={`lead-follow-up-item-${followUp.id}`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--crm-text)]">
                  {followUp.ownerLabel}
                </span>
                <span className="text-xs text-[var(--crm-muted)]">
                  Due {formatTimestamp(followUp.dueAt)}
                </span>
              </div>
              <p className="mt-1 text-[var(--crm-muted)]">
                {formatCrmCodeLabel(followUp.status)}
                {followUp.outcome ? ` · ${followUp.outcome}` : ""}
              </p>
              {followUp.completedAt ? (
                <p className="mt-1 text-xs text-[var(--crm-muted)]">
                  Completed {formatTimestamp(followUp.completedAt)}
                </p>
              ) : null}
              {followUp.cancelledAt ? (
                <p className="mt-1 text-xs text-[var(--crm-muted)]">
                  Cancelled {formatTimestamp(followUp.cancelledAt)}
                </p>
              ) : null}

              {followUp.status === "open" ? (
                <LeadFollowUpActions
                  leadId={leadId}
                  followUpId={followUp.id}
                  canManageLeadFollowUps={canManageLeadFollowUps}
                />
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
