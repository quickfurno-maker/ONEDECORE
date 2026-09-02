import {
  STAFF_ACCESS_STATE_LABELS,
  type StaffAccessStateCode,
  type StaffProfileStatusCode,
} from "../contracts/permissions.ts";

const STATUS_STYLES: Readonly<Record<StaffProfileStatusCode, string>> = {
  pending: "bg-amber-950/70 text-amber-200 border-amber-900/60",
  active: "bg-emerald-950/70 text-emerald-200 border-emerald-900/60",
  suspended: "bg-orange-950/70 text-orange-200 border-orange-900/60",
  disabled: "bg-neutral-800 text-neutral-300 border-neutral-700",
};

const STATUS_LABELS: Readonly<Record<StaffProfileStatusCode, string>> = {
  pending: "Pending",
  active: "Active",
  suspended: "Suspended",
  disabled: "Disabled",
};

interface StaffStatusBadgeProps {
  readonly status: StaffProfileStatusCode;
}

export function StaffStatusBadge({ status }: StaffStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}

const ACCESS_STYLES: Readonly<Record<StaffAccessStateCode, string>> = {
  not_activated: "bg-neutral-800 text-neutral-300 border-neutral-700",
  invited: "bg-sky-950/70 text-sky-200 border-sky-900/60",
  active: "bg-emerald-950/70 text-emerald-200 border-emerald-900/60",
};

/**
 * App/login access, shown alongside — never instead of — employment status.
 *
 * A staff member can be employed and operationally real while having no login
 * at all; "Not activated" is a normal state, not an invite failure.
 */
export function StaffAccessStateBadge({
  accessState,
}: {
  readonly accessState: StaffAccessStateCode;
}) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${ACCESS_STYLES[accessState]}`}
      title="App/login access is separate from employment status"
    >
      App access: {STAFF_ACCESS_STATE_LABELS[accessState]}
    </span>
  );
}
