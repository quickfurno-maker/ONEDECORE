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

function PrimaryMetric({
  label,
  count,
  tone,
}: {
  readonly label: string;
  readonly count: number;
  readonly tone: "danger" | "info" | "warning";
}) {
  const toneClass =
    tone === "danger"
      ? count > 0
        ? "text-[var(--crm-danger)]"
        : "text-[var(--crm-text)]"
      : tone === "warning"
        ? "text-[var(--crm-warning)]"
        : "text-[var(--crm-primary)]";
  const barClass =
    tone === "danger"
      ? count > 0
        ? "bg-[var(--crm-danger)]"
        : "bg-[var(--crm-border-strong)]"
      : tone === "warning"
        ? "bg-[var(--crm-warning)]"
        : "bg-[var(--crm-info)]";

  return (
    <div className="crm-surface relative overflow-hidden rounded-[14px] px-3.5 py-3 sm:rounded-[var(--crm-radius)] sm:px-4 sm:py-3.5">
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${barClass}`} />
      <p className="text-[12px] font-medium text-[var(--crm-muted)]">{label}</p>
      <p className={`mt-0.5 text-[24px] font-semibold tabular-nums tracking-tight sm:text-[28px] ${toneClass}`}>
        {count}
      </p>
    </div>
  );
}

function SecondaryMetric({
  label,
  count,
}: {
  readonly label: string;
  readonly count: number;
}) {
  return (
    <div className="rounded-[12px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 sm:rounded-[8px]">
      <p className="text-[11px] text-[var(--crm-muted)]">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold tabular-nums text-[var(--crm-text)] sm:text-base">
        {count}
      </p>
    </div>
  );
}

function TaskRow({
  task,
  showOwner,
}: {
  readonly task: MyDayTaskRow;
  readonly showOwner: boolean;
}) {
  return (
    <Link
      href={`/admin/crm/leads/${task.leadId}`}
      className="crm-row group flex min-h-12 items-center gap-2.5 border-b border-[var(--crm-border)] px-3 py-2.5 last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--crm-primary)] sm:min-h-14 sm:gap-3 sm:px-4 sm:py-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[var(--crm-text)]">
            {task.leadDisplayLabel}
          </p>
          <LeadStatusBadge status={task.leadStatus} />
        </div>
        <p className="mt-0.5 truncate text-[13px] text-[var(--crm-text-secondary)]">
          {task.title}
          <span className="text-[var(--crm-muted)]">
            {" "}
            · {formatCrmCodeLabel(task.activityType)}
          </span>
        </p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-[var(--crm-muted)] sm:hidden">
          <span>{formatMyDayTimestamp(task.dueAt)}</span>
          {showOwner ? <span>{task.ownerLabel}</span> : null}
        </p>
      </div>
      <div className="hidden shrink-0 items-center gap-6 text-[12px] text-[var(--crm-muted)] sm:flex">
        <span className="w-36 text-right text-[var(--crm-text-secondary)]">
          {formatMyDayTimestamp(task.dueAt)}
        </span>
        {showOwner ? (
          <span className="w-28 truncate text-right">{task.ownerLabel}</span>
        ) : null}
      </div>
      <span
        aria-hidden
        className="shrink-0 text-[var(--crm-muted)] transition group-hover:text-[var(--crm-primary)]"
      >
        ›
      </span>
    </Link>
  );
}

function AttentionRow({
  row,
  reason,
}: {
  readonly row: MyDayAttentionRow;
  readonly reason: string;
}) {
  return (
    <Link
      href={`/admin/crm/leads/${row.leadId}`}
      className="crm-row group flex min-h-12 items-center gap-2.5 border-b border-[var(--crm-border)] px-3 py-2.5 last:border-b-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--crm-primary)] sm:min-h-14 sm:gap-3 sm:px-4 sm:py-3"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="truncate text-sm font-semibold text-[var(--crm-text)]">
            {row.leadDisplayLabel}
          </p>
          <LeadStatusBadge status={row.leadStatus} />
        </div>
        <p className="mt-0.5 text-[13px] text-[var(--crm-text-secondary)]">{reason}</p>
        <p className="mt-1 flex flex-wrap gap-x-3 text-[12px] text-[var(--crm-muted)]">
          <span>Received {formatMyDayTimestamp(row.receivedAt)}</span>
          {row.assigneeLabel ? <span>{row.assigneeLabel}</span> : null}
          {row.slaDueAt ? (
            <span>SLA {formatMyDayTimestamp(row.slaDueAt)}</span>
          ) : null}
        </p>
      </div>
      <span
        aria-hidden
        className="shrink-0 text-[var(--crm-muted)] transition group-hover:text-[var(--crm-primary)]"
      >
        ›
      </span>
    </Link>
  );
}

function TaskSection({
  title,
  emptyMessage,
  accent,
  children,
}: {
  readonly title: string;
  readonly emptyMessage: string;
  readonly accent?: "risk" | "default" | "muted";
  readonly children: ReactNode | null;
}) {
  const titleClass =
    accent === "risk"
      ? "text-[var(--crm-danger)]"
      : accent === "muted"
        ? "text-[var(--crm-muted)]"
        : "text-[var(--crm-text)]";

  return (
    <section className="space-y-2">
      <h2 className={`text-base font-semibold ${titleClass}`}>{title}</h2>
      <div className="crm-surface overflow-hidden">
        {children ?? (
          <p className="px-4 py-3 text-sm text-[var(--crm-muted)]">{emptyMessage}</p>
        )}
      </div>
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

  const attentionBlocks: Array<{
    key: string;
    reason: string;
    rows: readonly MyDayAttentionRow[];
  }> = [
    {
      key: "no-next",
      reason: "No Next Action",
      rows: snapshot.attention.noNextAction,
    },
    {
      key: "uncontacted",
      reason: "New Uncontacted",
      rows: snapshot.attention.newUncontacted,
    },
  ];

  if (snapshot.canViewManagerSections) {
    attentionBlocks.push(
      {
        key: "unassigned",
        reason: "Unassigned",
        rows: snapshot.attention.unassigned,
      },
      {
        key: "sla",
        reason: "SLA Breaches",
        rows: snapshot.attention.slaBreaches,
      }
    );
  }

  const attentionRows = attentionBlocks.flatMap((block) =>
    block.rows.map((row) => ({
      key: `${block.key}-${row.leadId}`,
      reason: block.reason,
      row,
    }))
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--crm-text-secondary)]">{dateLabel}</p>
          <p className="mt-0.5 text-[11px] text-[var(--crm-muted)]">
            Times shown in Asia/Kolkata
          </p>
        </div>
        {canFilterOwner ? (
          <form
            method="get"
            className="flex min-w-[220px] flex-col gap-2 sm:flex-row sm:items-end"
          >
            <label className="flex-1 text-xs text-[var(--crm-muted)]">
              View
              <select
                name="owner"
                defaultValue={selectedOwnerId ?? "team"}
                className="crm-select mt-1 w-full"
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
              className="crm-btn crm-btn-primary min-h-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
            >
              Apply
            </button>
          </form>
        ) : null}
      </div>

      <div
        className={`grid grid-cols-2 gap-2.5 ${
          snapshot.canViewManagerSections
            ? "md:grid-cols-2 lg:grid-cols-3"
            : "md:grid-cols-2"
        }`}
      >
        <PrimaryMetric label="Overdue" count={snapshot.summary.overdue} tone="danger" />
        <PrimaryMetric label="Due Today" count={snapshot.summary.dueToday} tone="info" />
        {snapshot.canViewManagerSections ? (
          <PrimaryMetric
            label="Unassigned"
            count={snapshot.summary.unassigned}
            tone="warning"
          />
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-4">
        <SecondaryMetric label="Upcoming" count={snapshot.summary.upcoming} />
        <SecondaryMetric label="No Next Action" count={snapshot.summary.noNextAction} />
        <SecondaryMetric label="New Uncontacted" count={snapshot.summary.newUncontacted} />
        {snapshot.canViewManagerSections ? (
          <SecondaryMetric label="SLA Breaches" count={snapshot.summary.slaBreaches} />
        ) : null}
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold text-[var(--crm-text)]">Needs attention</h2>
        <div className="crm-surface overflow-hidden">
          {attentionRows.length > 0 ? (
            attentionRows.map((item) => (
              <AttentionRow key={item.key} row={item.row} reason={item.reason} />
            ))
          ) : (
            <p className="px-4 py-3 text-sm text-[var(--crm-muted)]">
              No attention items right now.
            </p>
          )}
        </div>
      </section>

      <TaskSection
        title="Overdue"
        emptyMessage="Nothing overdue."
        accent="risk"
      >
        {snapshot.tasks.overdue.length > 0 ? (
          <div>
            {snapshot.tasks.overdue.map((task) => (
              <TaskRow key={task.activityId} task={task} showOwner={showOwner} />
            ))}
          </div>
        ) : null}
      </TaskSection>

      <TaskSection title="Due Today" emptyMessage="You're clear for today.">
        {snapshot.tasks.dueToday.length > 0 ? (
          <div>
            {snapshot.tasks.dueToday.map((task) => (
              <TaskRow key={task.activityId} task={task} showOwner={showOwner} />
            ))}
          </div>
        ) : null}
      </TaskSection>

      <TaskSection
        title="Upcoming"
        emptyMessage="No upcoming primary actions."
        accent="muted"
      >
        {snapshot.tasks.upcoming.length > 0 ? (
          <div>
            {snapshot.tasks.upcoming.map((task) => (
              <TaskRow key={task.activityId} task={task} showOwner={showOwner} />
            ))}
          </div>
        ) : null}
      </TaskSection>
    </div>
  );
}
