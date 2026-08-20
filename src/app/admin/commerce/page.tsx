import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { getCommerceOverview } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";

export const metadata = {
  title: "Commerce | OneDecore Admin",
  description: "Phase 9D-B commerce catalogue and inventory admin",
};

export default async function AdminCommercePage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce");
  }
  const permissions = await probeCommercePermissions();
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  const overview = await getCommerceOverview();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-neutral-100">Commerce</h1>
        <p className="mt-1 text-xs text-neutral-400">Catalogue and inventory foundation. No public storefront in this phase.</p>
      </div>
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          ["Categories", overview.categoryCount],
          ["Products", overview.productCount],
          ["Drafts", overview.draftCount],
          ["Published", overview.publishedCount],
          ["Archived", overview.archivedCount],
          ["Variants", overview.variantCount],
          ["Tax rates", overview.taxRateCount],
          ["Pincodes", overview.pincodeCount],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
            <p className="text-[10px] uppercase tracking-wider text-neutral-500">{label}</p>
            <p className="mt-1 text-lg font-semibold text-neutral-100">{value}</p>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-xs text-neutral-300">
        <p>Inventory foundation ready: {overview.inventoryReady ? "yes" : "no"}.</p>
        <p>Settings singleton ready: {overview.settingsReady ? "yes" : "no"}.</p>
        <p>Tax required for publish: {overview.taxRequiredForPublish ? "yes" : "no"}.</p>
        <p>GST-inclusive pricing — locked for ONEDECORE MVP.</p>
        <p>Default shipping (paise): {overview.defaultShippingChargePaise}</p>
      </div>
    </div>
  );
}
