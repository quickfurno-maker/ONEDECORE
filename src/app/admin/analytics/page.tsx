import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/claims";
import {
  fetchWebsiteAnalyticsDashboard,
  WEBSITE_ANALYTICS_SOURCE_LABELS,
} from "@/features/website-analytics/server/dashboard";

export const metadata = {
  title: "Website Analytics | ONEDECORE",
  description: "First-party website traffic, source and CRM conversion analytics.",
};

interface AnalyticsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isoDate(value: string | undefined, fallback: Date): string {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value))) {
    return value;
  }
  return fallback.toISOString().slice(0, 10);
}

function n(value: number): string {
  return value.toLocaleString("en-IN");
}

function money(minor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function rate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "â€”";
  return (100 * numerator / denominator).toFixed(1) + "%";
}

export default async function WebsiteAnalyticsPage({
  searchParams,
}: AnalyticsPageProps) {
  const claims = await getClaims();
  if (!claims) {
    redirect("/auth/login?portal=admin&next=%2Fadmin%2Fanalytics");
  }
  if (!claims.permissions.includes("website.analytics.read")) {
    redirect("/auth/forbidden");
  }

  const params = await searchParams;
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 29);
  const from = isoDate(first(params.from), start);
  const to = isoDate(first(params.to), today);
  const analytics = await fetchWebsiteAnalyticsDashboard(from, to);

  if (!analytics) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-neutral-100">Website Analytics</h1>
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-5 text-sm text-red-200">
          Analytics could not be loaded. No tracking or CRM data was changed.
        </div>
      </div>
    );
  }

  const t = analytics.totals;
  const cards = [
    ["Measured visitors", n(t.visitors), "Consented first-party measurement"],
    ["Sessions", n(t.sessions), n(t.page_views) + " page views"],
    ["Enquiries", n(t.leads), rate(t.leads, t.sessions) + " session â†’ enquiry"],
    ["Qualified", n(t.qualified), rate(t.qualified, t.leads) + " of enquiries"],
    ["Consultations", n(t.consultations), rate(t.consultations, t.leads) + " of enquiries"],
    ["Proposals", n(t.proposals), rate(t.proposals, t.leads) + " of enquiries"],
    ["Commercial conversions", n(t.commercial_conversions), money(t.commercial_value_minor)],
  ] as const;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Website Analytics</h1>
          <p className="mt-1 max-w-3xl text-xs text-neutral-400">
            Consented first-party website measurement joined to authoritative CRM outcomes.
            Visitors who choose Necessary only are not counted here; CRM enquiry totals remain business truth.
          </p>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs text-neutral-400">
            From
            <input name="from" type="date" defaultValue={from} className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100" />
          </label>
          <label className="text-xs text-neutral-400">
            To
            <input name="to" type="date" defaultValue={to} className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100" />
          </label>
          <button className="rounded bg-amber-300 px-3 py-1.5 text-xs font-semibold text-neutral-950" type="submit">
            Apply
          </button>
        </form>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, context]) => (
          <div key={label} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">{label}</p>
            <p className="mt-2 text-2xl font-semibold text-neutral-100">{value}</p>
            <p className="mt-1 text-xs text-neutral-400">{context}</p>
          </div>
        ))}
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="font-semibold text-neutral-100">Source performance</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3">Source</th><th className="p-3">Visitors</th>
                <th className="p-3">Sessions</th><th className="p-3">Leads</th>
                <th className="p-3">Conv.</th><th className="p-3">Qualified</th>
                <th className="p-3">Consult.</th><th className="p-3">Proposals</th>
                <th className="p-3">Won</th><th className="p-3">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-neutral-200">
              {analytics.sources.length === 0 ? (
                <tr><td colSpan={10} className="p-8 text-center text-neutral-500">No measured traffic in this range.</td></tr>
              ) : analytics.sources.map((row) => (
                <tr key={row.source_key}>
                  <td className="p-3 font-medium">{WEBSITE_ANALYTICS_SOURCE_LABELS[row.source_key] ?? row.source_key}</td>
                  <td className="p-3">{n(row.visitors)}</td>
                  <td className="p-3">{n(row.sessions)}</td>
                  <td className="p-3">{n(row.leads)}</td>
                  <td className="p-3">{rate(row.leads, row.sessions)}</td>
                  <td className="p-3">{n(row.qualified)}</td>
                  <td className="p-3">{n(row.consultations)}</td>
                  <td className="p-3">{n(row.proposals)}</td>
                  <td className="p-3">{n(row.commercial_conversions)}</td>
                  <td className="p-3">{money(row.commercial_value_minor)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
          <h2 className="border-b border-neutral-800 p-4 font-semibold text-neutral-100">Campaigns</h2>
          <div className="divide-y divide-neutral-800">
            {analytics.campaigns.length === 0 ? (
              <p className="p-6 text-xs text-neutral-500">No UTM campaigns measured.</p>
            ) : analytics.campaigns.slice(0, 20).map((row) => (
              <div key={row.utm_campaign} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-xs">
                <div><p className="font-medium text-neutral-200">{row.utm_campaign}</p>
                  <p className="text-neutral-500">{n(row.sessions)} sessions Â· {n(row.leads)} leads</p></div>
                <div className="text-right text-neutral-300">{n(row.qualified)} qualified<br />{n(row.commercial_conversions)} won</div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
          <h2 className="border-b border-neutral-800 p-4 font-semibold text-neutral-100">Top pages</h2>
          <div className="divide-y divide-neutral-800">
            {analytics.pages.length === 0 ? (
              <p className="p-6 text-xs text-neutral-500">No page views measured.</p>
            ) : analytics.pages.slice(0, 20).map((row) => (
              <div key={row.path} className="grid grid-cols-[1fr_auto] gap-3 p-3 text-xs">
                <p className="truncate text-neutral-200">{row.path}</p>
                <p className="text-right text-neutral-400">{n(row.page_views)} views<br />{n(row.sessions)} sessions</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
