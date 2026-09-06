import Link from "next/link";

import { formatMyDayTimestamp } from "@/features/crm/contracts/my-day-contracts.ts";
import type { ManagerExecutionSection } from "../contracts/manager-dashboard.ts";
import { ManagerPanel, ManagerPanelEmpty } from "./ManagerPanel.tsx";

/**
 * What is slipping, worst first.
 *
 * COUNTING HONESTLY
 *
 * The chips carry the read model's own per-reason counters, one by one. The
 * queue below them is de-duplicated by lead, because one enquiry that is both
 * unassigned AND uncontacted is one enquiry with two problems — listing it
 * twice would make the backlog look bigger than it is.
 *
 * Those two facts do not add up, and the panel does not pretend they do. The
 * sum of the counters is described as SIGNALS, never as a number of enquiries,
 * and the list is described as what it is: the highest-priority rows, bounded.
 * A unique-enquiry total is not offered at all — the upstream row arrays are
 * bounded independently, so any union over them would under-count.
 *
 * WHAT IS NOT HERE: no email address, no phone number, no message body, no
 * quotation value. The panel answers "which enquiry, whose, how late" and then
 * hands off to the lead itself, which enforces its own permissions.
 */
export function ManagerAttentionPanel({
  execution,
}: {
  readonly execution: ManagerExecutionSection;
}) {
  const { attention, attentionCategories, attentionSignalTotal } = execution;

  return (
    <ManagerPanel
      title="Needs attention"
      caption="Team priorities for today"
      headerLink={
        <Link
          href="/admin/crm/my-day"
          className="inline-flex min-h-11 items-center text-xs font-semibold uppercase tracking-wider text-amber-300 hover:text-amber-200"
        >
          Open My Day
        </Link>
      }
    >
      <ul className="mb-4 flex flex-wrap gap-2">
        {attentionCategories.map((category) => (
          <li
            key={category.reason}
            className="flex items-baseline gap-2 rounded-md border border-neutral-800 bg-neutral-900/60 px-2.5 py-1.5"
          >
            <span className="font-serif text-sm font-bold tabular-nums text-neutral-100">
              {category.count}
            </span>
            <span className="text-[11px] uppercase tracking-wider text-neutral-500">
              {category.label}
            </span>
          </li>
        ))}
      </ul>

      {attention.length === 0 ? (
        <ManagerPanelEmpty message="Nothing needs attention right now." />
      ) : (
        <ul className="divide-y divide-neutral-800">
          {attention.map((item) => (
            <li key={item.key} className="py-3 first:pt-0 last:pb-0">
              <Link
                href={item.href}
                className="flex min-h-11 flex-col gap-1 rounded-md transition-colors hover:bg-neutral-900/60"
              >
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-neutral-100">
                    {item.leadLabel}
                  </span>
                  <span className="rounded border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-300">
                    {item.reasonLabel}
                  </span>
                </span>
                <span className="text-xs text-neutral-500">
                  {item.stageLabel} · {item.assigneeLabel ?? "Unassigned"} ·{" "}
                  {item.occurredLabel} {formatMyDayTimestamp(item.occurredAt)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {attentionSignalTotal > 0 ? (
        <p className="mt-3 text-xs text-neutral-500">
          {attention.length > 0
            ? `Showing ${attention.length} highest-priority ${
                attention.length === 1 ? "enquiry" : "enquiries"
              }. `
            : ""}
          {attentionSignalTotal} attention{" "}
          {attentionSignalTotal === 1 ? "signal" : "signals"} across the team —
          one enquiry can raise more than one.
        </p>
      ) : null}
    </ManagerPanel>
  );
}
