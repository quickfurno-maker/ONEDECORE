import {
  formatBasisPointsPercent,
  formatDurationFromSeconds,
} from "@/features/crm/contracts/management-analytics-contracts.ts";
import {
  MANAGER_NO_DATA_LABEL,
  type ManagerCrmSection,
  type ManagerManagementSection,
  type ManagerPanelState,
} from "../contracts/manager-dashboard.ts";
import {
  ManagerPanel,
  ManagerPanelUnavailable,
} from "./ManagerPanel.tsx";
import { ManagerTargetCard } from "./ManagerTargetCard.tsx";

function Stat({
  label,
  value,
  detail,
}: {
  readonly label: string;
  readonly value: string;
  readonly detail: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 font-serif text-lg font-bold tabular-nums text-neutral-100">
        {value}
      </dd>
      <p className="mt-0.5 text-xs text-neutral-500">{detail}</p>
    </div>
  );
}

/**
 * This month's sales position: volume, outcome, promise-keeping, and target.
 *
 * The two halves fail independently. Reporting supplies the counts; management
 * analytics supplies the rates and the target. Losing one does not blank the
 * other, and neither one is allowed to render as zero when it is simply not
 * readable — `formatBasisPointsPercent(null)` is `No data`, not `0%`.
 */
export function ManagerSalesPerformance({
  crm,
  management,
}: {
  readonly crm: ManagerPanelState<ManagerCrmSection>;
  readonly management: ManagerPanelState<ManagerManagementSection>;
}) {
  const caption =
    crm.status === "ready" ? crm.data.rangeLabel : "This month (IST)";

  return (
    <ManagerPanel title="Sales performance" caption={caption}>
      {crm.status === "ready" ? (
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label="Enquiries"
            value={String(crm.data.totalLeads)}
            detail="Received in period"
          />
          <Stat
            label="Closed-Won"
            value={String(crm.data.closedWonCount)}
            detail="Won in period"
          />
          <Stat
            label="Closed-Lost"
            value={String(crm.data.closedLostCount)}
            detail="Lost in period"
          />
          <Stat
            label="Open follow-ups"
            value={String(crm.data.openFollowUps)}
            detail={`${crm.data.overdueFollowUps} overdue`}
          />
        </dl>
      ) : (
        <ManagerPanelUnavailable note={crm.note} />
      )}

      <div className="mt-5 border-t border-neutral-800 pt-4">
        {management.status === "ready" ? (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Stat
                label="SLA compliance"
                value={formatBasisPointsPercent(
                  management.data.slaComplianceBasisPoints,
                  MANAGER_NO_DATA_LABEL
                )}
                detail={`${management.data.slaBreachedCount} breached of ${management.data.slaDecidedCount} decided`}
              />
              <Stat
                label="Won rate"
                value={formatBasisPointsPercent(
                  management.data.wonRateBasisPoints,
                  MANAGER_NO_DATA_LABEL
                )}
                detail={`${management.data.receivedCount} received in period`}
              />
              <Stat
                label="Median first contact"
                value={formatDurationFromSeconds(
                  management.data.medianFirstContactSeconds,
                  MANAGER_NO_DATA_LABEL
                )}
                detail="Enquiry to first attempt"
              />
            </dl>
            <div className="mt-4">
              <ManagerTargetCard target={management.data.target} />
            </div>
          </>
        ) : (
          <ManagerPanelUnavailable note={management.note} />
        )}
      </div>
    </ManagerPanel>
  );
}
