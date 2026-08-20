import Link from "next/link";
import { LeadStatusBadge } from "@/features/crm/components/leads/LeadStatusBadge.tsx";
import type { LeadStageCode } from "@/features/crm/contracts/lead-stages.ts";
import type { OpsRecentLead } from "../types.ts";
import { DashboardPanel } from "./DashboardPanel.tsx";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function RecentLeadsPanel({ leads }: { leads: readonly OpsRecentLead[] }) {
  return (
    <DashboardPanel
      title="Recent Leads"
      action={
        <Link href="/admin/crm/leads" className="text-xs font-medium text-[var(--od-gold)]">
          View all
        </Link>
      }
    >
      {leads.length === 0 ? (
        <p className="text-sm text-[var(--od-muted)]">No leads in your workspace yet.</p>
      ) : (
        <ul className="divide-y divide-[var(--od-border)]">
          {leads.map((lead) => (
            <li key={lead.id}>
              <Link
                href={`/admin/crm/leads/${lead.id}`}
                className="flex items-center gap-3 py-3 transition hover:bg-[var(--od-hover)]"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--od-elevated)] text-xs font-semibold">
                  {initials(lead.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{lead.name}</span>
                  <span className="block truncate text-xs text-[var(--od-muted)]">
                    {lead.requirement} · {lead.locality}
                  </span>
                </span>
                <LeadStatusBadge status={lead.status as LeadStageCode} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}
