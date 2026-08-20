import { redirect } from "next/navigation";
import { getStaffClaims } from "@/server/auth/session";
import { probeCommercePermissions } from "@/features/commerce/server/commerce-permissions";
import { loadCommerceCatalogueGraph } from "@/features/commerce/server/commerce-queries";
import { StorefrontDisabledBanner } from "@/features/commerce/components/StorefrontDisabledBanner";
import { CommerceAdminLinks } from "@/features/commerce/components/CommerceAdminLinks";
import { CommerceDashboardView } from "@/features/commerce/components/CommerceDashboardView";
import {
  CommerceGhostButton,
  CommerceGoldButton,
  CommercePageHeader,
} from "@/features/commerce/components/CommercePageHeader";
import { buildCommerceDashboardSnapshot } from "@/features/commerce/domain/commerce-dashboard";
import { QuickActionsMenu } from "@/features/admin-ops/components/QuickActionsMenu.tsx";
import { resolveOpsNavFlags } from "@/features/admin-ops/server/resolve-ops-nav-flags.ts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Commerce | ONEDECORE Operations",
  description: "Catalogue, inventory and storefront readiness.",
};

export default async function AdminCommercePage() {
  const session = await getStaffClaims();
  if (!session) {
    redirect("/auth/login?next=%2Fadmin%2Fcommerce");
  }
  const [permissions, flags] = await Promise.all([probeCommercePermissions(), resolveOpsNavFlags()]);
  if (!permissions.canRead) {
    redirect("/auth/forbidden");
  }
  const graph = await loadCommerceCatalogueGraph({ includeInventory: permissions.canRead });
  const snapshot = buildCommerceDashboardSnapshot({
    products: graph.products,
    categories: graph.categories,
    variants: graph.variants,
    media: graph.media,
    taxRates: graph.taxRates,
    taxRequiredForPublish: graph.taxSettings?.tax_required_for_publish ?? true,
    gstInclusiveDisplay: graph.taxSettings?.gst_inclusive_display ?? true,
    shippingPresent: graph.shipping != null,
    pincodes: graph.pincodes,
    inventory: graph.inventory,
  });

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 lg:space-y-7">
      <CommercePageHeader
        title="Commerce"
        subtitle="Catalogue, inventory and storefront readiness."
        actions={
          <>
            <QuickActionsMenu flags={flags} />
            {permissions.canManageCatalog ? (
              <CommerceGoldButton href="/admin/commerce/products">+ Add Product</CommerceGoldButton>
            ) : null}
            {permissions.canManageCatalog ? (
              <CommerceGhostButton href="/admin/commerce/categories">Manage Categories</CommerceGhostButton>
            ) : null}
          </>
        }
      />
      <StorefrontDisabledBanner />
      <CommerceAdminLinks />
      <CommerceDashboardView snapshot={snapshot} canManageCatalog={permissions.canManageCatalog} />
    </div>
  );
}
