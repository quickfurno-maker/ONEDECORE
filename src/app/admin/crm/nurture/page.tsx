import type { Metadata } from "next";
import Link from "next/link";
import { CrmPageHeader } from "@/features/crm/components/shell/CrmPageHeader";
import { LeadListCards } from "@/features/crm/components/leads/LeadListCards";
import { LeadListFilters } from "@/features/crm/components/leads/LeadListFilters";
import { LeadListPagination } from "@/features/crm/components/leads/LeadListPagination";
import { LeadListTable } from "@/features/crm/components/leads/LeadListTable";
import { LeadSalesBucketStrip } from "@/features/crm/components/leads/LeadSalesBucketStrip";
import { parseLeadListQuery } from "@/features/crm/contracts/lead-list-query";
import { getCrmAccessContext } from "@/features/crm/server/crm-auth";
import { WHATSAPP_ADMIN_SCHEDULER_PATH } from "@/features/whatsapp/contracts/control-plane";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";
import {
  fetchActiveLeadSources,
  fetchCrmAssigneeDirectory,
} from "@/features/crm/server/crm-lead-queries";
import { getLeadListPageForCurrentUser } from "@/features/crm/server/crm-lead-repository";
import {
  countCrmNurtureStages,
  fetchCrmNurtureV2Signals,
} from "@/features/crm/server/crm-nurture-v2";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Lead Nurture | ONEDECORE",
  description: "Long-term CRM opportunities with project timelines beyond two months.",
};

interface CrmNurturePageProps {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const NURTURE_PATH = "/admin/crm/nurture";
const NURTURE_DATE = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
function formatNurtureDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : NURTURE_DATE.format(date);
}

export default async function CrmNurturePage({ searchParams }: CrmNurturePageProps) {
  const resolvedSearchParams = await searchParams;
  const parsed = parseLeadListQuery({
    ...resolvedSearchParams,
    month: "all",
    timeline: "after-2-months",
  });
  const query = { ...parsed, excludeTerminal: true };
  const context = await getCrmAccessContext();

  if (!context) {
    return null;
  }

  const [page, sources, assignees, whatsappAccess] = await Promise.all([
    getLeadListPageForCurrentUser(query),
    fetchActiveLeadSources(),
    fetchCrmAssigneeDirectory(context),
    resolveWhatsappControlPlaneAccess(),
  ]);

  const nurtureSignals = await fetchCrmNurtureV2Signals(page.items.map((item) => item.id));
  const nurtureStageCounts = countCrmNurtureStages(nurtureSignals);
  const nurturedVisibleCount = Object.values(nurtureSignals).filter(
    (signal) => signal.nurtureCount > 0
  ).length;
  const nurtureReactivationRate =
    nurturedVisibleCount > 0
      ? nurtureStageCounts.re_engaged / nurturedVisibleCount
      : null;

  const hasUserFilters = Boolean(
    query.q ||
      query.status ||
      query.sourceId ||
      query.assignment ||
      query.assigneeId ||
      query.followUpDue ||
      query.bucket ||
      query.temperature
  );

  return (
    <div className="space-y-5">
      <CrmPageHeader
        title="Lead Nurture"
        description="Long-term opportunities whose project timeline is more than 2 months."
        actions={
          whatsappAccess?.permissions["whatsapp.campaigns.execute"] ? (
            <Link
              href={`${WHATSAPP_ADMIN_SCHEDULER_PATH}?audiencePreset=long-term-nurture&audienceTemperature=all#new-schedule`}
              className="crm-btn crm-btn-primary w-full sm:w-auto"
              data-testid="crm-nurture-whatsapp-promotion"
            >
              Schedule WhatsApp nurture
            </Link>
          ) : null
        }
      />

      <section className="crm-surface rounded-[14px] p-4" data-testid="crm-nurture-explainer">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--crm-primary)]">
              Automatic nurture cohort
            </p>
            <h2 className="mt-1 text-[15px] font-semibold text-[var(--crm-text)]">
              Project timeline: after 2 months
            </h2>
          </div>
          <strong className="text-[22px] tabular-nums text-[var(--crm-text)]">
            {page.filteredTotal.toLocaleString("en-IN")}
          </strong>
        </div>
        <p className="mt-2 max-w-4xl text-[12px] leading-5 text-[var(--crm-muted)]">
          This section follows the timeline captured on the lead automatically and excludes
          closed-won and closed-lost records. Sales temperature stays independent, so a
          long-term lead can still be Hot, Warm or Cold.
        </p>
        <p className="mt-1 max-w-4xl text-[12px] leading-5 text-[var(--crm-muted)]">
          WhatsApp promotions use the governed MARKETING campaign flow. Current marketing
          consent, opt-out / DNC state, WhatsApp availability, approved templates and final
          eligibility are checked before delivery.
        </p>
      </section>
      <section className="crm-surface rounded-[14px] p-4" data-testid="crm-nurture-v2">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[12px] font-semibold uppercase tracking-[0.1em] text-[var(--crm-primary)]">
              Nurture V2 · current page
            </p>
            <h2 className="mt-1 text-[15px] font-semibold text-[var(--crm-text)]">
              Dormancy and reactivation intelligence
            </h2>
          </div>
          <span className="text-[12px] text-[var(--crm-muted)]">
            {page.items.length} visible lead{page.items.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
          {[
            ["Long horizon", nurtureStageCounts.long_horizon],
            ["Dormant · 30d", nurtureStageCounts.dormant_30],
            ["Dormant · 60d", nurtureStageCounts.dormant_60],
            ["Dormant · 90d", nurtureStageCounts.dormant_90],
            ["Re-engaged", nurtureStageCounts.re_engaged],
            [
              "Reactivation",
              nurtureReactivationRate === null
                ? "—"
                : Math.round(nurtureReactivationRate * 100) + "%",
            ],
          ].map(([label, count]) => (
            <div key={String(label)} className="rounded-[10px] border border-[var(--crm-border)] p-3">
              <strong className="block text-[18px] text-[var(--crm-text)]">{count}</strong>
              <span className="text-[11px] text-[var(--crm-muted)]">{label}</span>
            </div>
          ))}
        </div>
        {page.items.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[780px] text-left text-[12px]">
              <thead className="text-[var(--crm-muted)]">
                <tr>
                  <th className="pb-2 pr-3">Lead</th>
                  <th className="pb-2 pr-3">Nurture stage</th>
                  <th className="pb-2 pr-3">Next nurture</th>
                  <th className="pb-2 pr-3">Count</th>
                  <th className="pb-2 pr-3">Last template</th>
                  <th className="pb-2">Suppression</th>
                </tr>
              </thead>
              <tbody>
                {page.items.map((lead) => {
                  const signal = nurtureSignals[lead.id];
                  return (
                    <tr key={lead.id} className="border-t border-[var(--crm-border)]">
                      <td className="py-2 pr-3 font-semibold text-[var(--crm-text)]">{lead.submittedName}</td>
                      <td className="py-2 pr-3">{signal?.stageLabel ?? "Long horizon"}</td>
                      <td className="py-2 pr-3">{formatNurtureDate(signal?.nextNurtureAt ?? null)}</td>
                      <td className="py-2 pr-3">{signal?.nurtureCount ?? 0}</td>
                      <td className="py-2 pr-3">{signal?.lastTemplateName ?? "—"}</td>
                      <td className="py-2">
                        {signal?.temporarilySuppressed
                          ? "Until " + formatNurtureDate(signal.suppressedUntil)
                          : "Active"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
        <p className="mt-3 text-[11px] leading-5 text-[var(--crm-muted)]">
          Dormancy uses canonical CRM/customer activity. Re-engaged requires a customer reply after an attributed nurture send. Suppression is explicit; no unapproved default suppression interval is invented.
        </p>
      </section>

      <LeadSalesBucketStrip
        query={query}
        counts={page.bucketCounts}
        countsExact={page.countsExact}
        basePath={NURTURE_PATH}
        hideLost
      />

      {page.cohortTruncated ? (
        <p
          className="rounded-[10px] border border-[var(--crm-warning)]/30 bg-[var(--crm-warning-soft)] px-3 py-2 text-[12px] text-[var(--crm-warning)]"
          data-testid="crm-nurture-cohort-truncated"
        >
          The nurture cohort is larger than one workspace read, so exact bucket counts
          are unavailable. Add a filter to narrow the cohort.
        </p>
      ) : null}

      <LeadListFilters
        query={query}
        sources={sources}
        assignees={assignees}
        showBroadFilters={context.canReadBroad}
        basePath={NURTURE_PATH}
        lockTimeline
      />

      {page.items.length === 0 ? (
        <section className="crm-surface rounded-[14px] p-6 text-center">
          <h2 className="text-[15px] font-semibold text-[var(--crm-text)]">
            {hasUserFilters ? "No nurture leads match these filters" : "No long-term nurture leads yet"}
          </h2>
          <p className="mt-2 text-[12px] text-[var(--crm-muted)]">
            {hasUserFilters
              ? "Clear or adjust the filters while keeping the long-term nurture scope."
              : "Leads with an “After 2 months” project timeline will appear here automatically."}
          </p>
        </section>
      ) : (
        <>
          <LeadListTable items={page.items} />
          <LeadListCards items={page.items} />
          <LeadListPagination query={query} pagination={page.pagination} basePath={NURTURE_PATH} />
        </>
      )}
    </div>
  );
}
