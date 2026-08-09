import type { LeaveRequestStatus } from "../contracts/dto.ts";

const STATUS_STYLES: Readonly<Record<LeaveRequestStatus, string>> = {
  pending: "bg-amber-950/70 text-amber-200 border-amber-900/60",
  approved: "bg-emerald-950/70 text-emerald-200 border-emerald-900/60",
  rejected: "bg-rose-950/70 text-rose-200 border-rose-900/60",
  cancelled: "bg-neutral-800 text-neutral-300 border-neutral-700",
};

interface LeaveStatusBadgeProps {
  readonly status: LeaveRequestStatus;
}

export function LeaveStatusBadge({ status }: LeaveStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
