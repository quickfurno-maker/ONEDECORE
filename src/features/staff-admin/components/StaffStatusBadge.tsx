import type { StaffProfileStatusCode } from "../contracts/permissions.ts";

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
