import Link from "next/link";
import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCampaignPermissions } from "@/features/marketing/server/campaign-permissions";
import { listCampaigns } from "@/features/marketing/server/campaign-queries";
import { CampaignCreateForm } from "@/features/marketing/components/CampaignCreateForm";
import { PrebuildBanner } from "@/features/marketing/components/PrebuildBanner";

export const metadata = {
  title: "Campaigns | OneDecore Admin",
  description: "Phase 9A campaign consent, audience, and approval governance",
};

export default async function AdminCampaignsPage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcampaigns");
  }
  const permissions = await probeCampaignPermissions();
  if (!permissions.canReadCampaigns) {
    redirect("/auth/forbidden");
  }

  const campaigns = await listCampaigns();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Campaigns</h1>
        <p className="mt-1 text-xs text-neutral-400">
          Approval governance only — campaign execution is not active.
        </p>
      </div>
      <PrebuildBanner />
      {permissions.canDraftCampaigns ? <CampaignCreateForm /> : null}
      <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-neutral-800 bg-neutral-950 text-[10px] uppercase tracking-wider text-neutral-400">
            <tr>
              <th className="p-3">Reference</th>
              <th className="p-3">Latest version</th>
              <th className="p-3">Title</th>
              <th className="p-3">State</th>
              <th className="p-3">Targeting</th>
              <th className="p-3">Channels</th>
              <th className="p-3 text-right">Open</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-900 text-neutral-200">
            {campaigns.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-8 text-center text-neutral-500">
                  No campaign drafts yet.
                </td>
              </tr>
            ) : (
              campaigns.map((campaign) => (
                <tr key={campaign.id}>
                  <td className="p-3 font-medium">{campaign.campaignReference}</td>
                  <td className="p-3">v{campaign.latestVersionNumber}</td>
                  <td className="p-3">{campaign.latestTitle}</td>
                  <td className="p-3">{campaign.latestStatus.replaceAll("_", " ")}</td>
                  <td className="p-3">{campaign.targetingMode}</td>
                  <td className="p-3">{campaign.intendedChannels.join(", ")}</td>
                  <td className="p-3 text-right">
                    <Link href={`/admin/campaigns/${campaign.id}`} className="text-amber-300 hover:text-amber-200">
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
