import Link from "next/link";
import type { OpsActivityItem } from "../types.ts";
import { DashboardPanel } from "./DashboardPanel.tsx";
import { OpsIcon } from "./OpsIcon.tsx";

function formatAge(iso: string): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ActivityFeed({ items }: { items: readonly OpsActivityItem[] }) {
  return (
    <DashboardPanel title="Recent Lead Activity">
      {items.length === 0 ? (
        <p className="text-sm text-[var(--od-muted)]">No recent lead activity in your scope.</p>
      ) : (
        <ol className="relative space-y-4 border-l border-[var(--od-border)] pl-4">
          {items.map((item) => (
            <li key={item.id} className="relative">
              <span className="absolute -left-[23px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--od-gold)]/15 text-[var(--od-gold)]">
                <OpsIcon name="leads" className="h-3 w-3" />
              </span>
              <Link href={item.href} className="block hover:text-[var(--od-gold)]">
                <p className="text-sm font-medium text-[var(--od-text)]">{item.title}</p>
                <p className="text-xs text-[var(--od-muted)]">{item.detail}</p>
                <p className="mt-1 text-[11px] text-[var(--od-muted)]">{formatAge(item.occurredAt)}</p>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </DashboardPanel>
  );
}
