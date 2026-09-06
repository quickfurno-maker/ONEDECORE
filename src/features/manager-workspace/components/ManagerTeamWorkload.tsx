import type {
  ManagerCrmSection,
  ManagerPanelState,
} from "../contracts/manager-dashboard.ts";
import {
  ManagerPanel,
  ManagerPanelEmpty,
  ManagerPanelUnavailable,
} from "./ManagerPanel.tsx";

/**
 * How this month's enquiries are spread across the team.
 *
 * WHAT THIS PANEL REFUSES TO BE
 *
 * A leaderboard. There is no conversion rate per person, no response time per
 * person, no "top performer" and no ordering by volume — sorting people by a
 * number invents a performance metric whether or not anybody calls it one, and
 * this dashboard was not asked for one. Rows are alphabetical.
 *
 * Unassigned is shown separately and prominently, because it is the only row
 * here that is a problem rather than a fact: an unowned enquiry is nobody's
 * workload.
 */
export function ManagerTeamWorkload({
  crm,
}: {
  readonly crm: ManagerPanelState<ManagerCrmSection>;
}) {
  if (crm.status !== "ready") {
    return (
      <ManagerPanel title="Team workload">
        <ManagerPanelUnavailable note={crm.note} />
      </ManagerPanel>
    );
  }

  const { workload, rangeLabel } = crm.data;

  return (
    <ManagerPanel
      title="Team workload"
      caption={`Enquiries by owner · ${rangeLabel}`}
    >
      {workload.unassigned ? (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <span className="text-sm font-semibold text-amber-200">
            Unassigned
          </span>
          <span className="font-serif text-lg font-bold tabular-nums text-amber-200">
            {workload.unassigned.leadCount}
          </span>
        </div>
      ) : null}

      {workload.members.length === 0 ? (
        <ManagerPanelEmpty message="No enquiries were assigned in this period." />
      ) : (
        <ul className="space-y-1">
          {workload.members.map((row) => (
            <li
              key={row.assigneeId ?? row.label}
              className="flex items-center justify-between gap-3 py-1.5"
            >
              <span className="truncate text-sm text-neutral-300">
                {row.label}
              </span>
              <span className="font-serif text-sm font-bold tabular-nums text-neutral-100">
                {row.leadCount}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-4 border-t border-neutral-800 pt-3 text-xs text-neutral-500">
        Assigned this period: {workload.assignedTotal}. Counts only — this panel
        does not rank people.
      </p>
    </ManagerPanel>
  );
}
