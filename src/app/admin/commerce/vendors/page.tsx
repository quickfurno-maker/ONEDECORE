import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { listCommerceVendorsAdmin } from "@/features/commerce/vendor/vendor-admin-queries";
import { VendorAccountsWorkspace } from "@/features/commerce/vendor/components/VendorAccountsWorkspace";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommercePageHeader } from "@/features/commerce/components/CommercePageHeader";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";

export const dynamic = "force-dynamic";

export default async function CommerceVendorsPage() {
  const session = await getStaffClaims();
  if (!session) redirect("/auth/login?portal=admin&next=%2Fadmin%2Fcommerce%2Fvendors");
  const permissions = await probeCommercePermissions();
  if (!permissions.canManageCatalog) redirect("/auth/forbidden");
  const vendors = await listCommerceVendorsAdmin();
  return (
    <div className="mx-auto max-w-[1600px] space-y-6">
      <CommercePageHeader title="Vendors" subtitle="Create and control commerce vendor accounts. One auth user maps to one vendor code." />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <VendorAccountsWorkspace vendors={vendors} />
    </div>
  );
}
