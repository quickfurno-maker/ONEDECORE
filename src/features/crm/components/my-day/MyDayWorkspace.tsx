import Link from "next/link";
import type { ReactNode } from "react";
import type {
  MyDayAttentionRow,
  MyDaySnapshot,
  MyDayTaskRow,
} from "../../contracts/my-day-contracts.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import {
  formatMyDayLocalDateLabel,
  formatMyDayTimestamp,
} from "../../contracts/my-day-contracts.ts";
import type { CrmAssigneeDirectoryEntry } from "../../contracts/lead-detail-dtos.ts";
import { LeadStatusBadge } from "../leads/LeadStatusBadge.tsx";

interface MyDayWorkspaceProps {
  readonly snapshot: MyDaySnapshot;
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly canFilterOwner: boolean;
  readonly selectedOwnerId: string | null;
}

function SummaryChip({
  label,
  count,
  accent,
}: {
  readonly label: string;
  readonly count: number;
  readonly accent?: "risk" | "default" | "muted";
}) {
  const accentClass =
    accent === "risk"
      ? "border-red-900/40 bg-red-950/20 text-red-200"
      : accent === "muted"
        ? "border-[var(--od-border)] bg-[var(--od-surface)] text-[var(--od-muted)]"
        : "border-[var(--od-border)] bg-[var(--od-surface)] text-[var(--od-text)]";

  return (
    <div
      className={`rounded-[10px] border px-3 py-2 text-center ${accentClass}`}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{count}</p>
    </div>
  );
}

function TaskCard({
  task,
  showOwner,
}: {
  readonly task: MyDayTaskRow;
  readonly showOwner: boolean;
}) {
  return (
    <article className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--od-text)]">{task.title}</p>
          <p className="mt-1 text-xs text-[var(--od-muted)]">
            {task.leadDisplayLabel} · {formatCrmCodeLabel(task.activityType)}
          </p>
        </div>
        <LeadStatusBadge status={task.leadStatus} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--od-muted)]">
        <div>
          <dt className="font-medium">Due</dt>
          <dd className="mt-0.5 text-[var(--od-text-2)]">
            {formatMyDayTimestamp(task.dueAt)}
          </dd>
        </div>
        <div>
          <dt className="font-medium">Priority</dt>
          <dd className="mt-0.5 capitalize text-[var(--od-text-2)]">{task.priority}</dd>
        </div>
        {showOwner ? (
          <div className="col-span-2">
            <dt className="font-medium">Owner</dt>
            <dd className="mt-0.5 text-[var(--od-text-2)]">{task.ownerLabel}</dd>
          </div>
        ) : null}
      </dl>
      <Link
        href={`/admin/crm/leads/${task.leadId}`}
        className="mt-4 inline-flex min-h-10 items-center rounded-[8px] border border-[var(--od-border-strong)] px-3 text-sm font-medium text-[var(--od-text)] hover:bg-[var(--od-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
      >
        Open lead
      </Link>
    </article>
  );
}

function AttentionCard({ row }: { readonly row: MyDayAttentionRow }) {
  return (
    <article className="rounded-[12px] border border-[var(--od-border)] bg-[var(--od-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-[var(--od-text)]">
            {row.leadDisplayLabel}
          </p>
          <p className="mt-1 text-xs text-[var(--od-muted)]">
            Received {formatMyDayTimestamp(row.receivedAt)}
          </p>
        </div>
        <LeadStatusBadge status={row.leadStatus} />
      </div>
      {row.assigneeLabel ? (
        <p className="mt-2 text-xs text-[var(--od-muted)]">
          Assignee: <span className="text-[var(--od-text-2)]">{row.assigneeLabel}</span>
        </p>
      ) : null}
      {row.slaDueAt ? (
        <p className="mt-1 text-xs text-[var(--od-muted)]">
          SLA due:{" "}
          <span className="text-[var(--od-text-2)]">
            {formatMyDayTimestamp(row.slaDueAt)}
          </span>
        </p>
      ) : null}
      <Link
        href={`/admin/crm/leads/${row.leadId}`}
        className="mt-4 inline-flex min-h-10 items-center rounded-[8px] border border-[var(--od-border-strong)] px-3 text-sm font-medium text-[var(--od-text)] hover:bg-[var(--od-hover)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
      >
        Open lead
      </Link>
    </article>
  );
}

function SectionBlock({
  title,
  description,
  emptyMessage,
  accent,
  children,
}: {
  readonly title: string;
  readonly description?: string;
  readonly emptyMessage: string;
  readonly accent?: "risk" | "default" | "muted";
  readonly children: ReactNode | null;
}) {
  const titleClass =
    accent === "risk"
      ? "text-red-300"
      : accent === "muted"
        ? "text-[var(--od-muted)]"
        : "text-[var(--od-text)]";

  return (
    <section className="space-y-3">
      <div>
        <h2 className={`text-lg font-semibold ${titleClass}`}>{title}</h2>
        {description ? (
          <p className="mt-1 text-sm text-[var(--od-muted)]">{description}</p>
        ) : null}
      </div>
      {children ?? (
        <p className="rounded-[12px] border border-dashed border-[var(--od-border)] px-4 py-6 text-sm text-[var(--od-muted)]">
          {emptyMessage}
        </p>
      )}
    </section>
  );
}

export function MyDayWorkspace({
  snapshot,
  assignees,
  canFilterOwner,
  selectedOwnerId,
}: MyDayWorkspaceProps) {
  const showOwner = snapshot.isTeamScope || canFilterOwner;
  const dateLabel = formatMyDayLocalDateLabel(snapshot.localDate);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-[var(--od-muted)]">{dateLabel}</p>
          <p className="mt-1 text-xs text-[var(--od-muted)]">
            Times shown in Asia/Kolkata
          </p>
        </div>
        {canFilterOwner ? (
          <form
            method="get"
            className="flex min-w-[220px] flex-col gap-2 sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-xs text-[var(--od-muted)]">
              View
              <select
                name="owner"
                defaultValue={selectedOwnerId ?? "team"}
                className="mt-1 min-h-10 w-full rounded-[8px] border border-[var(--od-border)] bg-[var(--od-surface)] px-3 text-sm text-[var(--od-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
              >
                <option value="team">Team</option>
                {assignees.map((entry) => (
                  <option key={entry.userId} value={entry.userId}>
                    {entry.displayName}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="submit"
              className="inline-flex min-h-10 items-center justify-center rounded-[8px] bg-[var(--od-gold)] px-4 text-sm font-semibold text-[#1a1408] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)]"
            >
              Apply
            </button>
          </form>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
        <SummaryChip label="Overdue" count={snapshot.summary.overdue} accent="risk" />
        <SummaryChip label="Due today" count={snapshot.summary.dueToday} />
        <SummaryChip label="Upcoming" count={snapshot.summary.upcoming} accent="muted" />
        <SummaryChip label="No next action" count={snapshot.summary.noNextAction} />
        <SummaryChip label="Uncontacted" count={snapshot.summary.newUncontacted} />
        {snapshot.canViewManagerSections ? (
          <>
            <SummaryChip label="Unassigned" count={snapshot.summary.unassigned} />
            <SummaryChip label="SLA breaches" count={snapshot.summary.slaBreaches} accent="risk" />
          </>
        ) : null}
      </div>

      <SectionBlock
        title="Overdue"
        description="Primary next actions past due."
        emptyMessage="Nothing overdue."
        accent="risk"
      >
        {snapshot.tasks.overdue.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.tasks.overdue.map((task) => (
              <TaskCard key={task.activityId} task={task} showOwner={showOwner} />
            ))}
          </div>
        ) : null}
      </SectionBlock>

      <SectionBlock
        title="Due Today"
        description="Your working queue for today."
        emptyMessage="You're clear for today."
      >
        {snapshot.tasks.dueToday.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.tasks.dueToday.map((task) => (
              <TaskCard key={task.activityId} task={task} showOwner={showOwner} />
            ))}
          </div>
        ) : null}
      </SectionBlock>

      <SectionBlock
        title="Upcoming"
        description="Scheduled after today."
        emptyMessage="No upcoming primary actions."
        accent="muted"
      >
        {snapshot.tasks.upcoming.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.tasks.upcoming.map((task) => (
              <TaskCard key={task.activityId} task={task} showOwner={showOwner} />
            ))}
          </div>
        ) : null}
      </SectionBlock>

      <SectionBlock
        title="No Next Action"
        description="Assigned leads missing an open primary activity."
        emptyMessage="No leads are missing a next action."
      >
        {snapshot.attention.noNextAction.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.attention.noNextAction.map((row) => (
              <AttentionCard key={row.leadId} row={row} />
            ))}
          </div>
        ) : null}
      </SectionBlock>

      <SectionBlock
        title="New Uncontacted"
        description="Assigned leads with no first contact attempt recorded."
        emptyMessage="No new uncontacted leads."
      >
        {snapshot.attention.newUncontacted.length > 0 ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {snapshot.attention.newUncontacted.map((row) => (
              <AttentionCard key={row.leadId} row={row} />
            ))}
          </div>
        ) : null}
      </SectionBlock>

      {snapshot.canViewManagerSections ? (
        <>
          <SectionBlock
            title="Unassigned"
            description="Active leads waiting for an owner."
            emptyMessage="No unassigned leads in scope."
          >
            {snapshot.attention.unassigned.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.attention.unassigned.map((row) => (
                  <AttentionCard key={row.leadId} row={row} />
                ))}
              </div>
            ) : null}
          </SectionBlock>

          <SectionBlock
            title="SLA Breaches"
            description="First-contact SLA past due with no attempt recorded."
            emptyMessage="No SLA breaches."
            accent="risk"
          >
            {snapshot.attention.slaBreaches.length > 0 ? (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {snapshot.attention.slaBreaches.map((row) => (
                  <AttentionCard key={row.leadId} row={row} />
                ))}
              </div>
            ) : null}
          </SectionBlock>
        </>
      ) : null}
    </div>
  );
}
