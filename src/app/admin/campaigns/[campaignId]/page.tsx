import { notFound, redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCampaignPermissions } from "@/features/marketing/server/campaign-permissions";
import {
  getCampaignDetail,
  previewCampaignAudience,
} from "@/features/marketing/server/campaign-queries";
import { CampaignVersionForms } from "@/features/marketing/components/CampaignVersionForms";
import { PrebuildBanner } from "@/features/marketing/components/PrebuildBanner";
import type { CrmRoleCode } from "@/features/crm/contracts/permissions";

interface AdminCampaignDetailPageProps {
  readonly params: Promise<{ campaignId: string }>;
}

export default async function AdminCampaignDetailPage({ params }: AdminCampaignDetailPageProps) {
  const { campaignId } = await params;
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcampaigns");
  }
  const permissions = await probeCampaignPermissions();
  if (!permissions.canReadCampaigns) {
    notFound();
  }

  const detail = await getCampaignDetail(campaignId);
  if (!detail) notFound();

  const latest = [...detail.versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
  const preview = latest ? await previewCampaignAudience(latest.id).catch(() => null) : null;
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
          Approval governance only — campaign execution is not active.
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
    </div>
  );
}
