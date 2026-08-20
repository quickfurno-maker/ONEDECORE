import Link from "next/link";
import type { OpsAttentionItem } from "../types.ts";
import { DashboardPanel } from "./DashboardPanel.tsx";

const TONE = {
  urgent: "bg-[var(--od-danger)]",
  attention: "bg-[var(--od-warning)]",
  info: "bg-[var(--od-blue)]",
} as const;

export function NeedsAttentionPanel({ items }: { items: readonly OpsAttentionItem[] }) {
  return (
    <DashboardPanel title="Needs Attention" attention={items.length > 0}>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--od-muted)]">Nothing needs attention right now.</p>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-3">
              <span className={`mt-2 h-2 w-2 shrink-0 rounded-full ${TONE[item.tone]}`} />
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
