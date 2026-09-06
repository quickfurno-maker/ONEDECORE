import {
  MANAGER_NOT_CONFIGURED_LABEL,
  formatManagerAttainment,
  formatManagerCount,
  formatManagerPaise,
  type ManagerTargetAttainment,
} from "../contracts/manager-dashboard.ts";

/**
 * Target attainment for the period, or an honest statement that there is none.
 *
 * Three different absences pass through here and none of them is zero:
 *
 *   no target row          nobody configured one — "Not configured".
 *   `achievedPaise` null   accepted-quotation truth is not readable by this
 *                          caller — "Unavailable", never ₹0.
 *   attainment null        the target has no denominator — "No data", never 0%.
 */
export function ManagerTargetCard({
  target,
}: {
  readonly target: ManagerTargetAttainment | null;
}) {
  if (!target) {
    return (
      <div className="rounded-lg border border-dashed border-neutral-800 px-3 py-4">
        <p className="text-sm font-semibold text-neutral-300">
          Monthly target — {MANAGER_NOT_CONFIGURED_LABEL}
        </p>
        <p className="mt-1 text-xs text-neutral-500">
          No sales target has been set for this period.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-neutral-800 px-3 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-neutral-200">{target.label}</p>
        <p className="font-serif text-xl font-bold tabular-nums text-amber-300">
          {formatManagerAttainment(target.attainmentBasisPoints)}
        </p>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div>
          <dt className="text-neutral-500">Target</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-200">
            {formatManagerPaise(target.revenueTargetPaise)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Achieved</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-200">
            {formatManagerPaise(target.achievedPaise)}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Closed-Won target</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-200">
            {target.closedWonCountTarget}
          </dd>
        </div>
        <div>
          <dt className="text-neutral-500">Accepted</dt>
          <dd className="mt-0.5 font-semibold tabular-nums text-neutral-200">
            {formatManagerCount(target.acceptedCount)}
          </dd>
        </div>
      </dl>
    </div>
  );
}
