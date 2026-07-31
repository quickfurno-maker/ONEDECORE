import type { LeadStageCode } from "../../contracts/lead-stages.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

const STATUS_STYLES: Readonly<Record<LeadStageCode, string>> = {
  new: "bg-sky-950/70 text-sky-200 border-sky-900/60",
  assigned: "bg-indigo-950/70 text-indigo-200 border-indigo-900/60",
  contacted: "bg-cyan-950/70 text-cyan-200 border-cyan-900/60",
  qualified: "bg-emerald-950/70 text-emerald-200 border-emerald-900/60",
  consultation_scheduled:
    "bg-teal-950/70 text-teal-200 border-teal-900/60",
  proposal_sent: "bg-violet-950/70 text-violet-200 border-violet-900/60",
  negotiation: "bg-amber-950/70 text-amber-200 border-amber-900/60",
  closed_won: "bg-green-950/70 text-green-200 border-green-900/60",
  closed_lost: "bg-rose-950/70 text-rose-200 border-rose-900/60",
  on_hold: "bg-neutral-800 text-neutral-200 border-neutral-700",
};

interface LeadStatusBadgeProps {
  readonly status: LeadStageCode;
}

export function LeadStatusBadge({ status }: LeadStatusBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${STATUS_STYLES[status]}`}
    >
      {formatCrmCodeLabel(status)}
    </span>
  );
}
