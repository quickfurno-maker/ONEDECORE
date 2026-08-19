"use client";

import { safeRatio } from "../execution/domain/metric-ratios.ts";

export interface CampaignMetricsBoardView {
  readonly productionEnabled: boolean;
  readonly sharingEnabled: boolean;
  readonly adapterAvailable: boolean;
  readonly configMissing: boolean;
  readonly provider: {
    readonly spendMinor: number;
    readonly impressions: number;
    readonly clicks: number;
    readonly providerConversions: number;
    readonly currency: string;
  };
  readonly crm: {
    readonly LeadCreated: number;
    readonly QualifiedLead: number;
    readonly ConsultationScheduled: number;
    readonly ProposalSent: number;
    readonly CommercialConversion: number;
  };
  readonly unattributedCount: number;
  readonly feedback: readonly {
    readonly event_reference: string;
    readonly conversion_type: string;
    readonly attribution_state: string;
    readonly provider_submission_state: string;
  }[];
}

function formatRatio(value: number | null, suffix: string): string {
  if (value == null) return "n/a";
  return `${value.toFixed(2)} ${suffix}`;
}

export function CampaignMetricsPanel({ board }: { readonly board: CampaignMetricsBoardView | null }) {
  if (!board) {
    return (
      <section className="space-y-2 rounded-xl border border-neutral-800 p-4">
        <h2 className="text-lg font-semibold text-neutral-100">Metrics / Conversion Feedback</h2>
        <p className="text-xs text-neutral-500">campaigns.metrics.read required.</p>
      </section>
    );
  }

  const { provider, crm } = board;
  const cpc = safeRatio(provider.spendMinor, provider.clicks);
  const cpl = safeRatio(provider.spendMinor, crm.LeadCreated);
  const cpq = safeRatio(provider.spendMinor, crm.QualifiedLead);
  const cpcx = safeRatio(provider.spendMinor, crm.ConsultationScheduled);
  const cpp = safeRatio(provider.spendMinor, crm.ProposalSent);
  const cpcc = safeRatio(provider.spendMinor, crm.CommercialConversion);

  return (
    <section className="space-y-3 rounded-xl border border-neutral-800 p-4">
      <h2 className="text-lg font-semibold text-neutral-100">Metrics / Conversion Feedback</h2>
      <div className="space-y-1 text-xs text-amber-200">
        <p>Production campaign gate: {board.productionEnabled ? "ON" : "OFF"}.</p>
        <p>Provider-data-sharing gate: {board.sharingEnabled ? "ON" : "OFF"}.</p>
        <p>
          Adapter: {board.adapterAvailable ? "implemented" : "unavailable"}
          {board.configMissing ? " · configuration missing" : ""}
        </p>
        <p>No live spend. Provider counts are not forced to equal CRM counts. No secrets rendered.</p>
      </div>
      <div className="grid gap-3 text-sm text-neutral-300 sm:grid-cols-2">
        <div>
          <h3 className="font-medium text-neutral-100">Provider delivery</h3>
          <p>Spend: {provider.spendMinor} {provider.currency} minor</p>
          <p>Impressions: {provider.impressions}</p>
          <p>Clicks: {provider.clicks}</p>
          <p>Provider conversions: {provider.providerConversions}</p>
        </div>
        <div>
          <h3 className="font-medium text-neutral-100">CRM conversions</h3>
          <p>Leads: {crm.LeadCreated}</p>
          <p>Qualified: {crm.QualifiedLead}</p>
          <p>Consultation scheduled: {crm.ConsultationScheduled}</p>
          <p>Proposal sent: {crm.ProposalSent}</p>
          <p>CommercialConversion: {crm.CommercialConversion}</p>
          <p className="text-xs text-neutral-500">Commercial value basis: taxable_base_paise / CRM commercial basis</p>
        </div>
      </div>
      <div className="text-xs text-neutral-400">
        CPC {formatRatio(cpc, provider.currency)} · CPL {formatRatio(cpl, provider.currency)} · CPQL{" "}
        {formatRatio(cpq, provider.currency)} · CP consult {formatRatio(cpcx, provider.currency)} · CP proposal{" "}
        {formatRatio(cpp, provider.currency)} · CP commercial {formatRatio(cpcc, provider.currency)}
      </div>
      <p className="text-xs text-neutral-500">Unattributed / ambiguous conversions: {board.unattributedCount}</p>
      <ul className="text-xs text-neutral-500">
        {board.feedback.slice(0, 8).map((row) => (
          <li key={row.event_reference}>
            {row.event_reference} · {row.conversion_type} · {row.attribution_state} · {row.provider_submission_state}
          </li>
        ))}
      </ul>
    </section>
  );
}
