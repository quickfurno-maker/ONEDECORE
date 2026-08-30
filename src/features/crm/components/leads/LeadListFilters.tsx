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
}

function Chip({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="inline-flex min-h-8 items-center rounded-full border border-[var(--crm-border)] bg-[var(--crm-surface)] px-2.5 text-[11px] text-[var(--crm-text-secondary)] hover:border-[var(--crm-border-strong)] hover:text-[var(--crm-text)]"
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
}: LeadListFiltersProps) {
  const formId = useId();
  const selectClass = "crm-select min-h-11 w-full sm:w-auto";
  const filterQuery = query;
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
        className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center"
      >
        <input
          id={`${formId}-q`}
          name="q"
          type="search"
          placeholder="Search leads..."
          aria-label="Search leads"
          defaultValue={query.q ?? ""}
          maxLength={100}
          className="crm-input min-h-11 w-full flex-1 sm:min-w-[220px]"
        />
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <select
            id={`${formId}-status`}
            name="status"
            defaultValue={query.status ?? ""}
            aria-label="Filter by status"
            className={selectClass}
          >
            <option value="">Status</option>
            {LEAD_STAGE_CODES.map((status) => (
              <option key={status} value={status}>
                {formatCrmCodeLabel(status.replaceAll("_", "-"))}
              </option>
            ))}
          </select>
          <select
            id={`${formId}-source`}
            name="sourceId"
            defaultValue={query.sourceId ?? ""}
            aria-label="Filter by source"
            className={selectClass}
          >
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
                aria-label="Filter by assignment"
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
                aria-label="Filter by assignee"
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
            aria-label="Filter by follow-up due"
            className={selectClass}
          >
            <option value="">Follow-up</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="crm-btn crm-btn-primary min-h-11 flex-1 sm:flex-none">
            Apply
          </button>
          <Link
            href="/admin/crm/leads"
            className="crm-btn crm-btn-ghost min-h-11 flex-1 sm:flex-none"
          >
            Clear
          </Link>
        </div>
      </form>
      <div className="flex flex-wrap gap-1.5">
        {filterQuery.q ? (
          <Chip label={`Search: ${filterQuery.q}`} href={buildLeadListHref(filterQuery, "q")} />
        ) : null}
        {filterQuery.status ? (
          <Chip
            label={formatCrmCodeLabel(filterQuery.status.replaceAll("_", "-"))}
            href={buildLeadListHref(filterQuery, "status")}
          />
        ) : null}
        {filterQuery.sourceId ? (
          <Chip
            label={sourceLabel ?? "Source"}
            href={buildLeadListHref(filterQuery, "sourceId")}
          />
        ) : null}
        {filterQuery.assignment ? (
          <Chip label={filterQuery.assignment} href={buildLeadListHref(filterQuery, "assignment")} />
        ) : null}
        {filterQuery.assigneeId ? (
          <Chip
            label={assigneeLabel ?? "Assignee"}
            href={buildLeadListHref(filterQuery, "assigneeId")}
          />
        ) : null}
        {filterQuery.followUpDue ? (
          <Chip label={filterQuery.followUpDue} href={buildLeadListHref(filterQuery, "followUpDue")} />
        ) : null}
      </div>
    </section>
  );
}
