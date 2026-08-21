import Link from "next/link";
import type { OpsTargetCard } from "../types.ts";
import { DashboardPanel } from "./DashboardPanel.tsx";

export function TargetPanel({ target }: { target: OpsTargetCard | null }) {
  return (
    <DashboardPanel
      title="Sales Target"
      action={
        <Link href="/admin/crm/targets" className="text-xs font-medium text-[var(--od-gold)]">
          Open
        </Link>
      }
    >
      {target ? (
        <div>
          <p className="text-xs uppercase tracking-wide text-[var(--od-muted)]">{target.month}</p>
          <p className="mt-2 text-[28px] font-semibold text-[var(--od-gold)]">{target.revenueLabel}</p>
          <p className="mt-1 text-sm text-[var(--od-text-2)]">
            Closed-won count target: {target.closedWonCountTarget}
          </p>
          <p className="mt-3 text-xs text-[var(--od-muted)]">{target.notice}</p>
        </div>
      ) : (
        <p className="text-sm text-[var(--od-muted)]">
          No configured sales target is visible, or reporting achievement is not activated.
        </p>
      )}
    </DashboardPanel>
  );
}
