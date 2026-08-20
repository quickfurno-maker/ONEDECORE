"use client";

import Link from "next/link";
import { useId } from "react";
import { LEAD_STAGE_CODES } from "../../contracts/lead-stages.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import type {
  CrmAssigneeDirectoryEntry,
  CrmLeadSourceOption,
} from "../../contracts/lead-detail-dtos.ts";
import {
  buildLeadListHref,
  type LeadListQuery,
} from "../../contracts/lead-list-query.ts";

interface LeadListFiltersProps {
  readonly query: LeadListQuery;
  readonly sources: readonly CrmLeadSourceOption[];
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly showBroadFilters: boolean;
  readonly view: "table" | "pipeline";
}

function Chip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center rounded-full border border-[var(--od-border-strong)] px-3 text-xs text-[var(--od-text-2)] hover:text-[var(--od-text)]"
    >
      {label} ×
    </Link>
  );
}

export function LeadListFilters({
  query,
  sources,
  assignees,
  showBroadFilters,
  view,
}: LeadListFiltersProps) {
  const formId = useId();
  const selectClass =
    "min-h-10 rounded-[8px] border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm text-[var(--od-text)]";
  const sourceLabel = sources.find((source) => source.id === query.sourceId)?.displayName;
  const assigneeLabel = assignees.find((row) => row.userId === query.assigneeId)?.displayName;

  return (
    <section className="space-y-3" aria-labelledby={`${formId}-heading`}>
      <h2 id={`${formId}-heading`} className="sr-only">
        Filters
      </h2>
      <form
        action="/admin/crm/leads"
        method="get"
        className="flex flex-wrap items-center gap-2"
      >
        <input type="hidden" name="view" value={view} />
        <input
          id={`${formId}-q`}
          name="q"
          type="search"
          placeholder="Search leads..."
          defaultValue={query.q ?? ""}
          maxLength={100}
          className="min-h-10 min-w-[200px] flex-1 rounded-[8px] border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm"
        />
        <select id={`${formId}-status`} name="status" defaultValue={query.status ?? ""} className={selectClass}>
          <option value="">Status</option>
          {LEAD_STAGE_CODES.map((status) => (
            <option key={status} value={status}>
              {formatCrmCodeLabel(status.replaceAll("_", "-"))}
            </option>
          ))}
        </select>
        <select id={`${formId}-source`} name="sourceId" defaultValue={query.sourceId ?? ""} className={selectClass}>
          <option value="">Source</option>
          {sources.map((source) => (
            <option key={source.id} value={source.id}>
              {source.displayName}
            </option>
          ))}
        </select>
        {showBroadFilters ? (
          <>
            <select
              id={`${formId}-assignment`}
              name="assignment"
              defaultValue={query.assignment ?? ""}
              className={selectClass}
            >
              <option value="">Assignment</option>
              <option value="assigned">Assigned</option>
              <option value="unassigned">Unassigned</option>
            </select>
            <select
              id={`${formId}-assignee`}
              name="assigneeId"
              defaultValue={query.assigneeId ?? ""}
              className={selectClass}
            >
              <option value="">Assignee</option>
              {assignees.map((assignee) => (
                <option key={assignee.userId} value={assignee.userId}>
                  {assignee.displayName}
                </option>
              ))}
            </select>
          </>
        ) : null}
        <select
          id={`${formId}-follow-up`}
          name="followUpDue"
          defaultValue={query.followUpDue ?? ""}
          className={selectClass}
        >
          <option value="">Follow-up</option>
          <option value="overdue">Overdue</option>
          <option value="today">Due today</option>
          <option value="upcoming">Upcoming</option>
        </select>
        <button
          type="submit"
          className="min-h-10 rounded-[8px] bg-[var(--od-gold)] px-4 text-sm font-semibold text-[#1a1408]"
        >
          Apply
        </button>
        <Link
          href={view === "pipeline" ? "/admin/crm/leads?view=pipeline" : "/admin/crm/leads"}
          className="inline-flex min-h-10 items-center rounded-[8px] border border-[var(--od-border)] px-3 text-sm text-[var(--od-text-2)]"
        >
          Clear
        </Link>
      </form>
      <div className="flex flex-wrap gap-2">
        {query.q ? (
          <Chip label={`Search: ${query.q}`} href={buildLeadListHref(query, view, "q")} />
        ) : null}
        {query.status ? (
          <Chip
            label={formatCrmCodeLabel(query.status.replaceAll("_", "-"))}
            href={buildLeadListHref(query, view, "status")}
          />
        ) : null}
        {query.sourceId ? (
          <Chip
            label={sourceLabel ?? "Source"}
            href={buildLeadListHref(query, view, "sourceId")}
          />
        ) : null}
        {query.assignment ? (
          <Chip label={query.assignment} href={buildLeadListHref(query, view, "assignment")} />
        ) : null}
        {query.assigneeId ? (
          <Chip
            label={assigneeLabel ?? "Assignee"}
            href={buildLeadListHref(query, view, "assigneeId")}
          />
        ) : null}
        {query.followUpDue ? (
          <Chip label={query.followUpDue} href={buildLeadListHref(query, view, "followUpDue")} />
        ) : null}
      </div>
    </section>
  );
}
