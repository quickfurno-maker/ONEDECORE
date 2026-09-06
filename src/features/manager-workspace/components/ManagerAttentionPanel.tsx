import Link from "next/link";

import { formatMyDayTimestamp } from "@/features/crm/contracts/my-day-contracts.ts";
import type { ManagerExecutionSection } from "../contracts/manager-dashboard.ts";
import { ManagerPanel, ManagerPanelEmpty } from "./ManagerPanel.tsx";

/**
 * What is slipping, worst first.
 *
 * WHAT IS NOT HERE: no email address, no phone number, no message body, no
 * quotation value. The panel answers "which enquiry, whose, how late" and then
 * hands off to the lead itself, which enforces its own permissions. A dashboard
 * that renders contact details is a dashboard that leaks them to every screen
 * left open in an office.
 *
 * The list is bounded. The count above it is not — it comes from the read
 * model's own counters, so a manager sees the size of the backlog even when
 * only the first few rows are drawn.
 */
export function ManagerAttentionPanel({
  execution,
}: {
  readonly execution: ManagerExecutionSection;
}) {
  const { attention, attentionTotal } = execution;

  return (
    <ManagerPanel
      title="Needs attention"
      caption={
        attentionTotal === 0
          ? "Nothing is overdue or unowned."
          : `${attentionTotal} enquir${attentionTotal === 1 ? "y" : "ies"} need a decision`
      }
      action={
        <Link
          href="/admin/crm/leads"
          className="inline-flex min-h-11 items-center text-xs font-semibold uppercase tracking-wider text-amber-300 hover:text-amber-200"
        >
          Open enquiries
        </Link>
      }
    >
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

      {attentionTotal > attention.length ? (
        <p className="mt-3 text-xs text-neutral-500">
          Showing {attention.length} of {attentionTotal}.
        </p>
      ) : null}
    </ManagerPanel>
  );
}
