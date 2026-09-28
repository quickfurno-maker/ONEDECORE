import Link from "next/link";
import { OpsIcon, type OpsIconName } from "@/features/admin-ops/components/OpsIcon.tsx";
import type { CrmExecutiveSummary } from "../../server/crm-executive-summary.ts";

type Tone = "gold" | "danger" | "warning" | "info" | "positive" | "neutral";

interface ExecutiveMetric {
  readonly id: string;
  readonly label: string;
  readonly value: number | null;
  readonly href: string;
  readonly tone: Tone;
  readonly icon: OpsIconName;
}

function displayValue(value: number | null): string {
  return value === null ? "—" : new Intl.NumberFormat("en-IN").format(value);
}

export function CrmExecutiveBar({ summary }: { readonly summary: CrmExecutiveSummary }) {
  const metrics: readonly ExecutiveMetric[] = [
    {
      id: "new",
      label: "New",
      value: summary.newLeads,
      href: "/admin/crm/leads?status=new",
      tone: "gold",
      icon: "leads",
    },
    {
      id: "open",
      label: "Open",
      value: summary.openOpportunities,
      href: "/admin/crm/leads",
      tone: "neutral",
      icon: "opportunity",
    },
    {
      id: "hot",
      label: "Hot",
      value: summary.hotLeads,
      href: "/admin/crm/leads?temperature=HOT",
      tone: "danger",
      icon: "spark",
    },
    {
      id: "warm",
      label: "Warm",
      value: summary.warmLeads,
      href: "/admin/crm/leads?temperature=WARM",
      tone: "warning",
      icon: "spark",
    },
    {
      id: "cold",
      label: "Cold",
      value: summary.coldLeads,
      href: "/admin/crm/leads?temperature=COLD",
      tone: "info",
      icon: "crm",
    },
    {
      id: "overdue",
      label: "Overdue",
      value: summary.overdueFollowUps,
      href: "/admin/crm/leads?followUpDue=overdue",
      tone: "danger",
      icon: "clock",
    },
    {
      id: "unassigned",
      label: "Unassigned",
      value: summary.unassignedLeads,
      href: "/admin/crm/leads?assignment=unassigned",
      tone: "warning",
      icon: "users",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      value: summary.whatsappLinked,
      href: "/admin/whatsapp/inbox",
      tone: "positive",
      icon: "whatsapp",
    },
  ];

  const visible = metrics.filter((metric) => metric.value !== null);

  return (
    <section className="crm-executive-bar" aria-label="CRM live sales pulse">
      <div className="crm-executive-bar__intro">
        <div>
          <p className="crm-executive-bar__eyebrow">Live sales pulse</p>
          <h2>Command bar</h2>
        </div>
        <p>RLS-scoped operational data · tap any metric to open its queue</p>
      </div>
      <div className="crm-executive-bar__metrics">
        {visible.map((metric) => (
          <Link
            key={metric.id}
            href={metric.href}
            className="crm-executive-metric"
            data-tone={metric.tone}
          >
            <span className="crm-executive-metric__icon" aria-hidden>
              <OpsIcon name={metric.icon} className="h-4 w-4" />
            </span>
            <span className="crm-executive-metric__copy">
              <strong>{displayValue(metric.value)}</strong>
              <span>{metric.label}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
