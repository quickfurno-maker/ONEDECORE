import { redirect } from "next/navigation";
import { getClaims } from "@/server/auth/claims";
import {
  fetchWebsiteAnalyticsDashboard,
  WEBSITE_ANALYTICS_SOURCE_LABELS,
} from "@/features/website-analytics/server/dashboard";
import { fetchWebsiteBusinessAttribution } from "@/features/website-analytics/server/business-attribution";
import { AnalyticsLiveRefresh } from "@/features/website-analytics/client/AnalyticsLiveRefresh";

export const metadata = {
  title: "Website Analytics | ONEDECORE",
  description: "Website traffic, source attribution and CRM conversion analytics.",
};

interface AnalyticsPageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isoDate(value: string | undefined, fallback: string): string {
  if (
    value &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value))
  ) {
    return value;
  }
  return fallback;
}

function currentIstDate(): string {
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return part("year") + "-" + part("month") + "-" + part("day");
}

function shiftIsoDate(value: string, days: number): string {
  const date = new Date(value + "T00:00:00Z");
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function n(value: number): string {
  return value.toLocaleString("en-IN");
}

function nullableN(value: number | null): string {
  return value === null ? "Unavailable" : n(value);
}

function money(minor: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(minor / 100);
}

function rate(numerator: number, denominator: number): string {
  if (denominator <= 0) return "-";
  return ((100 * numerator) / denominator).toFixed(1) + "%";
}

function timeLabel(value: string | null): string {
  if (!value) return "None yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(date);
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
  const defaultTo = currentIstDate();
  const defaultFrom = shiftIsoDate(defaultTo, -29);
  const from = isoDate(first(params.from), defaultFrom);
  const to = isoDate(first(params.to), defaultTo);

  const [analytics, business] = await Promise.all([
    fetchWebsiteAnalyticsDashboard(from, to),
    fetchWebsiteBusinessAttribution(from, to, claims.permissions),
  ]);
  const loadedAt = new Date().toISOString();

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
  const h = analytics.homepageActivity;
  const landingExposures =
    business?.landingLab.reduce((sum, row) => sum + row.exposures, 0) ??
    analytics.landingActivity.exposures;

  const cards = [
    [
      "Landing Lab exposures",
      landingExposures === null ? "Unavailable" : n(landingExposures),
      "Operational exposure denominator; not people or homepage visits",
    ],
    [
      "CRM website enquiries",
      business ? n(business.totalEnquiries) : "Unavailable",
      "All website-planner enquiries, independent of optional analytics consent",
    ],
    ["Measured visitors", n(t.visitors), "Explicit v2 analytics consent only"],
    ["Measured sessions", n(t.sessions), "Browser-tab/sessionStorage acquisition sessions"],
    ["Measured page views", n(t.page_views), "Consented behavioral measurement"],
    ["Measured CTA actions", n(t.cta_actions), "CTA, WhatsApp and phone actions"],
    ["Measured form starts", n(t.form_starts), "Consented form engagement"],
    ["Measured form submits", n(t.form_submits), "Consented submit attempts"],
    [
      "Analytics-linked enquiries",
      n(t.leads),
      "CRM enquiries linked to a consented analytics session",
    ],
    ["Qualified", n(t.qualified), rate(t.qualified, t.leads) + " of linked enquiries"],
    ["Proposals", n(t.proposals), rate(t.proposals, t.leads) + " of linked enquiries"],
    [
      "Commercial conversions",
      n(t.commercial_conversions),
      money(t.commercial_value_minor),
    ],
  ] as const;

  const combinedPages = new Map<
    string,
    { path: string; pageViews: number; sessions: number; enquiries: number }
  >();
  for (const row of analytics.pages) {
    combinedPages.set(row.path, {
      path: row.path,
      pageViews: row.page_views,
      sessions: row.sessions,
      enquiries: 0,
    });
  }
  for (const row of business?.pages ?? []) {
    const current = combinedPages.get(row.path) ?? {
      path: row.path,
      pageViews: 0,
      sessions: 0,
      enquiries: 0,
    };
    current.enquiries = row.enquiries;
    combinedPages.set(row.path, current);
  }
  const pageRows = [...combinedPages.values()]
    .sort(
      (a, b) =>
        b.enquiries - a.enquiries ||
        b.pageViews - a.pageViews ||
        a.path.localeCompare(b.path)
    )
    .slice(0, 30);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-100">Website Analytics</h1>
          <p className="mt-1 max-w-4xl text-xs leading-relaxed text-neutral-400">
            Consent-aware behavioral measurement, Landing Lab operational exposure data,
            and authoritative CRM website enquiries are shown separately so a privacy
            choice never makes business demand disappear from the report.
          </p>
          <div className="mt-2">
            <AnalyticsLiveRefresh loadedAt={loadedAt} />
          </div>
        </div>
        <form className="flex flex-wrap items-end gap-2" method="get">
          <label className="text-xs text-neutral-400">
            From
            <input
              name="from"
              type="date"
              defaultValue={from}
              className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100"
            />
          </label>
          <label className="text-xs text-neutral-400">
            To
            <input
              name="to"
              type="date"
              defaultValue={to}
              className="ml-2 rounded border border-neutral-700 bg-neutral-950 px-2 py-1 text-neutral-100"
            />
          </label>
          <button
            className="rounded bg-amber-300 px-3 py-1.5 text-xs font-semibold text-neutral-950"
            type="submit"
          >
            Apply
          </button>
        </form>
      </header>

      <section className="rounded-xl border border-amber-900/40 bg-amber-950/20 p-4 text-xs text-neutral-300">
        <p className="font-semibold text-amber-200">Three reporting layers</p>
        <div className="mt-2 grid gap-3 lg:grid-cols-3">
          <p className="leading-relaxed text-neutral-400">
            <strong className="text-neutral-300">Landing Lab exposures</strong> are
            privacy-safe operational exposures for published Landing Lab pages. They may
            include previews or automated visits and are not equivalent to people.
          </p>
          <p className="leading-relaxed text-neutral-400">
            <strong className="text-neutral-300">Measured behavior</strong> is recorded
            only after explicit current v2 analytics and advertising consent.
          </p>
          <p className="leading-relaxed text-neutral-400">
            <strong className="text-neutral-300">CRM website enquiries</strong> are
            successful website-planner submissions and remain business truth whether or
            not optional analytics consent was granted.
          </p>
        </div>
        <p className="mt-3 text-neutral-500">
          Last Landing Lab exposure: {timeLabel(analytics.landingActivity.lastExposureAt)}
          {" • "}
          Last consented analytics event: {timeLabel(analytics.lastMeasuredEventAt)}
          {" • "}
          Last CRM website enquiry: {timeLabel(business?.lastEnquiryAt ?? null)}
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, context]) => (
          <div
            key={label}
            className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
          >
            <p className="text-[11px] uppercase tracking-wider text-neutral-500">
              {label}
            </p>
            <p className="mt-2 text-2xl font-semibold text-neutral-100">{value}</p>
            <p className="mt-1 text-xs text-neutral-400">{context}</p>
          </div>
        ))}
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="font-semibold text-neutral-100">Homepage performance</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Behavioral cards are consented events on <code>/</code> within the selected
            IST date range. CRM homepage enquiries include all website-planner leads whose
            landing path normalizes to <code>/</code>, including hash/query variants.
          </p>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-6">
          {[
            ["Measured views", nullableN(h.page_views)],
            ["CTA actions", nullableN(h.cta_actions)],
            ["Form starts", nullableN(h.form_starts)],
            ["Form submits", nullableN(h.form_submits)],
            ["Tracked successes", nullableN(h.lead_successes)],
            [
              "CRM enquiries",
              business ? n(business.homepageEnquiries) : "Unavailable",
            ],
          ].map(([label, value]) => (
            <div key={label} className="rounded-lg border border-neutral-800 bg-neutral-950/50 p-3">
              <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
              <p className="mt-2 text-xl font-semibold text-neutral-100">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="font-semibold text-neutral-100">Measured source performance</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Consent-gated first-touch acquisition cohorts. Views and CTA actions shown
            here belong to sessions that started in the selected range.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-xs">
            <thead className="bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Visitors</th>
                <th className="p-3">Sessions</th>
                <th className="p-3">Views</th>
                <th className="p-3">CTA</th>
                <th className="p-3">Linked enquiries</th>
                <th className="p-3">Conv.</th>
                <th className="p-3">Qualified</th>
                <th className="p-3">Consult.</th>
                <th className="p-3">Proposals</th>
                <th className="p-3">Won</th>
                <th className="p-3">Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-neutral-200">
              {analytics.sources.length === 0 ? (
                <tr>
                  <td colSpan={12} className="p-8 text-center text-neutral-500">
                    No consented measured traffic in this range.
                  </td>
                </tr>
              ) : (
                analytics.sources.map((row) => (
                  <tr key={row.source_key}>
                    <td className="p-3 font-medium">
                      {WEBSITE_ANALYTICS_SOURCE_LABELS[row.source_key] ?? row.source_key}
                    </td>
                    <td className="p-3">{n(row.visitors)}</td>
                    <td className="p-3">{n(row.sessions)}</td>
                    <td className="p-3">{n(row.page_views)}</td>
                    <td className="p-3">{n(row.cta_actions)}</td>
                    <td className="p-3">{n(row.leads)}</td>
                    <td className="p-3">{rate(row.leads, row.sessions)}</td>
                    <td className="p-3">{n(row.qualified)}</td>
                    <td className="p-3">{n(row.consultations)}</td>
                    <td className="p-3">{n(row.proposals)}</td>
                    <td className="p-3">{n(row.commercial_conversions)}</td>
                    <td className="p-3">{money(row.commercial_value_minor)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="font-semibold text-neutral-100">CRM website enquiry sources</h2>
          <p className="mt-1 text-xs text-neutral-500">
            All successful website-planner enquiries. Source is resolved from UTM,
            click-id presence and external referring host already captured with the lead;
            no new tracking is performed here.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-left text-xs">
            <thead className="bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3">Source</th>
                <th className="p-3">Enquiries</th>
                <th className="p-3">Homepage enquiries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-neutral-200">
              {!business ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-neutral-500">
                    CRM attribution summary is temporarily unavailable.
                  </td>
                </tr>
              ) : business.sources.length === 0 ? (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-neutral-500">
                    No website enquiries in this range.
                  </td>
                </tr>
              ) : (
                business.sources.map((row) => (
                  <tr key={row.source_key}>
                    <td className="p-3 font-medium">
                      {WEBSITE_ANALYTICS_SOURCE_LABELS[row.source_key] ?? row.source_key}
                    </td>
                    <td className="p-3">{n(row.enquiries)}</td>
                    <td className="p-3">{n(row.homepage_enquiries)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
          <h2 className="border-b border-neutral-800 p-4 font-semibold text-neutral-100">
            Measured campaigns
          </h2>
          <div className="divide-y divide-neutral-800">
            {analytics.campaigns.length === 0 ? (
              <p className="p-6 text-xs text-neutral-500">No consented UTM campaigns measured.</p>
            ) : (
              analytics.campaigns.slice(0, 20).map((row) => (
                <div
                  key={row.utm_campaign}
                  className="grid grid-cols-[1fr_auto] gap-3 p-3 text-xs"
                >
                  <div>
                    <p className="font-medium text-neutral-200">{row.utm_campaign}</p>
                    <p className="text-neutral-500">
                      {n(row.sessions)} sessions | {n(row.leads)} linked enquiries
                    </p>
                  </div>
                  <div className="text-right text-neutral-300">
                    {n(row.qualified)} qualified
                    <br />
                    {n(row.commercial_conversions)} won
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
          <h2 className="border-b border-neutral-800 p-4 font-semibold text-neutral-100">
            CRM campaign attribution
          </h2>
          <div className="divide-y divide-neutral-800">
            {!business ? (
              <p className="p-6 text-xs text-neutral-500">CRM campaign attribution unavailable.</p>
            ) : business.campaigns.length === 0 ? (
              <p className="p-6 text-xs text-neutral-500">
                No website enquiries with UTM campaign values in this range.
              </p>
            ) : (
              business.campaigns.slice(0, 30).map((row) => (
                <div
                  key={[row.source_key, row.medium ?? "", row.utm_campaign].join("|")}
                  className="grid grid-cols-[1fr_auto] gap-3 p-3 text-xs"
                >
                  <div>
                    <p className="font-medium text-neutral-200">{row.utm_campaign}</p>
                    <p className="text-neutral-500">
                      {WEBSITE_ANALYTICS_SOURCE_LABELS[row.source_key] ?? row.source_key}
                      {row.medium ? " • " + row.medium : ""}
                    </p>
                  </div>
                  <p className="text-right text-neutral-300">{n(row.enquiries)} enquiries</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="font-semibold text-neutral-100">Page performance</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Measured views/sessions are consented analytics. CRM enquiries are all
            successful website-planner submissions, grouped by normalized pathname.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
              <tr>
                <th className="p-3">Path</th>
                <th className="p-3">Measured views</th>
                <th className="p-3">Measured sessions</th>
                <th className="p-3">CRM enquiries</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800 text-neutral-200">
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-neutral-500">
                    No page activity in this range.
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => (
                  <tr key={row.path}>
                    <td className="p-3 font-medium">{row.path}</td>
                    <td className="p-3">{n(row.pageViews)}</td>
                    <td className="p-3">{n(row.sessions)}</td>
                    <td className="p-3">{n(row.enquiries)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <div className="border-b border-neutral-800 p-4">
          <h2 className="font-semibold text-neutral-100">Landing Lab activity</h2>
          <p className="mt-1 text-xs text-neutral-500">
            Operational exposures by published Landing Lab page. These are not unique
            visitors and should not be compared directly with consented visitor counts.
          </p>
        </div>
        <div className="divide-y divide-neutral-800">
          {!business ? (
            <p className="p-6 text-xs text-neutral-500">Landing Lab breakdown unavailable.</p>
          ) : business.landingLab.length === 0 ? (
            <p className="p-6 text-xs text-neutral-500">No Landing Lab exposures in this range.</p>
          ) : (
            business.landingLab.map((row) => (
              <div
                key={row.slug}
                className="grid gap-2 p-3 text-xs sm:grid-cols-[1fr_auto_auto]"
              >
                <div>
                  <p className="font-medium text-neutral-200">{row.title}</p>
                  <p className="text-neutral-500">/lp/{row.slug}</p>
                </div>
                <p className="text-neutral-300">{n(row.exposures)} exposures</p>
                <p className="text-neutral-500">{timeLabel(row.last_exposure_at)}</p>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-950/50 p-4 text-xs leading-relaxed text-neutral-500">
        <p>
          <strong className="text-neutral-400">Session semantics:</strong> a measured
          ONEDECORE session currently follows browser <code>sessionStorage</code> (tab
          lifetime), not a 30-minute inactivity timeout.
        </p>
        <p className="mt-2">
          <strong className="text-neutral-400">Date semantics:</strong> measured source
          rows are acquisition cohorts based on session start. Homepage event cards use
          event timestamps inside the selected IST range. CRM enquiry cards use lead
          creation timestamps inside the same IST range.
        </p>
      </section>
    </div>
  );
}
