"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { LEAD_STAGE_CODES } from "../../contracts/lead-stages.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";
import type {
  CrmAssigneeDirectoryEntry,
  CrmLeadSourceOption,
} from "../../contracts/lead-detail-dtos.ts";
import type { LeadListQuery } from "../../contracts/lead-list-query.ts";

interface LeadListFiltersProps {
  readonly query: LeadListQuery;
  readonly sources: readonly CrmLeadSourceOption[];
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
  readonly showBroadFilters: boolean;
}

export function LeadListFilters({
  query,
  sources,
  assignees,
  showBroadFilters,
}: LeadListFiltersProps) {
  const formId = useId();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <section
      aria-labelledby={`${formId}-heading`}
      className="rounded-lg border border-neutral-800 bg-neutral-900/50"
    >
      <div className="flex items-center justify-between gap-3 border-b border-neutral-800 px-4 py-3">
        <h2 id={`${formId}-heading`} className="text-sm font-semibold text-neutral-100">
          Filters
        </h2>
        <button
          type="button"
          className="min-h-11 rounded-md border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 md:hidden"
          aria-expanded={mobileOpen}
          aria-controls={`${formId}-panel`}
          onClick={() => setMobileOpen((open) => !open)}
        >
          {mobileOpen ? "Hide filters" : "Show filters"}
        </button>
      </div>

      <form
        id={`${formId}-panel`}
        action="/admin/crm/leads"
        method="get"
        className={`grid gap-4 px-4 py-4 md:grid-cols-2 xl:grid-cols-4 ${mobileOpen ? "block" : "hidden md:grid"}`}
      >
        <div>
          <label htmlFor={`${formId}-q`} className="mb-1 block text-xs font-medium text-neutral-400">
            Search name or locality
          </label>
          <input
            id={`${formId}-q`}
            name="q"
            type="search"
            defaultValue={query.q ?? ""}
            maxLength={100}
            className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          />
        </div>

        <div>
          <label htmlFor={`${formId}-status`} className="mb-1 block text-xs font-medium text-neutral-400">
            Status
          </label>
          <select
            id={`${formId}-status`}
            name="status"
            defaultValue={query.status ?? ""}
            className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <option value="">All statuses</option>
            {LEAD_STAGE_CODES.map((status) => (
              <option key={status} value={status}>
                {formatCrmCodeLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor={`${formId}-source`} className="mb-1 block text-xs font-medium text-neutral-400">
            Source
          </label>
          <select
            id={`${formId}-source`}
            name="sourceId"
            defaultValue={query.sourceId ?? ""}
            className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <option value="">All sources</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.displayName}
              </option>
            ))}
          </select>
        </div>

        {showBroadFilters ? (
          <>
            <div>
              <label htmlFor={`${formId}-assignment`} className="mb-1 block text-xs font-medium text-neutral-400">
                Assignment
              </label>
              <select
                id={`${formId}-assignment`}
                name="assignment"
                defaultValue={query.assignment ?? ""}
                className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <option value="">All leads</option>
                <option value="assigned">Assigned</option>
                <option value="unassigned">Unassigned</option>
              </select>
            </div>

            <div>
              <label htmlFor={`${formId}-assignee`} className="mb-1 block text-xs font-medium text-neutral-400">
                Sales executive
              </label>
              <select
                id={`${formId}-assignee`}
                name="assigneeId"
                defaultValue={query.assigneeId ?? ""}
                className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
              >
                <option value="">All executives</option>
                {assignees.map((assignee) => (
                  <option key={assignee.userId} value={assignee.userId}>
                    {assignee.displayName}
                  </option>
                ))}
              </select>
            </div>
          </>
        ) : null}

        <div>
          <label htmlFor={`${formId}-follow-up`} className="mb-1 block text-xs font-medium text-neutral-400">
            Follow-up due
          </label>
          <select
            id={`${formId}-follow-up`}
            name="followUpDue"
            defaultValue={query.followUpDue ?? ""}
            className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 text-sm text-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            <option value="">Any</option>
            <option value="overdue">Overdue</option>
            <option value="today">Due today</option>
            <option value="upcoming">Upcoming</option>
          </select>
        </div>

        <div className="flex flex-wrap items-end gap-2 md:col-span-2 xl:col-span-4">
          <button
            type="submit"
            className="min-h-11 rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-neutral-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Apply filters
          </button>
          <Link
            href="/admin/crm/leads"
            className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
          >
            Reset
          </Link>
        </div>
      </form>
    </section>
  );
}
