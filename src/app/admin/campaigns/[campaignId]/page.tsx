import { notFound, redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCampaignPermissions } from "@/features/marketing/server/campaign-permissions";
import {
  getCampaignDetail,
  listCampaignRunsForCampaign,
  previewCampaignAudience,
  getCampaignMetricsBoard,
} from "@/features/marketing/server/campaign-queries";
import { CampaignVersionForms } from "@/features/marketing/components/CampaignVersionForms";
import { CampaignExecutionPanel } from "@/features/marketing/components/CampaignExecutionPanel";
import { PrebuildBanner } from "@/features/marketing/components/PrebuildBanner";
import { CampaignMetricsPanel, type CampaignMetricsBoardView } from "@/features/marketing/components/CampaignMetricsPanel";
import { getCampaignExecutionMode, isProviderDataSharingEnabled } from "@/features/marketing/execution/server/execution-env";
import { isCampaignProductionEnabled, resolveMetaAdsProviderConfig, resolveGoogleAdsProviderConfig } from "@/features/marketing/execution/server/provider-config";
import type { CrmRoleCode } from "@/features/crm/contracts/permissions";

interface AdminCampaignDetailPageProps {
  readonly params: Promise<{ campaignId: string }>;
}

export default async function AdminCampaignDetailPage({ params }: AdminCampaignDetailPageProps) {
  const { campaignId } = await params;
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?portal=admin&next=%2Fadmin%2Fcampaigns");
  }
  const permissions = await probeCampaignPermissions();
  if (!permissions.canReadCampaigns) {
    notFound();
  }

  const detail = await getCampaignDetail(campaignId);
  if (!detail) notFound();

  const latest = [...detail.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const preview = latest ? await previewCampaignAudience(latest.id).catch(() => null) : null;
  const runs = await listCampaignRunsForCampaign(campaignId);
  const metricsRaw = permissions.canReadCampaignMetrics
    ? await getCampaignMetricsBoard(campaignId)
    : null;
  const executionMode = getCampaignExecutionMode();
  const sharingEnabled = isProviderDataSharingEnabled();
  const productionEnabled = isCampaignProductionEnabled();
  const metaConfig = resolveMetaAdsProviderConfig();
  const googleConfig = resolveGoogleAdsProviderConfig();
  const role: CrmRoleCode = permissions.isSuperAdmin
    ? "super_admin"
    : permissions.isSalesManager
      ? "sales_manager"
      : "sales_executive";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">{detail.campaignReference}</h1>
        <p className="mt-1 text-sm text-neutral-300">{detail.name}</p>
        <p className="mt-1 text-xs text-neutral-400">
          Approval governance only. Mock execution foundation — no live provider writes. Production activation Phase 10.
        </p>
      </div>
      <PrebuildBanner />
      <ol className="space-y-2 text-sm text-neutral-300">
        {detail.versions.map((version) => (
          <li key={version.id} className="rounded border border-neutral-800 p-3">
            v{version.versionNumber} · {version.status.replaceAll("_", " ")} · {version.title}
            {version.approvalDecision ? ` · ${version.approvalDecision}` : ""}
          </li>
        ))}
      </ol>
      {preview ? (
        <section className="rounded-xl border border-neutral-800 p-4 text-sm text-neutral-300">
          <h2 className="font-semibold text-neutral-100">Audience preview</h2>
          <p className="mt-2 text-xs text-neutral-500">{preview.previewLabel}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            <div>Rule match leads: {preview.ruleMatchLeadCount}</div>
            <div>Distinct contacts: {preview.distinctContactCount}</div>
            <div>Current MARKETING consent: {preview.currentMarketingConsentCount}</div>
            <div>DNC blocked: {preview.dncBlockedCount}</div>
            <div>
              Eligible direct/custom: {preview.eligibleDirectOrCustomCount ?? "n/a for broad_public"}
            </div>
          </dl>
        </section>
      ) : null}
      <CampaignVersionForms
        campaignId={detail.id}
        actorProfileId={session.userId}
        role={role}
        canDraft={permissions.canDraftCampaigns}
        canRequest={permissions.canRequestCampaignApproval}
        canApprove={permissions.canApproveCampaigns}
        versions={detail.versions}
      />
      <CampaignExecutionPanel
        campaignId={detail.id}
        role={role}
        canExecute={permissions.canExecuteCampaigns}
        canPause={permissions.canPauseCampaigns}
        executionMode={executionMode}
        sharingEnabled={sharingEnabled}
        versions={detail.versions}
        runs={runs}
      />
      <CampaignMetricsPanel
        board={
          metricsRaw
            ? ({
                productionEnabled,
                sharingEnabled,
                adapterAvailable: true,
                configMissing: !metaConfig.ok && !googleConfig.ok,
                provider: {
                  spendMinor:
                    (metricsRaw.provider as Record<string, unknown> | undefined)?.spend_minor == null
                      ? null
                      : Number((metricsRaw.provider as Record<string, unknown>).spend_minor),
                  impressions: Number((metricsRaw.provider as Record<string, unknown> | undefined)?.impressions ?? 0),
                  clicks: Number((metricsRaw.provider as Record<string, unknown> | undefined)?.clicks ?? 0),
                  providerConversions: Number(
                    (metricsRaw.provider as Record<string, unknown> | undefined)?.provider_conversions ?? 0
                  ),
                  currency:
                    (metricsRaw.provider as Record<string, unknown> | undefined)?.currency == null
                      ? null
                      : String((metricsRaw.provider as Record<string, unknown>).currency),
                  mixedCurrency: Boolean(
                    (metricsRaw.provider as Record<string, unknown> | undefined)?.mixed_currency
                  ),
                },
                crm: {
                  LeadCreated: Number((metricsRaw.crm as Record<string, unknown> | undefined)?.LeadCreated ?? 0),
                  QualifiedLead: Number((metricsRaw.crm as Record<string, unknown> | undefined)?.QualifiedLead ?? 0),
                  ConsultationScheduled: Number(
                    (metricsRaw.crm as Record<string, unknown> | undefined)?.ConsultationScheduled ?? 0
                  ),
                  ProposalSent: Number((metricsRaw.crm as Record<string, unknown> | undefined)?.ProposalSent ?? 0),
                  CommercialConversion: Number(
                    (metricsRaw.crm as Record<string, unknown> | undefined)?.CommercialConversion ?? 0
                  ),
                },
                unattributedCount: Number(metricsRaw.unattributed ?? 0),
                feedback: Array.isArray(metricsRaw.feedback)
                  ? (metricsRaw.feedback as CampaignMetricsBoardView["feedback"])
                  : [],
              } satisfies CampaignMetricsBoardView)
            : null
        }
      />
    </div>
  );
}
