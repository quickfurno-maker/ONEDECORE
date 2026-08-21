import Link from "next/link";
import { OpsIcon } from "./OpsIcon.tsx";
import type { OpsAttentionItem } from "../types.ts";
import { DashboardPanel } from "./DashboardPanel.tsx";

export function NeedsAttentionPanel({ items }: { items: readonly OpsAttentionItem[] }) {
  return (
    <DashboardPanel title="Needs Attention" attention={items.length > 0}>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--od-muted)]">Nothing needs attention right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.tone === "urgent" ? "bg-[var(--od-danger)]/15 text-[var(--od-danger)]" : "bg-[var(--od-warning)]/15 text-[var(--od-warning)]"}`}>
                <OpsIcon name={item.tone === "urgent" ? "alert" : "clock"} className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--od-text)]">{item.title}</p>
                <p className="text-xs text-[var(--od-muted)]">{item.detail}</p>
              </div>
              <Link
                href={item.href}
                className="inline-flex min-h-9 items-center rounded-[8px] border border-[var(--od-gold)]/40 px-3 text-xs font-medium text-[var(--od-gold)]"
              >
                {item.actionLabel}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
