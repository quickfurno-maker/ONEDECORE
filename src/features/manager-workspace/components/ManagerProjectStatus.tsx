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
 * appear here. Nothing on this panel is a raw project row, and there is no
 * commercial detail, no evidence, no task list — a Sales Manager sees that a
 * project is in execution and who is running it, which is what "handed over"
 * means from the sales side.
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
      action={
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-neutral-500">
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Project
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Client
                </th>
                <th scope="col" className="pb-2 pr-3 font-medium">
                  Stage
                </th>
                <th scope="col" className="pb-2 font-medium">
                  Project manager
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {rows.map((row) => (
                <tr key={row.projectId}>
                  <td className="py-2 pr-3 font-medium text-neutral-100">
                    {row.projectNumber}
                  </td>
                  <td className="py-2 pr-3 text-neutral-300">
                    {row.clientLabel}
                  </td>
                  <td className="py-2 pr-3 text-neutral-400">
                    {row.stageLabel}
                  </td>
                  <td className="py-2 text-neutral-400">
                    {row.ownerLabel ?? "Not assigned"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ManagerPanel>
  );
}
