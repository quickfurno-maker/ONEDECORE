import Link from "next/link";

import type {
  ManagerPanelState,
  ManagerProjectsSection,
} from "../contracts/manager-dashboard.ts";
import {
  ManagerPanel,
  ManagerPanelEmpty,
  ManagerPanelUnavailable,
} from "./ManagerPanel.tsx";

/**
 * Where the live projects have reached — status, not the project workspace.
 *
 * The rows come from the dedicated high-level read model, which enumerates its
 * own field set in SQL: a column added to `public.projects` tomorrow does not
 * appear here. The manager sees the status, the design and execution phases,
 * and who currently holds the Project Manager and Lead Designer roles — which
 * is what "handed over" means from the sales side.
 *
 * Nothing on this panel is a raw project row. No commercial value, no
 * quotation, no evidence, no events, no assignment history, no deliverables,
 * no execution log, no snags — and no controls: every cell is a fact, and the
 * only interaction is a link to the detail route, which serves this role the
 * high-level view and nothing more.
 */
export function ManagerProjectStatus({
  projects,
}: {
  readonly projects: ManagerPanelState<ManagerProjectsSection>;
}) {
  if (projects.status !== "ready") {
    return (
      <ManagerPanel title="Project status">
        <ManagerPanelUnavailable note={projects.note} />
      </ManagerPanel>
    );
  }

  const { rows, totalCount } = projects.data;

  return (
    <ManagerPanel
      title="Project status"
      caption={
        totalCount === 0
          ? "No projects have been handed over yet."
          : `${rows.length} of ${totalCount} most recently updated`
      }
      headerLink={
        <Link
          href="/admin/projects"
          className="inline-flex min-h-11 items-center text-xs font-semibold uppercase tracking-wider text-amber-300 hover:text-amber-200"
        >
          All projects
        </Link>
      }
    >
      {rows.length === 0 ? (
        <ManagerPanelEmpty message="Nothing to show yet." />
      ) : (
        <>
          {/* Narrow screens: one card per project, nothing to scroll sideways. */}
          <ul className="space-y-3 md:hidden">
            {rows.map((row) => (
              <li
                key={row.projectId}
                className="rounded-lg border border-neutral-800 px-3 py-3"
              >
                <Link
                  href={row.href}
                  className="flex min-h-11 flex-col justify-center"
                >
                  <span className="flex flex-wrap items-baseline gap-2">
                    <span className="text-sm font-semibold text-neutral-100">
                      {row.projectNumber}
                    </span>
                    <span className="text-xs text-neutral-400">
                      {row.clientLabel}
                    </span>
                  </span>
                  <span className="mt-0.5 text-xs text-amber-300">
                    {row.statusLabel}
                  </span>
                </Link>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                  <div>
                    <dt className="text-neutral-600">Design</dt>
                    <dd className="text-neutral-300">{row.designStateLabel}</dd>
                  </div>
                  <div>
                    <dt className="text-neutral-600">Execution</dt>
                    <dd className="text-neutral-300">
                      {row.executionStateLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-600">Project manager</dt>
                    <dd className="text-neutral-300">
                      {row.projectManagerLabel}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-neutral-600">Lead designer</dt>
                    <dd className="text-neutral-300">{row.leadDesignerLabel}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Wider screens: the table, scrolling inside its own container. */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[44rem] text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-neutral-500">
                  <th scope="col" className="pb-2 pr-3 font-medium">
                    Project
                  </th>
                  <th scope="col" className="pb-2 pr-3 font-medium">
                    Client
                  </th>
                  <th scope="col" className="pb-2 pr-3 font-medium">
                    Status
                  </th>
                  <th scope="col" className="pb-2 pr-3 font-medium">
                    Design
                  </th>
                  <th scope="col" className="pb-2 pr-3 font-medium">
                    Execution
                  </th>
                  <th scope="col" className="pb-2 pr-3 font-medium">
                    Project manager
                  </th>
                  <th scope="col" className="pb-2 font-medium">
                    Lead designer
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800">
                {rows.map((row) => (
                  <tr key={row.projectId}>
                    <td className="py-2 pr-3 font-medium text-neutral-100">
                      <Link href={row.href} className="hover:text-amber-300">
                        {row.projectNumber}
                      </Link>
                    </td>
                    <td className="py-2 pr-3 text-neutral-300">
                      {row.clientLabel}
                    </td>
                    <td className="py-2 pr-3 text-neutral-300">
                      {row.statusLabel}
                    </td>
                    <td className="py-2 pr-3 text-neutral-400">
                      {row.designStateLabel}
                    </td>
                    <td className="py-2 pr-3 text-neutral-400">
                      {row.executionStateLabel}
                    </td>
                    <td className="py-2 pr-3 text-neutral-400">
                      {row.projectManagerLabel}
                    </td>
                    <td className="py-2 text-neutral-400">
                      {row.leadDesignerLabel}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </ManagerPanel>
  );
}
